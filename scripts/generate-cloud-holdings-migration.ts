import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

type Holding = { id: string; recordJson?: string };
type Payload = { generatedAt?: string; holdings?: Holding[] };

const source = path.resolve(process.env.HUI_CLOUD_EXPORT_PATH || "work/cloud-public-data.json");
const destinationValue = process.env.HUI_CLOUD_HOLDINGS_MIGRATION_PATH;
if (!destinationValue) throw new Error("HUI_CLOUD_HOLDINGS_MIGRATION_PATH is required.");
const destination = path.resolve(destinationValue);
const payload = JSON.parse(await readFile(source, "utf8")) as Payload;
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;
const rows = (payload.holdings ?? []).filter((holding) => holding.id && holding.recordJson);
const statements = rows.map((holding) => `UPDATE cloud_holdings SET record_json = ${sql(holding.recordJson!)} WHERE id = ${sql(holding.id)};`).join("\n--> statement-breakpoint\n");
await appendFile(destination, `\n--> statement-breakpoint\n-- HUI HERITAGE holding snapshots; exported at ${payload.generatedAt ?? "unknown"}.\n${statements}\n`, "utf8");
console.log(`Appended ${rows.length} holding snapshots to ${destination}.`);
