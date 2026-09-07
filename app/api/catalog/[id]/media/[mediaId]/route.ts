import { readStoredMedia } from "../../../../../../lib/media-storage";
import { prisma } from "../../../../../../lib/prisma";
import { cloudD1, usesCloudRuntime } from "../../../../../../lib/cloud-runtime";

/** Public reader for digitized manuscript images. PDFs retain the member-only reader. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const { id, mediaId } = await params;
  if (usesCloudRuntime()) {
    const db = await cloudD1();
    const found = await db!.prepare(`SELECT m.storage_key, m.mime_type FROM cloud_media_assets m
      JOIN cloud_catalog_records c ON c.id = m.record_id WHERE m.id = ? AND m.record_id = ? AND m.visibility = 'PUBLIC' AND m.mime_type LIKE 'image/%' AND c.status = 'APPROVED'`)
      .bind(mediaId, id).all<{ storage_key: string; mime_type: string }>();
    const asset = found.results?.[0];
    if (!asset) return Response.json({ message: "未找到可公开浏览的古籍图片。" }, { status: 404 });
    const file = await readStoredMedia(asset.storage_key);
    if (file) return new Response(file.body as BodyInit, { headers: { "Content-Type": file.contentType ?? asset.mime_type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
    if (/^collection\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(asset.storage_key)) return Response.redirect(new URL(`/${asset.storage_key}`, _request.url), 307);
    return Response.json({ message: "古籍图片暂不可用。" }, { status: 404 });
  }
  const [asset, book] = await Promise.all([
    prisma.mediaAsset.findFirst({ where: { id: mediaId, bookId: id, visibility: "PUBLIC", mimeType: { startsWith: "image/" } } }),
    prisma.book.findFirst({ where: { id, status: "APPROVED" }, select: { id: true } }),
  ]);
  if (!asset || !book) return Response.json({ message: "未找到可公开浏览的古籍图片。" }, { status: 404 });
  const file = await readStoredMedia(asset.storageKey);
  return file ? new Response(file.body as BodyInit, { headers: { "Content-Type": file.contentType ?? asset.mimeType, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } }) : Response.json({ message: "古籍图片暂不可用。" }, { status: 404 });
}
