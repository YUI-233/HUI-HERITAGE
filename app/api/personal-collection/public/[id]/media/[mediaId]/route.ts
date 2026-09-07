import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../../../../../../lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const { id, mediaId } = await params;
  const media = await prisma.mediaAsset.findFirst({ where: { id: mediaId, personalCollectionItemId: id, visibility: "PUBLIC", personalCollectionItem: { status: "APPROVED", isPublic: true } } });
  if (!media?.storageKey.startsWith("private/personal/")) return Response.json({ message: "未找到公开图片。" }, { status: 404 });
  try { return new Response(await readFile(path.join(process.cwd(), "uploads", media.storageKey)), { headers: { "Content-Type": media.mimeType, "Cache-Control": "public, max-age=3600" } }); }
  catch { return Response.json({ message: "图片文件不存在。" }, { status: 404 }); }
}
