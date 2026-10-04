import { requirePermission } from "../../../../lib/admin-access";
import { writeStoredMedia } from "../../../../lib/media-storage";
import { prisma } from "../../../../lib/prisma";
import { cloudD1, usesCloudRuntime } from "../../../../lib/cloud-runtime";
import { ensureCatalogReviewBaseline } from "../../../../lib/catalog-review-baseline";

const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const manuscriptFileTypes: Record<string, string> = { ...imageTypes, "application/pdf": "pdf" };

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_WRITE"); if (denied) return denied;
  const form = await request.formData();
  const recordId = form.get("recordId"); const type = form.get("type"); const file = form.get("file");
  const allowedTypes = manuscriptFileTypes;
  const maximumSize = file instanceof File && file.type === "application/pdf" ? 80 * 1024 * 1024 : 12 * 1024 * 1024;
  if (typeof recordId !== "string" || (type !== "manuscript" && type !== "artifact") || !(file instanceof File) || !allowedTypes[file.type] || file.size === 0 || file.size > maximumSize) return Response.json({ error: "INVALID_MEDIA", message: "古籍与文物均支持 JPG、PNG、WebP 或 pdf；图片单个不超过 12 MB，pdf 不超过 80 MB。" }, { status: 400 });
  const cloud = usesCloudRuntime();
  const db = cloud ? await cloudD1() : null;
  const exists = cloud
    ? (await db!.prepare("SELECT id FROM cloud_catalog_records WHERE id = ? AND type = ?").bind(recordId, type).all<{ id: string }>()).results?.[0]
    : type === "manuscript" ? await prisma.book.findUnique({ where: { id: recordId } }) : await prisma.artifact.findUnique({ where: { id: recordId } });
  if (!exists) return Response.json({ error: "NOT_FOUND", message: "请先保存资料，再上传图片。" }, { status: 404 });
  if (!cloud) await ensureCatalogReviewBaseline(type, recordId);
  const extension = allowedTypes[file.type]; const suffix = `${recordId}-${Date.now()}.${extension}`;
  const isBook = type === "manuscript";
  const isMemberDocument = file.type === "application/pdf";
  const requestedVolume = Number(form.get("volumeNumber"));
  if (isMemberDocument && isBook && (!Number.isInteger(requestedVolume) || requestedVolume < 1 || requestedVolume > 999)) return Response.json({ error: "INVALID_VOLUME", message: "请为每份古籍 PDF 指定有效册次。" }, { status: 400 });
  if (isMemberDocument && isBook && !cloud) {
    const book = await prisma.book.findUnique({ where: { id: recordId }, select: { volumeCount: true } });
    if (!book || requestedVolume > book.volumeCount) return Response.json({ error: "INVALID_VOLUME", message: `册次应介于第 1 册至第 ${book?.volumeCount ?? 1} 册。` }, { status: 400 });
    const duplicate = await prisma.mediaAsset.findFirst({ where: { bookId: recordId, storageKey: { contains: `${recordId}-v${requestedVolume}-` } }, select: { id: true } });
    if (duplicate) return Response.json({ error: "DUPLICATE_VOLUME", message: `第 ${requestedVolume} 册已上传；请先删除原文件再替换。` }, { status: 409 });
  }
  const privateFolder = isBook ? "manuscripts" : "artifacts";
  const documentSuffix = isMemberDocument && isBook ? `${recordId}-v${requestedVolume}-${Date.now()}.${extension}` : suffix;
  const storageKey = isMemberDocument ? `private/${privateFolder}/${documentSuffix}` : isBook ? `collection/manuscripts/${suffix}` : `collection/${suffix}`;
  await writeStoredMedia(storageKey, await file.arrayBuffer(), file.type);
  const visibility = isMemberDocument ? "MEMBER_ONLY" : "PUBLIC";
  if (cloud) {
    const now = new Date().toISOString();
    await db!.prepare("INSERT INTO cloud_media_assets (id, record_id, storage_key, mime_type, visibility, sort_order, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(crypto.randomUUID(), recordId, storageKey, file.type, visibility, now).run();
    await db!.prepare("INSERT INTO cloud_audit_events (id, entity_type, entity_id, action, actor_id, payload_json, created_at) VALUES (?, 'MEDIA_ASSET', ?, 'ADMIN_MEDIA_UPLOADED', NULL, ?, ?)").bind(crypto.randomUUID(), storageKey, JSON.stringify({ recordId, type, mimeType: file.type }), now).run();
  } else {
    await prisma.mediaAsset.create({ data: { storageKey, mimeType: file.type, visibility, bookId: isBook ? recordId : null, artifactId: isBook ? null : recordId } });
    await prisma.auditEvent.create({ data: { entityType: "MEDIA_ASSET", entityId: storageKey, action: "ADMIN_MEDIA_UPLOADED", payload: { recordId, type, mimeType: file.type } } });
  }
  return Response.json({ storageKey, visibility }, { status: 201 });
}
