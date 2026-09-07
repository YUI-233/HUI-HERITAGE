import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Payload = Record<string, Array<Record<string, unknown>>> & { generatedAt?: string };
const source = path.resolve(process.env.HUI_CLOUD_EXPORT_PATH || "work/cloud-public-data.json");
const destination = path.resolve("drizzle/0003_hui_initial_data.sql");

const sql = (value: unknown) => value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const statement = (table: string, columns: string[], rows: Array<Record<string, unknown>>, keys: string[]) => {
  if (!rows.length) return "";
  const values = rows.map((row) => `(${keys.map((key) => sql(row[key])).join(",")})`).join(",\n");
  return `INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES\n${values};`;
};

const payload = JSON.parse(await readFile(source, "utf8")) as Payload;
const output = [
  `-- HUI HERITAGE initial public data; generated from ${path.basename(source)} at ${payload.generatedAt ?? "unknown"}.`,
  statement("cloud_catalog_records", ["id","type","catalog_number","title","language","author","era","category","material","description","source","status","keywords_json","metadata_json","created_at","updated_at"], payload.catalogRecords ?? [], ["id","type","catalogNumber","title","language","author","era","category","material","description","source","status","keywordsJson","metadataJson","createdAt","updatedAt"]),
  "--> statement-breakpoint",
  statement("cloud_holdings", ["id","record_id","record_type","institution","region","origin","call_number","catalog_url","description","status","created_at","updated_at"], payload.holdings ?? [], ["id","recordId","recordType","institution","region","origin","callNumber","catalogUrl","description","status","createdAt","updatedAt"]),
  "--> statement-breakpoint",
  statement("cloud_research_articles", ["id","title","author","affiliation","publication","published_year","volume_issue","pages","identifier","summary","content_html","category","status","keywords_json","related_record_ids_json","created_at","updated_at"], payload.researchArticles ?? [], ["id","title","author","affiliation","publication","publishedYear","volumeIssue","pages","identifier","summary","contentHtml","category","status","keywordsJson","relatedRecordIdsJson","createdAt","updatedAt"]),
  "--> statement-breakpoint",
  statement("cloud_site_settings", ["key","value_json","updated_at"], payload.siteSettings ?? [], ["key","valueJson","updatedAt"]),
  "--> statement-breakpoint",
  statement("cloud_media_assets", ["id","record_id","storage_key","mime_type","visibility","sort_order","created_at"], payload.mediaAssets ?? [], ["id","recordId","storageKey","mimeType","visibility","sortOrder","createdAt"]),
].filter(Boolean).join("\n");

await writeFile(destination, `${output}\n`, "utf8");
console.log(`Generated ${destination} with ${(payload.catalogRecords ?? []).length} catalogue records, ${(payload.holdings ?? []).length} holdings and ${(payload.mediaAssets ?? []).length} media manifests.`);
