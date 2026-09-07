import type { AdminCatalogInput, AdminCatalogType } from "./admin-catalog";
import { cloudD1, usesCloudRuntime } from "./cloud-runtime";
import { deleteStoredMedia } from "./media-storage";

type Actor = { userId: string };
type CatalogRow = {
  id: string; type: AdminCatalogType; catalog_number: string | null; title: string; language: string | null;
  author: string | null; era: string | null; category: string | null; material: string | null; description: string | null;
  source: string | null; status: string; keywords_json: string; metadata_json: string; submitted_by_user_id: string | null;
  review_comment: string | null; updated_at: string; media_count?: number;
};

function json<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function metadata(input: AdminCatalogInput) {
  const values = input.type === "manuscript" ? [
    ["年代细分", input.eraDetail], ["出版时间", input.publicationDate], ["出版／刻印者", input.imprintPublisher],
    ["版本类型", input.versionType], ["装帧", input.binding], ["册数", String(input.volumeCount ?? 1)],
    ["分类", input.categories?.join("、")],
  ] : [];
  return values.filter((entry) => entry[1]).map(([label, value]) => ({ label, value }));
}

function field(items: Array<{ label: string; value: string }>, label: string) {
  return items.find((item) => item.label === label)?.value ?? null;
}

function adminRecord(row: CatalogRow) {
  const details = json<Array<{ label: string; value: string }>>(row.metadata_json, []);
  return {
    id: row.id, catalogNumber: row.catalog_number, title: row.title, type: row.type,
    language: row.language, author: row.author, dynasty: row.type === "manuscript" ? row.era : null,
    eraDetail: field(details, "年代细分"), publicationDate: field(details, "出版时间"), imprintPublisher: field(details, "出版／刻印者"),
    versionType: field(details, "版本类型") ?? row.material, binding: field(details, "装帧"), volumeCount: Number(field(details, "册数")) || 1,
    categories: (field(details, "分类") ?? "").split("、").filter(Boolean), category: row.category, era: row.type === "artifact" ? row.era : null,
    material: row.material, description: row.description, source: row.source, keywords: json<string[]>(row.keywords_json, []),
    status: row.status, submittedByLane: null, reviewerLane: null, reviewComment: row.review_comment, updatedAt: row.updated_at, mediaCount: Number(row.media_count ?? 0),
  };
}

async function audit(entityType: string, entityId: string, action: string, actorId?: string, payload: unknown = {}) {
  const db = await cloudD1();
  await db!.prepare("INSERT INTO cloud_audit_events (id, entity_type, entity_id, action, actor_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), entityType, entityId, action, actorId ?? null, JSON.stringify(payload), new Date().toISOString()).run();
}

export async function listCloudAdminCatalog(type?: AdminCatalogType, onlyWithMedia = false) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const clauses = [type ? "c.type = ?" : null, onlyWithMedia ? "EXISTS (SELECT 1 FROM cloud_media_assets m WHERE m.record_id = c.id)" : null].filter(Boolean);
  const result = await db!.prepare(`SELECT c.* FROM cloud_catalog_records c${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY c.updated_at DESC`)
    .bind(...(type ? [type] : [])).all<CatalogRow>();
  return (result.results ?? []).map(adminRecord);
}

export async function listCloudAdminCatalogDrafts(userId: string) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare("SELECT c.*, (SELECT COUNT(*) FROM cloud_media_assets m WHERE m.record_id = c.id) AS media_count FROM cloud_catalog_records c WHERE c.submitted_by_user_id = ? AND c.status IN ('DRAFT', 'REJECTED', 'NEEDS_REVISION', 'PENDING') ORDER BY c.updated_at DESC").bind(userId).all<CatalogRow>();
  return (result.results ?? []).map(adminRecord);
}

export async function withdrawCloudAdminCatalogSubmission(input: { id: string; type: AdminCatalogType }, actor: Actor) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const found = await db!.prepare("SELECT id FROM cloud_catalog_records WHERE id = ? AND type = ? AND status = 'PENDING' AND submitted_by_user_id = ?").bind(input.id, input.type, actor.userId).all<{ id: string }>();
  if (!found.results?.[0]) throw new Error("仅可撤回本人正在审核中的资料。");
  await db!.prepare("UPDATE cloud_catalog_records SET status = 'DRAFT', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), input.id).run();
  await audit(input.type === "manuscript" ? "BOOK" : "ARTIFACT", input.id, "CATALOG_SUBMISSION_WITHDRAWN", actor.userId);
  return { id: input.id, type: input.type, status: "DRAFT" as const };
}

