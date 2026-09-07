import type { CatalogRecord, CatalogType } from "./catalog";
import { cloudD1, usesCloudRuntime } from "./cloud-runtime";

type CloudCatalogRow = {
  id: string; type: CatalogType; catalog_number: string | null; title: string;
  description: string | null; source: string | null; era: string | null;
  keywords_json: string; metadata_json: string;
};
type CloudMediaRow = { id: string; record_id: string; storage_key: string; mime_type: string; visibility: "PUBLIC" | "MEMBER_ONLY" | "PRIVATE" };

function jsonArray<T>(value: string): T[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
}

function asRecord(row: CloudCatalogRow, media: CloudMediaRow[]): CatalogRecord {
  const publicImages = media.filter((item) => item.record_id === row.id && item.visibility === "PUBLIC" && item.mime_type.startsWith("image/"));
  const memberFiles = media.filter((item) => item.record_id === row.id && item.visibility === "MEMBER_ONLY");
  const images = publicImages.map((item) => `/api/catalog/${row.id}/media/${item.id}`);
  const memberDocuments = memberFiles.filter((item) => item.mime_type === "application/pdf").map((item, index) => {
    const volumeNumber = Number(item.storage_key.match(/-v(\d+)-/i)?.[1] ?? index + 1);
    return { id: item.id, href: `/api/catalog/${row.id}/member-media/${item.id}`, volumeNumber, label: `第${volumeNumber}册` };
  }).sort((left, right) => left.volumeNumber - right.volumeNumber);
  const memberImages = memberFiles.filter((item) => item.mime_type.startsWith("image/")).map((item) => `/api/catalog/${row.id}/member-media/${item.id}`);
  return {
    id: row.id, catalogNumber: row.catalog_number ?? undefined, title: row.title, type: row.type,
    summary: row.description ?? "暂无资料说明。", date: row.era ?? "待考", source: row.source ?? "来源待补充",
    image: images[0] ?? memberImages[0] ?? "/private-media/unavailable", imageAccess: images.length ? "public" : memberImages.length ? "member" : "none", images, memberImages, memberDocuments,
    keywords: jsonArray<string>(row.keywords_json),
    metadata: jsonArray<{ label: string; value: string }>(row.metadata_json).filter((item) => item.label && item.value),
  };
}

/** Returns null locally so PostgreSQL remains the local source of truth. */
export async function readCloudCatalogRecords(): Promise<CatalogRecord[] | null> {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare(`SELECT id, type, catalog_number, title, description, source, era, keywords_json, metadata_json
    FROM cloud_catalog_records WHERE status = ? ORDER BY title COLLATE NOCASE ASC`).bind("APPROVED").all<CloudCatalogRow>();
  const media = await db!.prepare("SELECT id, record_id, storage_key, mime_type, visibility FROM cloud_media_assets WHERE visibility != 'PRIVATE' ORDER BY sort_order, created_at").bind().all<CloudMediaRow>();
  return (result.results ?? []).map((row) => asRecord(row, media.results ?? []));
}
