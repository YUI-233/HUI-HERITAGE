import { prisma } from "./prisma";

export type CatalogKind = "manuscript" | "artifact";
export type CatalogReviewSnapshot = {
  title: string;
  language?: string | null; author?: string | null; dynasty?: string | null;
  eraDetail?: string | null; publicationDate?: string | null; imprintPublisher?: string | null;
  versionType?: string | null; binding?: string | null; volumeCount?: number | null;
  categories?: string[]; category?: string | null; era?: string | null; material?: string | null;
  description?: string | null; source?: string | null; keywords?: string[];
  media: { id: string; mimeType: string }[];
};

const entityType = (type: CatalogKind) => type === "manuscript" ? "BOOK" : "ARTIFACT";

export async function getCatalogReviewBaseline(type: CatalogKind, id: string, reviewedAt: Date | null) {
  const event = await prisma.auditEvent.findFirst({
    where: { entityType: entityType(type), entityId: id, action: "CATALOG_REVIEW_BASELINE", ...(reviewedAt ? { createdAt: { gt: reviewedAt } } : {}) },
    orderBy: { id: "desc" }, select: { payload: true },
  });
  if (!event || !event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return null;
  const payload = event.payload as Record<string, unknown>;
  return payload.snapshot as CatalogReviewSnapshot | undefined ?? null;
}

export async function ensureCatalogReviewBaseline(type: CatalogKind, id: string) {
  let snapshot: CatalogReviewSnapshot;
  if (type === "manuscript") {
    const book = await prisma.book.findUnique({ where: { id }, include: { media: { select: { id: true, mimeType: true } } } });
    if (!book || book.status !== "APPROVED" || await getCatalogReviewBaseline(type, id, book.reviewedAt)) return;
    snapshot = { title: book.title, language: book.language, author: book.author, dynasty: book.dynasty,
      eraDetail: book.eraDetail, publicationDate: book.publicationDate, imprintPublisher: book.imprintPublisher,
      versionType: book.versionType, binding: book.binding, volumeCount: book.volumeCount,
      categories: book.categories, description: book.description, source: book.source, keywords: book.keywords, media: book.media };
  } else {
    const artifact = await prisma.artifact.findUnique({ where: { id }, include: { media: { select: { id: true, mimeType: true } } } });
    if (!artifact || artifact.status !== "APPROVED" || await getCatalogReviewBaseline(type, id, artifact.reviewedAt)) return;
    snapshot = { title: artifact.title, category: artifact.category, era: artifact.era, material: artifact.material,
      description: artifact.description, source: artifact.source, keywords: artifact.keywords, media: artifact.media };
  }
  await prisma.auditEvent.create({ data: { entityType: entityType(type), entityId: id, action: "CATALOG_REVIEW_BASELINE", payload: { snapshot } } });
}
