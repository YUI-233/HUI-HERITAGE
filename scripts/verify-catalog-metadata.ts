import { getCatalogRecord } from "../lib/catalog-repository";
import { prisma } from "../lib/prisma";

const title = `书目信息验收 ${Date.now()}`;

async function main() {
  const book = await prisma.book.create({ data: { title, author: "验收作者", dynasty: "清代", versionType: "验收刻本", source: "本地验收", keywords: ["验收"], status: "APPROVED" } });
  try {
    const record = await getCatalogRecord(book.id);
    const fields = record?.metadata?.map((item) => `${item.label}:${item.value}`).join("|") ?? "";
    if (!fields.includes("作者:验收作者") || !fields.includes("版本类型:验收刻本")) throw new Error("Catalogue detail metadata was not mapped from the database.");
    console.log("catalog_metadata_ok=author,dynasty,version_type");
  } finally {
    await prisma.book.delete({ where: { id: book.id } });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
