import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSystemAdmin } from "../../../../lib/admin-access";
import { cloudMedia, usesCloudRuntime } from "../../../../lib/cloud-runtime";

const allowedMimeTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxUploadBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  const data = await request.formData();
  const variant = data.get("variant");
  const file = data.get("file");
  if ((variant !== "desktop" && variant !== "mobile") || !(file instanceof File) || !allowedMimeTypes[file.type] || file.size === 0 || file.size > maxUploadBytes) return Response.json({ error: "INVALID_IMAGE", message: "仅支持 JPG、PNG、WebP，单个文件不超过 8 MB。" }, { status: 400 });
  const extension = allowedMimeTypes[file.type];
  const fileName = `${variant}-${Date.now()}.${extension}`;
  if (usesCloudRuntime()) {
    await (await cloudMedia())!.put(`site/hero/${fileName}`, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    return Response.json({ path: `/api/site-media/hero/${fileName}` });
  }
  const targetDirectory = path.join(process.cwd(), "public", "site", "hero");
  await mkdir(targetDirectory, { recursive: true });
  await writeFile(path.join(targetDirectory, fileName), Buffer.from(await file.arrayBuffer()));
  return Response.json({ path: `/api/site-media/hero/${fileName}` });
}
