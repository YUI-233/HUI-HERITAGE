import { requirePermission } from "../../../../../lib/admin-access";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "manuscript" && type !== "artifact") return Response.json({ message: "缺少资料类型。" }, { status: 400 });
  const media = { orderBy: { createdAt: "asc" } as const, select: { id: true, mimeType: true, storageKey: true, visibility: true } };
  const record = type === "manuscript"
    ? await prisma.book.findFirst({ where: { id, status: "PENDING" }, include: { media } })
    : await prisma.artifact.findFirst({ where: { id, status: "PENDING" }, include: { media } });
  if (!record) return Response.json({ message: "未找到待审核资料。" }, { status: 404 });
  return Response.json({ ...record, type }, { headers: { "Cache-Control": "no-store" } });
}
