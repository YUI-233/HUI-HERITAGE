import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type BookBibliographicMetadata = { eraDetail: string | null; publicationDate: string | null; imprintPublisher: string | null; binding: string | null; volumeCount: number; categories: string[] };
const emptyMetadata = (): BookBibliographicMetadata => ({ eraDetail: null, publicationDate: null, imprintPublisher: null, binding: null, volumeCount: 1, categories: [] });

export async function readBookBibliographicMetadata(ids: string[]) {
  const records = new Map<string, BookBibliographicMetadata>();
  if (!ids.length) return records;
  const rows = await prisma.$queryRaw<Array<BookBibliographicMetadata & { id: string }>>(Prisma.sql`SELECT id, era_detail AS "eraDetail", publication_date AS "publicationDate", imprint_publisher AS "imprintPublisher", binding, volume_count AS "volumeCount", categories FROM books WHERE id IN (${Prisma.join(ids)})`);
  for (const row of rows) records.set(row.id, { eraDetail: row.eraDetail, publicationDate: row.publicationDate, imprintPublisher: row.imprintPublisher, binding: row.binding, volumeCount: row.volumeCount, categories: row.categories ?? [] });
  return records;
}

export async function writeBookBibliographicMetadata(id: string, input: Partial<BookBibliographicMetadata>) {
  const data = { ...emptyMetadata(), ...input };
  await prisma.$executeRaw(Prisma.sql`UPDATE books SET era_detail = ${data.eraDetail}, publication_date = ${data.publicationDate}, imprint_publisher = ${data.imprintPublisher}, binding = ${data.binding}, volume_count = ${data.volumeCount}, categories = ${data.categories}::text[] WHERE id = ${id}`);
}