export async function deleteCloudAdminCatalogDraft(input: { id: string; type: AdminCatalogType }, actor: Actor) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const found = await db!.prepare("SELECT id FROM cloud_catalog_records WHERE id = ? AND type = ? AND status IN ('DRAFT', 'REJECTED', 'NEEDS_REVISION') AND submitted_by_user_id = ?").bind(input.id, input.type, actor.userId).all<{ id: string }>();
  if (!found.results?.[0]) throw new Error("仅可删除本人草稿或待修改资料。");
  const media = await db!.prepare("SELECT id, storage_key AS storageKey FROM cloud_media_assets WHERE record_id = ?").bind(input.id).all<{ id: string; storageKey: string }>();
  await db!.prepare("DELETE FROM cloud_media_assets WHERE record_id = ?").bind(input.id).run();
  await db!.prepare("DELETE FROM cloud_catalog_records WHERE id = ?").bind(input.id).run();
  await Promise.all((media.results ?? []).map((asset) => deleteStoredMedia(asset.storageKey)));
  await audit(input.type === "manuscript" ? "BOOK" : "ARTIFACT", input.id, "CATALOG_DRAFT_DELETED", actor.userId);
  return { deleted: true };
}

export async function saveCloudAdminCatalog(input: AdminCatalogInput, submitter?: Actor) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const id = input.id ?? crypto.randomUUID();
  const previous = await db!.prepare("SELECT status, catalog_number FROM cloud_catalog_records WHERE id = ?").bind(id).all<{ status: string; catalog_number: string | null }>();
  const previousRow = previous.results?.[0];
  const catalogNumber = previousRow?.catalog_number ?? `HH-${input.type === "manuscript" ? "M" : "A"}-${id.slice(-6).toUpperCase()}`;
  const status = input.status ?? "DRAFT";
  const now = new Date().toISOString();
  await db!.prepare(`INSERT INTO cloud_catalog_records
    (id, type, catalog_number, title, language, author, era, category, material, description, source, status, keywords_json, metadata_json, submitted_by_user_id, reviewed_by_user_id, review_comment, reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET type=excluded.type, title=excluded.title, language=excluded.language, author=excluded.author, era=excluded.era, category=excluded.category, material=excluded.material, description=excluded.description, source=excluded.source, status=excluded.status, keywords_json=excluded.keywords_json, metadata_json=excluded.metadata_json, submitted_by_user_id=excluded.submitted_by_user_id, reviewed_by_user_id=CASE WHEN excluded.status = 'PENDING' THEN NULL ELSE cloud_catalog_records.reviewed_by_user_id END, review_comment=CASE WHEN excluded.status = 'PENDING' THEN NULL ELSE cloud_catalog_records.review_comment END, reviewed_at=CASE WHEN excluded.status = 'PENDING' THEN NULL ELSE cloud_catalog_records.reviewed_at END, updated_at=excluded.updated_at`)
    .bind(id, input.type, catalogNumber, input.title, input.language ?? null, input.author ?? null, input.type === "manuscript" ? input.dynasty ?? null : input.era ?? null, input.type === "artifact" ? input.category ?? "待分类" : null, input.type === "artifact" ? input.material ?? null : input.versionType ?? null, input.description ?? null, input.source ?? null, status, JSON.stringify(input.keywords ?? []), JSON.stringify(metadata(input)), submitter?.userId ?? null, now, now).run();
  await audit(input.type === "manuscript" ? "BOOK" : "ARTIFACT", id, input.id ? "ADMIN_UPDATED" : "ADMIN_CREATED", submitter?.userId, { status });
  return { id, catalogNumber, type: input.type, title: input.title, submittedForReview: status === "PENDING" && previousRow?.status !== "PENDING" };
}

export async function countCloudPendingCatalogReviews(userId: string) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare("SELECT COUNT(*) AS count FROM cloud_catalog_records WHERE status = 'PENDING' AND (submitted_by_user_id IS NULL OR submitted_by_user_id != ?)").bind(userId).all<{ count: number }>();
  return Number(result.results?.[0]?.count ?? 0);
}

export async function reviewCloudAdminCatalog(input: { id: string; type: AdminCatalogType; decision: "APPROVED" | "REJECTED" | "NEEDS_REVISION"; comment?: string }, reviewer: Actor) {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const found = await db!.prepare("SELECT id, status, submitted_by_user_id FROM cloud_catalog_records WHERE id = ? AND type = ?").bind(input.id, input.type).all<{ id: string; status: string; submitted_by_user_id: string | null }>();
  const row = found.results?.[0];
  if (!row) throw new Error(input.type === "manuscript" ? "未找到该古籍资料。" : "未找到该文物资料。");
  if (row.status !== "PENDING") throw new Error("只有待审核资料可以进入审核流程。");
  if (row.submitted_by_user_id === reviewer.userId) throw new Error("同一账号不能审核自己提交的资料，请由其他拥有审核权限的用户处理。");
  const comment = input.comment?.trim().slice(0, 1000) || null;
  await db!.prepare("UPDATE cloud_catalog_records SET status = ?, reviewed_by_user_id = ?, review_comment = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
    .bind(input.decision, reviewer.userId, comment, new Date().toISOString(), new Date().toISOString(), input.id).run();
  await audit(input.type === "manuscript" ? "BOOK" : "ARTIFACT", input.id, `CATALOG_${input.decision}`, reviewer.userId, { comment });
  return { id: input.id, type: input.type, status: input.decision };
}
