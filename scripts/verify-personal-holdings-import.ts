import { importPersonalHoldingsCsv } from "../lib/personal-holdings-import";
import { prisma } from "../lib/prisma";

const title = `个人馆藏 CSV 验收 ${Date.now()}`;
const csv = `书名,作者,年代,版本,收藏机构,地区,索书号／版本,馆方目录链接,馆藏说明,提交状态\n${title},验收作者,当代,验收版,验收个人收藏,验收地区,TEST-001,https://example.com,自动验收记录,提交\n`;

async function cleanup() {
  const books = await prisma.book.findMany({ where: { title }, select: { id: true } });
  const ids = books.map((book) => book.id);
  if (ids.length) {
    await prisma.holding.deleteMany({ where: { bookId: { in: ids } } });
    await prisma.book.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  await cleanup();
  const first = await importPersonalHoldingsCsv(csv);
  if (first.created !== 1 || first.skipped !== 0) throw new Error("Personal CSV record was not created.");
  const record = await prisma.holding.findFirst({ where: { institution: "验收个人收藏", origin: "PERSONAL", book: { title } }, include: { book: true } });
  if (!record?.book || record.status !== "PENDING" || record.book.status !== "PENDING") throw new Error("Personal CSV submission state was not stored correctly.");
  const second = await importPersonalHoldingsCsv(csv);
  if (second.created !== 0 || second.skipped !== 1) throw new Error("Personal CSV duplicate protection failed.");
  await cleanup();
  console.log("personal_holdings_import_ok=created,pending,deduplicated,cleaned");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
