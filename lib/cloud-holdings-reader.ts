import { cloudD1, usesCloudRuntime } from "./cloud-runtime";
import type { HoldingRecord } from "./holdings-repository";

type Row = { id: string; institution: string; region: string; origin: "DOMESTIC" | "OVERSEAS"; call_number: string | null; catalog_url: string | null; description: string | null; record_id: string; record_type: "manuscript" | "artifact"; record_json: string };
type RecordSnapshot = Omit<HoldingRecord["record"], "id" | "type">;

function record(row: Row): HoldingRecord {
  let snapshot: RecordSnapshot = { title: row.call_number || `馆藏资料 ${row.id}` };
  try {
    const parsed = JSON.parse(row.record_json) as RecordSnapshot;
    if (parsed && typeof parsed.title === "string" && parsed.title.trim()) snapshot = parsed;
  } catch {}
  return { id: row.id, institution: row.institution, region: row.region, origin: row.origin, callNumber: row.call_number, catalogUrl: row.catalog_url, description: row.description, record: { id: row.record_id, type: row.record_type, ...snapshot } };
}

export async function readCloudHoldings(): Promise<HoldingRecord[] | null> {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare(`SELECT id, institution, region, origin, call_number, catalog_url, description, record_id, record_type, record_json
    FROM cloud_holdings WHERE status = ? ORDER BY institution COLLATE NOCASE ASC, id ASC`).bind("APPROVED").all<Row>();
  return (result.results ?? []).map(record);
}
