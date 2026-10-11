import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { POST as saveRequest } from "../app/api/admin/research-requests/route";
import { GET as listReview, POST as decideReview } from "../app/api/admin/research-review/route";
import { createSessionCookie, hashPassword } from "../lib/local-auth";
import { prisma } from "../lib/prisma";

const marker = randomUUID().slice(0, 8);
const group = await prisma.userGroup.create({ data: { name: `研究审核验证-${marker}`, permissions: ["RESEARCH_WRITE", "RESEARCH_REVIEW"] } });
const passwordHash = await hashPassword(randomUUID());
const [writer, reviewer] = await Promise.all([
  prisma.user.create({ data: { email: `research-writer-${marker}@huiheritage.local`, passwordHash, groupId: group.id, isActive: true } }),
  prisma.user.create({ data: { email: `research-reviewer-${marker}@huiheritage.local`, passwordHash, groupId: group.id, isActive: true } }),
]);
let articleId: string | undefined;

try {
  const article = await prisma.researchArticle.create({ data: { title: `研究审核验证原稿-${marker}`, summary: "原稿摘要", contentHtml: "<p>原稿正文</p>", category: "古籍校对", status: "APPROVED" } });
  articleId = article.id;
  const writerCookie = createSessionCookie(writer.id).split(";")[0];
  const reviewerCookie = createSessionCookie(reviewer.id).split(";")[0];
  const draftResponse = await saveRequest(new Request("http://localhost/api/admin/research-requests", { method: "POST", headers: { cookie: writerCookie, "content-type": "application/json" }, body: JSON.stringify({
    articleId, title: `研究审核验证修订稿-${marker}`, summary: "修订摘要", contentHtml: "<p>修订正文</p>", category: "古籍校对", keywords: ["测试"], relatedRecordIds: [],
  }) }));
  assert.equal(draftResponse.status, 201);
  const draft = await draftResponse.json() as { id: string };
  // Move only this disposable request into review. Calling the real submit route
  // here would notify unrelated staff accounts in the shared local database.
  await prisma.researchReviewRequest.update({ where: { id: draft.id }, data: { status: "PENDING", requestReason: "验证修改审核列表" } });

  const ownResponse = await listReview(new Request("http://localhost/api/admin/research-review", { headers: { cookie: writerCookie } }));
  assert.equal(ownResponse.status, 200);
  const ownItems = await ownResponse.json() as { id: string; canReview: boolean }[];
  assert.equal(ownItems.find((item) => item.id === draft.id)?.canReview, false);

  const peerResponse = await listReview(new Request("http://localhost/api/admin/research-review", { headers: { cookie: reviewerCookie } }));
  assert.equal(peerResponse.status, 200);
  const peerItems = await peerResponse.json() as { id: string; canReview: boolean; title: string; contentHtml: string; original?: { title: string; summary: string; contentHtml: string } | null }[];
  const peerItem = peerItems.find((item) => item.id === draft.id);
  assert.equal(peerItem?.canReview, true);
  assert.equal(peerItem?.original?.title, `研究审核验证原稿-${marker}`);
  assert.equal(peerItem?.original?.summary, "原稿摘要");
  assert.equal(peerItem?.original?.contentHtml, "<p>原稿正文</p>");
  assert.equal(peerItem?.title, `研究审核验证修订稿-${marker}`);
  assert.equal(peerItem?.contentHtml, "<p>修订正文</p>");

  const selfReview = await decideReview(new Request("http://localhost/api/admin/research-review", { method: "POST", headers: { cookie: writerCookie, "content-type": "application/json" }, body: JSON.stringify({ id: draft.id, decision: "APPROVED" }) }));
  assert.equal(selfReview.status, 400);
  const peerReview = await decideReview(new Request("http://localhost/api/admin/research-review", { method: "POST", headers: { cookie: reviewerCookie, "content-type": "application/json" }, body: JSON.stringify({ id: draft.id, decision: "REJECTED", comment: "验证完成" }) }));
  assert.equal(peerReview.status, 200);
  assert.equal((await prisma.researchReviewRequest.findUnique({ where: { id: draft.id }, select: { status: true } }))?.status, "REJECTED");
  console.log("research_review_ok=original_and_revision_visible,own_request_readonly,peer_can_review,self_review_denied");
} finally {
  if (articleId) await prisma.researchArticle.delete({ where: { id: articleId } });
  await prisma.user.deleteMany({ where: { id: { in: [writer.id, reviewer.id] } } });
  await prisma.userGroup.delete({ where: { id: group.id } });
  await prisma.$disconnect();
}
