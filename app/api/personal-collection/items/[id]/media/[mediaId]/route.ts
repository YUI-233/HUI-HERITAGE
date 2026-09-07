import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSignedInUser } from "../../../../../../../lib/local-auth";
import { prisma } from "../../../../../../../lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id, mediaId } = await params;
  const media = await prisma.mediaAsset.findFirst({ where: { id: mediaId, personalCollectionItemId: id, personalCollectionItem: { ownerId: user.id } } });
  if (!media?.storageKey.startsWith(`private/personal/${user.id}/`)) return Response.json({ message: "未找到可访问的图片。" }, { status: 404 });
  try { return new Response(await readFile(path.join(process.cwd(), "uploads", media.storageKey)), { headers: { "Content-Type": media.mimeType, "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ message: "图片文件不存在。" }, { status: 404 }); }
}
