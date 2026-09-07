import { prisma } from "../lib/prisma";
import { getHoldingById } from "../lib/holdings-repository";
import { reviewHoldingRevision, submitHoldingDeletion } from "../lib/holding-revision-workflow";

const suffix = Date.now().toString();

async function main() {
  const submitter = await prisma.user.create({ data: { email: `holding-delete-submitter-${suffix}@huiheritage.local`, passwordHash: "verification" } });
  const reviewer = await prisma.user.create({ data: { email: `holding-delete-reviewer-${suffix}@huiheritage.local`, passwordHash: "verification" } });
  const book = await prisma.book.create({ data: { title: `馆藏删除验收 ${suffix}`, status: "APPROVED" } });
  const holding = await prisma.holding.create({
    data: { institution: "删除流程验收馆", region: "验收地区", origin: "DOMESTIC", status: "APPROVED", bookId: book.id },
  });

  try {
    const request = await submitHoldingDeletion(holding.id, "重复馆藏记录，申请删除。", submitter.id);
    if (request.action !== "DELETE" || request.status !== "PENDING" || request.requestReason !== "重复馆藏记录，申请删除。") {
      throw new Error("Deletion request was not stored as a pending auditable request.");
    }

    const approved = await reviewHoldingRevision(request.id, "APPROVED", "核对重复记录后同意删除。", reviewer.id);
    if (approved.status !== "APPROVED") throw new Error("Deletion request was not approved.");

    const archived = await prisma.holding.findUniqueOrThrow({ where: { id: holding.id }, select: { status: true } });
    if (archived.status !== "ARCHIVED") throw new Error("Approved deletion did not archive the holding.");
    if (await getHoldingById(holding.id)) throw new Error("Archived holding is still available through the public holding detail repository.");
    console.log("holding_deletion_workflow_ok=pending,peer-review,archive,public-hidden");
  } finally {
    await prisma.book.delete({ where: { id: book.id } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [submitter.id, reviewer.id] } } }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
