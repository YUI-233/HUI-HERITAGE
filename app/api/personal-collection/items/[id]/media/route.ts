import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSignedInUser } from "../../../../../../lib/local-auth";
import { clearStaleCoverMedia } from "../../../../../../lib/personal-collection-profile";
import { prisma } from "../../../../../../lib/prisma";

const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function owner(request: Request, id: string) {
  const user = await getSignedInUser(request); if (!user) throw new Error("请先登录。");
  const item = await prisma.personalCollectionItem.findFirst({ where: { id, ownerId: user.id }, select: { id: true, type: true, status: true, isPublic: true } });
  if (!item) throw new Error("未找到可管理的个人收藏记录。");
  return { user, item };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { user, item } = await owner(request, id); const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !imageTypes[file.type] || file.size === 0 || file.size > 12 * 1024 * 1024) throw new Error("仅支持 JPG、PNG、WebP，单张不超过 12 MB。");
    const current = await prisma.mediaAsset.count({ where: { personalCollectionItemId: id } });
    const limit = item.type === "BOOK" ? 2 : 3;
    if (current >= limit) throw new Error(item.type === "BOOK" ? "每本书最多保存 2 张图片，请先删除现有图片。" : "每件藏品最多保存 3 张图片，请先删除现有图片。");
    const suffix = `${id}-${Date.now()}.${imageTypes[file.type]}`; const storageKey = `private/personal/${user.id}/${suffix}`;
    const directory = path.join(process.cwd(), "uploads", "private", "personal", user.id); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, suffix), Buffer.from(await file.arrayBuffer()));
    const visibility = item.status === "APPROVED" && item.isPublic ? "PUBLIC" : "PRIVATE";
    const media = await prisma.mediaAsset.create({ data: { storageKey, mimeType: file.type, visibility, personalCollectionItemId: id, uploadedById: user.id }, select: { id: true, mimeType: true } });
    return Response.json(media, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "图片上传失败。" }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { user } = await owner(request, id); const body = await request.json() as { mediaId?: string };
    if (!body.mediaId) throw new Error("请选择需要删除的图片。");
    const media = await prisma.mediaAsset.findFirst({ where: { id: body.mediaId, personalCollectionItemId: id } });
    if (!media) throw new Error("未找到该图片。");
    await prisma.mediaAsset.delete({ where: { id: media.id } });
    await unlink(path.join(process.cwd(), "uploads", media.storageKey)).catch(() => undefined);
    await clearStaleCoverMedia(user.id, media.id);
    return Response.json({ deleted: true, ownerId: user.id });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "图片删除失败。" }, { status: 400 }); }
}
