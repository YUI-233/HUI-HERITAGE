import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "../../../../../../../lib/admin-access";
import { prisma } from "../../../../../../../lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  const { id, mediaId } = await params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: mediaId, OR: [{ bookId: id }, { artifactId: id }] } });
  if (!asset) return Response.json({ message: "未找到审核附件。" }, { status: 404 });
  const root = asset.storageKey.startsWith("private/") ? path.join(process.cwd(), "uploads") : path.join(process.cwd(), "public");
  try {
    return new Response(await readFile(path.join(root, asset.storageKey)), { headers: { "Content-Type": asset.mimeType, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ message: "附件文件暂不可用。" }, { status: 404 });
  }
}
