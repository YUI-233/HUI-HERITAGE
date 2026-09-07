import type { CatalogRecord } from "./catalog";

/** Removes storage paths for records whose original images are not public. */
export function toPublicCatalogRecord(record: CatalogRecord) {
  return {
    id: record.id,
    catalogNumber: record.catalogNumber,
    title: record.title,
    type: record.type,
    summary: record.summary,
    date: record.date,
    source: record.source,
    keywords: record.keywords,
    imageAccess: record.imageAccess,
    image: record.imageAccess === "public" ? record.image : null,
    images: record.imageAccess === "public" ? record.images ?? [] : [],
    metadata: record.metadata ?? [],
  };
}
