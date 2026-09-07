import { requirePermission } from "../../../../lib/admin-access";
import { deleteStoredMedia } from "../../../../lib/media-storage";
import { prisma } from "../../../../lib/prisma";
import { cloudD1, usesCloudRuntime } from "../../../../lib/cloud-runtime";

const guard = (request: Request) => requirePermission(request, "CATALOG_WRITE");

export async function GET(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const id = new URL(request.url).searchParams.get("recordId");
  if (!id) return Response.json({ message: "缺少资料编号。" }, { status: 400 });
  const media = usesCloudRuntime()
    ? ((await (await cloudD1())!.prepare("SELECT id, storage_key AS storageKey, mime_type AS mimeType, visibility, created_at AS createdAt FROM cloud_media_assets WHERE record_id = ? ORDER BY sort_order, created_at").bind(id).all()).results ?? [])
    : await prisma.mediaAsset.findMany({ where: { OR: [{ bookId: id }, { artifactId: id }] }, orderBy: { createdAt: "asc" }, select: { id: true, storageKey: true, mimeType: true, visibility: true, createdAt: true } });
  return Response.json(media);
}

export async function DELETE(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const { id, recordId } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || typeof recordId !== "string") return Response.json({ message: "缺少图片或资料编号。" }, { status: 400 });
  const db = usesCloudRuntime() ? await cloudD1() : null;
  const asset = db
    ? (await db.prepare("SELECT id, storage_key AS storageKey FROM cloud_media_assets WHERE id = ? AND record_id = ?").bind(id, recordId).all<{ id: string; storageKey: string }>()).results?.[0]
    : await prisma.mediaAsset.findFirst({ where: { id, OR: [{ bookId: recordId }, { artifactId: recordId }] } });
  if (!asset) return Response.json({ message: "未找到该资料的图片。" }, { status: 404 });
  if (db) await db.prepare("DELETE FROM cloud_media_assets WHERE id = ?").bind(asset.id).run();
  else await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await deleteStoredMedia(asset.storageKey);
  return Response.json({ deleted: true });
}
