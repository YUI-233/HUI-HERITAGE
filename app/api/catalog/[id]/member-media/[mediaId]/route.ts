import { getSignedInUser } from "../../../../../../lib/local-auth";
import { readLocalStoredMediaRange, readStoredMedia } from "../../../../../../lib/media-storage";
import { prisma } from "../../../../../../lib/prisma";
import { cloudD1, usesCloudRuntime } from "../../../../../../lib/cloud-runtime";
import { canReadBorrowedBook } from "../../../../../../lib/borrowing";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ message: "请先登录会员账号后查看古籍文件。" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id, mediaId } = await params;
  if (usesCloudRuntime()) {
    const db = await cloudD1();
    const found = await db!.prepare(`SELECT m.storage_key, m.mime_type FROM cloud_media_assets m
      JOIN cloud_catalog_records c ON c.id = m.record_id WHERE m.id = ? AND m.record_id = ? AND m.visibility = 'MEMBER_ONLY' AND c.status = 'APPROVED'`)
      .bind(mediaId, id).all<{ storage_key: string; mime_type: string }>();
    const asset = found.results?.[0];
    if (!asset) return Response.json({ message: "未找到可访问的资料文件。" }, { status: 404 });
    const file = await readStoredMedia(asset.storage_key);
    return file ? new Response(file.body as BodyInit, { headers: { "Content-Type": file.contentType ?? asset.mime_type, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }) : Response.json({ message: "古籍文件暂不可用。" }, { status: 404 });
  }
  const [asset, book, artifact] = await Promise.all([
    prisma.mediaAsset.findFirst({ where: { id: mediaId, visibility: "MEMBER_ONLY", OR: [{ bookId: id }, { artifactId: id }] } }),
    prisma.book.findFirst({ where: { id, status: "APPROVED" }, select: { id: true } }),
    prisma.artifact.findFirst({ where: { id, status: "APPROVED" }, select: { id: true } }),
  ]);
  if (!asset || (!book && !artifact)) return Response.json({ message: "未找到可访问的资料文件。" }, { status: 404 });
  if (book && !(await canReadBorrowedBook(user.id, book.id))) return Response.json({ message: "请先办理借阅证并借阅本书。" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (asset.mimeType === "application/pdf") {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(request.headers.get("range") ?? "");
    const start = match ? Number(match[1]) : 0;
    const requestedEnd = match?.[2] ? Number(match[2]) : undefined;
    const ranged = await readLocalStoredMediaRange(asset.storageKey, start, requestedEnd);
    if (ranged) {
      const isPartial = Boolean(match);
      return new Response(ranged.body as BodyInit, {
        status: isPartial ? 206 : 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": String(ranged.end - ranged.start + 1),
          ...(isPartial ? { "Content-Range": `bytes ${ranged.start}-${ranged.end}/${ranged.size}` } : {}),
          "Content-Type": asset.mimeType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=300, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }
  const file = await readStoredMedia(asset.storageKey);
  return file ? new Response(file.body as BodyInit, { headers: { "Content-Type": file.contentType ?? asset.mimeType, "Content-Disposition": "inline", "Cache-Control": "private, max-age=300, must-revalidate", "X-Content-Type-Options": "nosniff" } }) : Response.json({ message: "古籍文件暂不可用。" }, { status: 404 });
}
