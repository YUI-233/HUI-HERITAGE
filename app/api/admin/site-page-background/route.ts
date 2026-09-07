import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSystemAdmin } from "../../../../lib/admin-access";
import { sitePageSlugs } from "../../../../lib/site-pages";

const allowedMimeTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const denied = await requireSystemAdmin(request);
  if (denied) return denied;

  const data = await request.formData();
  const file = data.get("file");
  const slug = data.get("slug");
  if (typeof slug !== "string" || !sitePageSlugs.includes(slug as typeof sitePageSlugs[number])) {
    return Response.json({ message: "分页类型无效。" }, { status: 400 });
  }
  if (!(file instanceof File) || !allowedMimeTypes[file.type] || file.size === 0 || file.size > 8 * 1024 * 1024) {
    return Response.json({ message: "仅支持 JPG、PNG、WebP，单个文件不超过 8 MB。" }, { status: 400 });
  }

  const fileName = `background-${Date.now()}.${allowedMimeTypes[file.type]}`;
  const targetDirectory = path.join(process.cwd(), "public", "site", "pages", slug);
  await mkdir(targetDirectory, { recursive: true });
  await writeFile(path.join(targetDirectory, fileName), Buffer.from(await file.arrayBuffer()));
  return Response.json({ path: `/site/pages/${slug}/${fileName}` });
}
