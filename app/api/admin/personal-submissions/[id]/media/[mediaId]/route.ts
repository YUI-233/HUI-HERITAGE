import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "../../../../../../../lib/admin-access";
import { getSignedInUser } from "../../../../../../../lib/local-auth";
import { prisma } from "../../../../../../../lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const denied = await requirePermission(request, "CATALOG_REVIEW");
  if (denied) return denied;
  const reviewer = await getSignedInUser(request);
  if (!reviewer) return Response.json({ message: "请使用有审核权限的登录账号查看申请图片。" }, { status: 401 });
  const { id, mediaId } = await params;
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      personalCollectionItemId: id,
      personalCollectionItem: { status: "PENDING", ownerId: { not: reviewer.id } },
    },
  });
  if (!media?.storageKey.startsWith("private/personal/")) return Response.json({ message: "未找到可供审核的图片。" }, { status: 404 });
  try {
    return new Response(await readFile(path.join(process.cwd(), "uploads", media.storageKey)), { headers: { "Content-Type": media.mimeType, "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "图片文件不存在。" }, { status: 404 });
  }
}
