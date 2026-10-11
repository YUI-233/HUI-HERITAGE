import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as submitCatalog } from "../app/api/admin/catalog/route";
import { POST as reviewCatalog } from "../app/api/admin/catalog-review/route";
import { GET as reviewDetail } from "../app/api/admin/catalog-review/[id]/route";
import { ReviewChanges } from "../app/admin/catalog-review/review-changes";
import { createSessionCookie, hashPassword } from "../lib/local-auth";
import { prisma } from "../lib/prisma";

const suffix = Date.now().toString(36);
const groupName = `目录审核验收组 ${suffix}`;
const writerEmail = `catalog-writer-${suffix}@huiheritage.local`;
const reviewerEmail = `catalog-reviewer-${suffix}@huiheritage.local`;
const title = `审核验收古籍-${suffix}`;

const diffHtml = renderToStaticMarkup(createElement(ReviewChanges, { detail: {
  type: "artifact", title: "新题名", category: "瓷器", description: null,
  media: [{ id: "kept", mimeType: "image/jpeg" }, { id: "added", mimeType: "application/pdf" }],
  baseline: { title: "旧题名", category: "铜器", description: "旧备注", media: [{ id: "kept", mimeType: "image/jpeg" }, { id: "removed", mimeType: "image/png" }] },
} }));
assert.match(diffHtml, /修改前后对比/);
assert.match(diffHtml, /新题名/);
assert.match(diffHtml, /旧题名/);
assert.match(diffHtml, /已删除/);
assert.match(diffHtml, /新增 1 个 · 删除 1 个 · 保留 1 个/);
assert.equal(renderToStaticMarkup(createElement(ReviewChanges, { detail: { type: "artifact", title: "新建", media: [] } })), "");

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
    const peerReview = await reviewCatalog(new Request("http://localhost/api/admin/catalog-review", { method: "POST", headers: { "content-type": "application/json", cookie: reviewerCookie }, body: JSON.stringify({ id: record.id, type: "manuscript", decision: "APPROVED", confirmedViewed: true, comment: "资料核验通过" }) }));
    assert.equal(peerReview.status, 200);
    const reviewed = await prisma.book.findUnique({ where: { id: record.id } });
    assert.equal(reviewed?.status, "APPROVED");
    assert.equal(reviewed?.submittedByUserId, writer.id);
    assert.equal(reviewed?.reviewedByUserId, reviewer.id);
    assert.equal(reviewed?.submittedByLane, null);
    assert.equal(reviewed?.reviewerLane, null);
    const edited = await submitCatalog(new Request("http://localhost/api/admin/catalog", { method: "POST", headers: { "content-type": "application/json", cookie: writerCookie }, body: JSON.stringify({ id: record.id, type: "manuscript", title: `${title}-修订`, author: "新增作者", status: "PENDING" }) }));
    assert.equal(edited.status, 200);
    const detail = await reviewDetail(new Request(`http://localhost/api/admin/catalog-review/${record.id}?type=manuscript`, { headers: { cookie: reviewerCookie } }), { params: Promise.resolve({ id: record.id }) });
    assert.equal(detail.status, 200);
    const comparison = await detail.json() as { title: string; author: string; baseline: { title: string; author: string | null; media: unknown[] } };
    assert.equal(comparison.baseline.title, title);
    assert.equal(comparison.baseline.author, null);
    assert.equal(comparison.title, `${title}-修订`);
    assert.equal(comparison.author, "新增作者");
    assert.deepEqual(comparison.baseline.media, []);
    console.log("catalog_peer_review_ok=self_review_denied,qualified_peer_approved");
  } finally {
    await prisma.book.deleteMany({ where: { title: { startsWith: title } } });
    await prisma.user.deleteMany({ where: { email: { in: [writerEmail, reviewerEmail] } } });
    await prisma.userGroup.delete({ where: { id: group.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
