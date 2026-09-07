import assert from "node:assert/strict";
import { POST as submitCatalog } from "../app/api/admin/catalog/route";
import { POST as reviewCatalog } from "../app/api/admin/catalog-review/route";
import { createSessionCookie, hashPassword } from "../lib/local-auth";
import { prisma } from "../lib/prisma";

const suffix = Date.now().toString(36);
const groupName = `目录审核验收组 ${suffix}`;
const writerEmail = `catalog-writer-${suffix}@huiheritage.local`;
const reviewerEmail = `catalog-reviewer-${suffix}@huiheritage.local`;
const title = `审核验收古籍-${suffix}`;

async function main() {
  const group = await prisma.userGroup.create({ data: { name: groupName, permissions: ["CATALOG_WRITE", "CATALOG_REVIEW"] } });
  const passwordHash = await hashPassword("catalog-verification-password");
  const [writer, reviewer] = await Promise.all([
    prisma.user.create({ data: { email: writerEmail, passwordHash, groupId: group.id, isActive: true } }),
    prisma.user.create({ data: { email: reviewerEmail, passwordHash, groupId: group.id, isActive: true } }),
  ]);
  try {
    const writerCookie = createSessionCookie(writer.id).split(";")[0];
    const reviewerCookie = createSessionCookie(reviewer.id).split(";")[0];
    const submit = await submitCatalog(new Request("http://localhost/api/admin/catalog", { method: "POST", headers: { "content-type": "application/json", cookie: writerCookie }, body: JSON.stringify({ type: "manuscript", title, status: "PENDING" }) }));
    assert.equal(submit.status, 201);
    const record = await submit.json() as { id: string };
    const selfReview = await reviewCatalog(new Request("http://localhost/api/admin/catalog-review", { method: "POST", headers: { "content-type": "application/json", cookie: writerCookie }, body: JSON.stringify({ id: record.id, type: "manuscript", decision: "APPROVED" }) }));
    assert.equal(selfReview.status, 400);
    const peerReview = await reviewCatalog(new Request("http://localhost/api/admin/catalog-review", { method: "POST", headers: { "content-type": "application/json", cookie: reviewerCookie }, body: JSON.stringify({ id: record.id, type: "manuscript", decision: "APPROVED", comment: "资料核验通过" }) }));
    assert.equal(peerReview.status, 200);
    const reviewed = await prisma.book.findUnique({ where: { id: record.id } });
    assert.equal(reviewed?.status, "APPROVED");
    assert.equal(reviewed?.submittedByUserId, writer.id);
    assert.equal(reviewed?.reviewedByUserId, reviewer.id);
    assert.equal(reviewed?.submittedByLane, null);
    assert.equal(reviewed?.reviewerLane, null);
    console.log("catalog_peer_review_ok=self_review_denied,qualified_peer_approved");
  } finally {
    await prisma.book.deleteMany({ where: { title } });
    await prisma.user.deleteMany({ where: { email: { in: [writerEmail, reviewerEmail] } } });
    await prisma.userGroup.delete({ where: { id: group.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
