import { prisma } from "../../../../../lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.personalCollectionItem.findFirst({
    where: { id, status: "APPROVED", isPublic: true },
    select: { id: true, type: true, title: true, creator: true, era: true, eraDetail: true, publicationDate: true, imprintPublisher: true, editionOrCategory: true, binding: true, categories: true, volumeCount: true, serialNumber: true, description: true, owner: { select: { displayName: true } }, media: { where: { visibility: "PUBLIC" }, select: { id: true, mimeType: true } } },
  });
  if (!item) return Response.json({ message: "未找到公开的个人收藏记录。" }, { status: 404 });
  return Response.json(item, { headers: { "Cache-Control": "public, max-age=300" } });
}
