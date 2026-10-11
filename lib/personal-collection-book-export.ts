import { prisma } from "./prisma";
import { createXlsxDocument } from "./xlsx";

export class BookExportError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS = [
  "编号",
  "书名",
  "作者",
  "作者年代",
  "刊刻年份",
  "刊刻时间",
  "刊刻主体",
  "版本",
  "装帧",
  "分类",
  "册数",
  "公开说明",
];

export async function exportPublicCollectionBooks(userId: string, slug: string) {
  const profile = await prisma.personalCollectionProfile.findUnique({
    where: { slug },
    select: { ownerId: true, displayName: true },
  });
  if (!profile) {
    throw new BookExportError(404, "COLLECTION_NOT_FOUND", "未找到该公开收藏馆。");
  }
  if (profile.ownerId === userId) {
    throw new BookExportError(403, "OWN_COLLECTION_EXPORT_NOT_ALLOWED", "不能通过此入口导出自己的收藏馆书单。");
  }

  const card = await prisma.borrowingCard.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!card) {
    throw new BookExportError(403, "CARD_REQUIRED", "导出书单需要先办理借阅证。");
  }
  if (card.status !== "ACTIVE") {
    throw new BookExportError(403, "CARD_INACTIVE", "当前借阅证已失效，暂不能导出书单。");
  }

  const books = await prisma.personalCollectionItem.findMany({
    where: {
      ownerId: profile.ownerId,
      type: "BOOK",
      status: "APPROVED",
      isPublic: true,
    },
    orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
    select: {
      serialNumber: true,
      title: true,
      creator: true,
      era: true,
      eraDetail: true,
      publicationDate: true,
      imprintPublisher: true,
      editionOrCategory: true,
      binding: true,
      categories: true,
      volumeCount: true,
      description: true,
    },
  });
  if (books.length === 0) {
    throw new BookExportError(404, "NO_PUBLIC_BOOKS", "该收藏馆目前没有可导出的公开书籍。");
  }

  const rows = [
    HEADERS,
    ...books.map((book) => [
      book.serialNumber,
      book.title,
      book.creator,
      book.era,
      book.eraDetail,
      book.publicationDate,
      book.imprintPublisher,
      book.editionOrCategory,
      book.binding,
      book.categories.join("；"),
      book.volumeCount,
      book.description,
    ]),
  ];
  const bytes = createXlsxDocument("公开书单", rows);
  const date = new Date().toISOString().slice(0, 10);
  const filename = profile.displayName.replace(/[\\/:*?"<>|]/g, "-") + "-公开书单-" + date + ".xlsx";

  return { bytes, filename, collectionName: profile.displayName, bookCount: books.length };
}
