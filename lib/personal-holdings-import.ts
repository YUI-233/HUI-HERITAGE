import { parsePersonalHoldingImport } from "./catalog-import-preview";
import { prisma } from "./prisma";

export async function importPersonalHoldingsCsv(input: string) {
  const rows = parsePersonalHoldingImport(input);
  let created = 0; let skipped = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const existingBook = await tx.book.findFirst({
        where: { title: row.title, author: row.author ?? null, source: "个人馆藏 CSV 导入" },
        select: { id: true },
      });
      const book = existingBook ?? await tx.book.create({ data: { title: row.title, author: row.author, dynasty: row.dynasty, versionType: row.versionType, source: "个人馆藏 CSV 导入", status: row.status } });
      const existingHolding = await tx.holding.findFirst({
        where: { bookId: book.id, institution: row.institution, region: row.region, callNumber: row.callNumber ?? null, origin: "PERSONAL" },
        select: { id: true },
      });
      if (existingHolding) { skipped += 1; return; }
      await tx.holding.create({ data: { bookId: book.id, institution: row.institution, region: row.region, origin: "PERSONAL", callNumber: row.callNumber, catalogUrl: row.catalogUrl, description: row.description, status: row.status } });
      created += 1;
    });
  }
  return { total: rows.length, created, skipped };
}
