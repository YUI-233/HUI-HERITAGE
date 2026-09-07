import { cloudD1, usesCloudRuntime } from "./cloud-runtime";

export async function readCloudSetting<T>(key: string): Promise<T | null | undefined> {
  if (!usesCloudRuntime()) return undefined;
  const db = await cloudD1();
  const result = await db!.prepare("SELECT value_json FROM cloud_site_settings WHERE key = ?").bind(key).all<{ value_json: string }>();
  const value = result.results?.[0]?.value_json;
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export async function writeCloudSetting(key: string, value: unknown) {
  if (!usesCloudRuntime()) return false;
  const db = await cloudD1();
  await db!.prepare(`INSERT INTO cloud_site_settings (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`)
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();
  return true;
}
