import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSystemAdmin } from "../../../../lib/admin-access";
import { homeBrowseKeys } from "../../../../lib/home-browse";

const allowedMimeTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxUploadBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  const data = await request.formData();
  const slot = data.get("slot"); const file = data.get("file");
  if (typeof slot !== "string" || !homeBrowseKeys.includes(slot as typeof homeBrowseKeys[number])) return Response.json({ message: "无效的图片位置。" }, { status: 400 });
  if (!(file instanceof File) || !allowedMimeTypes[file.type] || file.size === 0 || file.size > maxUploadBytes) return Response.json({ message: "仅支持 JPG、PNG、WebP，单个文件不超过 8 MB。" }, { status: 400 });
  const fileName = `${slot}-${Date.now()}.${allowedMimeTypes[file.type]}`;
  const targetDirectory = path.join(process.cwd(), "public", "site", "home-browse");
  await mkdir(targetDirectory, { recursive: true });
  await writeFile(path.join(targetDirectory, fileName), Buffer.from(await file.arrayBuffer()));
  return Response.json({ path: `/site/home-browse/${fileName}` });
}
