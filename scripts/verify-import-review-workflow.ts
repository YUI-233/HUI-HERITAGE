import { createImportBatch, getImportBatchAuditReport, getImportBatchPreview, resubmitImportBatch, reviewImportBatch } from "../lib/import-review-workflow";
import { prisma } from "../lib/prisma";

const title = `同伴审核验收 ${Date.now()}`;
const institution = `审核验收机构 ${Date.now()}`;
const submitterEmail = `workflow-submitter-${Date.now()}@huiheritage.local`;
const reviewerEmail = `workflow-reviewer-${Date.now()}@huiheritage.local`;

async function cleanup() {
  const books = await prisma.book.findMany({ where: { title }, select: { id: true } });
  const ids = books.map((book) => book.id);
  if (ids.length) {
    await prisma.holding.deleteMany({ where: { bookId: { in: ids } } });
    await prisma.book.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.importBatch.deleteMany({ where: { sourceCsv: { contains: institution } } });
  await prisma.user.deleteMany({ where: { email: { in: [submitterEmail, reviewerEmail] } } });
}

async function main() {
  await cleanup();
  const book = await prisma.book.create({ data: { title, status: "DRAFT" } });
  const csv = `关联资料类型,关联资料编号,收藏机构,地区,来源类型,索书号／版本,馆方目录链接,馆藏说明,发布状态\n古籍,${book.id},${institution},验收地区,国内馆藏,TEST-PEER-001,https://example.com,同伴审核验收,公开\n`;
  const [submitter, reviewer] = await Promise.all([
    prisma.user.create({ data: { email: submitterEmail } }),
    prisma.user.create({ data: { email: reviewerEmail } }),
  ]);
  let missingReferenceDenied = false;
  try { await createImportBatch(undefined, csv.replace(book.id, "missing-reference-id"), submitter.id); } catch { missingReferenceDenied = true; }
  if (!missingReferenceDenied) throw new Error("Batch with a missing catalogue reference was accepted.");
  const batch = await createImportBatch(undefined, csv, submitter.id);
  const preview = await getImportBatchPreview(batch.id);
  if (preview.preview.total !== 1 || preview.preview.rows[0]?.institution !== institution) throw new Error("Reviewer preview did not return staged CSV rows.");
  let sameAccountDenied = false;
  try { await reviewImportBatch(batch.id, undefined, "REJECTED", "同一账号不得自审", submitter.id); } catch { sameAccountDenied = true; }
  if (!sameAccountDenied) throw new Error("The submitting account was allowed to review its own batch.");
  const revision = await reviewImportBatch(batch.id, undefined, "NEEDS_REVISION", "请补充说明", reviewer.id);
  if (revision.batch.status !== "NEEDS_REVISION" || revision.batch.reviewedByUserId !== reviewer.id) throw new Error("Qualified peer review was not stored.");
  const resubmitted = await resubmitImportBatch(batch.id, undefined, csv, submitter.id);
  if (resubmitted.status !== "PENDING") throw new Error("Resubmission did not return the batch to pending review.");
  const reviewed = await reviewImportBatch(batch.id, undefined, "APPROVED", "验收通过", reviewer.id);
  if (reviewed.batch.status !== "APPROVED" || reviewed.applied.created !== 1) throw new Error("Peer review approval did not write the expected holding.");
  const holding = await prisma.holding.findFirst({ where: { bookId: book.id, institution } });
  if (!holding || holding.status !== "APPROVED") throw new Error("Approved holding was not stored.");
  const duplicatePreview = await getImportBatchPreview(batch.id);
  if (duplicatePreview.duplicateCandidates[0]?.row !== 2) throw new Error("Duplicate candidate was not reported to the reviewer.");
  const auditReport = await getImportBatchAuditReport(batch.id);
  if (!auditReport.includes("流程")) throw new Error("Audit report did not include the review history.");
  const events = await prisma.importBatchEvent.findMany({ where: { batchId: batch.id }, select: { action: true, lane: true } });
  if (events.map((event) => event.action).join(",") !== "SUBMITTED,NEEDS_REVISION,RESUBMITTED,APPROVED") throw new Error("Workflow history was not preserved.");
  if (events.some((event) => event.lane !== null)) throw new Error("Legacy lane values were written into new review events.");
  await cleanup();
  console.log("import_peer_review_ok=missing_reference_denied,self_review_denied,peer_reviewed,resubmitted,peer_approved,audit_export,cleaned");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
