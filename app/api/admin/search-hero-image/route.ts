import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSystemAdmin } from "../../../../lib/admin-access";
import { cloudMedia, usesCloudRuntime } from "../../../../lib/cloud-runtime";
import { searchHeroKeys } from "../../../../lib/search-hero-content";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  const data = await request.formData(); const page = data.get("page"); const file = data.get("file");
  if (typeof page !== "string" || !searchHeroKeys.includes(page as typeof searchHeroKeys[number]) || !(file instanceof File) || !extensions[file.type] || !file.size || file.size > 8 * 1024 * 1024) return Response.json({ message: "仅支持 JPG、PNG、WebP，单个文件不超过 8 MB。" }, { status: 400 });
  const fileName = `${page}-${Date.now()}.${extensions[file.type]}`;
  if (usesCloudRuntime()) { await (await cloudMedia())!.put(`site/search-hero/${fileName}`, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } }); return Response.json({ path: `/api/site-media/search-hero/${fileName}` }); }
  const directory = path.join(process.cwd(), "public", "site", "search-hero"); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()));
  return Response.json({ path: `/api/site-media/search-hero/${fileName}` });
}
