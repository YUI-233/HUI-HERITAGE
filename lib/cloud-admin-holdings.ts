import type { CollectionOrigin, ReviewStatus } from "@prisma/client";
import { cloudD1, usesCloudRuntime } from "./cloud-runtime";

type Input = { id?: string; recordType: "manuscript" | "artifact"; recordId: string; institution: string; region: string; origin: CollectionOrigin; callNumber?: string; catalogUrl?: string; description?: string; status?: ReviewStatus };

export async function listCloudAdminHoldings() {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare(`SELECT h.*, c.title FROM cloud_holdings h
    JOIN cloud_catalog_records c ON c.id = h.record_id ORDER BY h.updated_at DESC`).bind().all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function saveCloudAdminHolding(input: Input) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const linked = await db!.prepare("SELECT id, title, author, era, category, material, metadata_json FROM cloud_catalog_records WHERE id = ? AND type = ?").bind(input.recordId, input.recordType).all<{ id: string; title: string; author: string | null; era: string | null; category: string | null; material: string | null; metadata_json: string }>();
  if (!linked.results?.length) throw new Error("关联馆藏资料不存在。");
  const linkedRecord = linked.results[0];
  const metadata = (() => { try { return JSON.parse(linkedRecord.metadata_json) as Array<{ label?: string; value?: string }>; } catch { return []; } })();
  const metadataValue = (label: string) => metadata.find((item) => item.label === label)?.value ?? null;
  const recordJson = JSON.stringify({ title: linkedRecord.title, author: linkedRecord.author, era: metadataValue("年代") ?? linkedRecord.era, eraDetail: metadataValue("刊刻年份"), publicationDate: metadataValue("刊刻时间"), imprintPublisher: metadataValue("刊刻主体"), versionType: metadataValue("版本类型") ?? linkedRecord.material, binding: metadataValue("装帧"), volumeCount: Number(metadataValue("册数")) || 1, category: metadataValue("分类") ?? linkedRecord.category });
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await db!.prepare(`INSERT INTO cloud_holdings
    (id, record_id, record_type, record_json, institution, region, origin, call_number, catalog_url, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET record_id=excluded.record_id, record_type=excluded.record_type, record_json=excluded.record_json, institution=excluded.institution, region=excluded.region, origin=excluded.origin, call_number=excluded.call_number, catalog_url=excluded.catalog_url, description=excluded.description, status=excluded.status, updated_at=excluded.updated_at`)
    .bind(id, input.recordId, input.recordType, recordJson, input.institution, input.region, input.origin, input.callNumber ?? null, input.catalogUrl ?? null, input.description ?? null, input.status ?? "DRAFT", now, now).run();
  await db!.prepare("INSERT INTO cloud_audit_events (id, entity_type, entity_id, action, actor_id, payload_json, created_at) VALUES (?, 'HOLDING', ?, ?, NULL, ?, ?)")
    .bind(crypto.randomUUID(), id, input.id ? "ADMIN_UPDATED" : "ADMIN_CREATED", JSON.stringify({ status: input.status ?? "DRAFT" }), now).run();
  return { id };
}
