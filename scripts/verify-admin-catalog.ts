import { POST } from "../app/api/admin/catalog/route";
import { POST as saveHolding } from "../app/api/admin/holdings/route";
import { POST as saveResearch } from "../app/api/admin/research/route";
import { prisma } from "../lib/prisma";

process.env.ADMIN_LOCAL_TOKEN = "verification-only-token";

const verificationBookTitle = "管理员写入验收临时记录";
const verificationResearchTitle = "管理员研究资料验收";

async function cleanupVerificationRecords() {
  const books = await prisma.book.findMany({ where: { title: verificationBookTitle }, select: { id: true } });
  const ids = books.map((book) => book.id);
  await prisma.researchArticle.deleteMany({ where: { title: verificationResearchTitle } });
  if (ids.length) {
    await prisma.holding.deleteMany({ where: { bookId: { in: ids } } });
    await prisma.book.deleteMany({ where: { id: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
  }
}

async function main() {
  await cleanupVerificationRecords();
  const response = await POST(new Request("http://localhost/api/admin/catalog", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-local-token": "verification-only-token" },
    body: JSON.stringify({ type: "manuscript", title: verificationBookTitle, dynasty: "清代", versionType: "验收草稿", source: "自动验收", keywords: ["验收", "临时"], status: "DRAFT" }),
  }));
  const result = await response.json() as { id?: string };
  if (response.status !== 201 || !result.id) throw new Error("Admin catalogue creation was not accepted.");
  const record = await prisma.book.findUnique({ where: { id: result.id } });
  if (!record || record.status !== "DRAFT" || !record.keywords.includes("验收")) throw new Error("Admin catalogue record was not stored correctly.");
  const holdingResponse = await saveHolding(new Request("http://localhost/api/admin/holdings", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-local-token": "verification-only-token" },
    body: JSON.stringify({ recordType: "manuscript", recordId: result.id, institution: "验收收藏机构", region: "验收地区", origin: "DOMESTIC", status: "DRAFT" }),
  }));
  const holding = await holdingResponse.json() as { id?: string };
  if (holdingResponse.status !== 201 || !holding.id) throw new Error("Admin holding creation was not accepted.");
  const researchResponse = await saveResearch(new Request("http://localhost/api/admin/research", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-local-token": "verification-only-token" },
    body: JSON.stringify({ title: verificationResearchTitle, category: "验收", summary: "验证研究资料写入与关联馆藏。", relatedRecordIds: [result.id], status: "DRAFT" }),
  }));
  const research = await researchResponse.json() as { id?: string };
  if (researchResponse.status !== 201 || !research.id) throw new Error("Admin research creation was not accepted.");
  await cleanupVerificationRecords();
  console.log("admin_catalog_write_ok=created,verified,cleaned");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
