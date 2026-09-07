import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/local-auth";

const baseUrl = process.env.PERSONAL_COLLECTION_VERIFY_URL ?? "http://localhost:3014";
const suffix = Date.now();
const authorEmail = `personal-author-${suffix}@example.local`;
const reviewerEmail = `personal-reviewer-${suffix}@example.local`;

async function request(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

async function registerAndLogin(email: string, displayName: string) {
  const password = "PersonalPublication!2026";
  const registration = await request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, displayName }) });
  if (!registration.ok) throw new Error(`Registration failed: ${registration.status}`);
  const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!login.ok || !cookie) throw new Error("Login failed.");
  return cookie;
}

async function main() {
  let groupId = "";
  try {
    const authorCookie = await registerAndLogin(authorEmail, "公开申请验收作者");
    const reviewerCookie = await registerAndLogin(reviewerEmail, "公开申请验收审核员");
    const group = await prisma.userGroup.create({ data: { name: `公开个人藏书审核组 ${suffix}`, permissions: ["CATALOG_REVIEW"] } }); groupId = group.id;
    await prisma.user.update({ where: { email: reviewerEmail }, data: { groupId } });

    const created = await request("/api/personal-collection/items", { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ type: "BOOK", title: `公开藏书工作流验收 ${suffix}`, creator: "验收作者", categories: ["1.1.1 古兰经翻译、注释"], description: "用于验证个人藏书公开申请、审核和公开图片。" }) });
    const item = await created.json() as { id?: string; status?: string; isPublic?: boolean };
    if (!created.ok || !item.id || item.status !== "DRAFT" || item.isPublic) throw new Error(`Draft creation failed: ${JSON.stringify(item)}`);

    const noPhotoApplication = await request(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "APPLY_PUBLIC" }) });
    const noPhotoBody = await noPhotoApplication.json() as { message?: string }; if (noPhotoApplication.ok || !noPhotoBody.message?.includes("请最少上传一张图片")) throw new Error(`Photo requirement failed: ${JSON.stringify(noPhotoBody)}`);
    const noPhotoBook = await request("/api/personal-collection/items", { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ type: "BOOK", title: `无图片批量跳过 ${suffix}`, creator: "验收作者" }) });
    if (!noPhotoBook.ok) throw new Error(`No-photo batch record creation failed: ${await noPhotoBook.text()}`);

    const imageForm = new FormData(); imageForm.set("file", new File([new Uint8Array([137, 80, 78, 71])], "proof.png", { type: "image/png" }));
    const upload = await request(`/api/personal-collection/items/${item.id}/media`, { method: "POST", headers: { cookie: authorCookie }, body: imageForm });
    const media = await upload.json() as { id?: string; message?: string }; if (!upload.ok || !media.id) throw new Error(`Private image upload failed: ${JSON.stringify(media)}`);

    const submitted = await request("/api/personal-collection/items/publication", { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "APPLY_BOOKS" }) });
    const submittedBody = await submitted.json() as { submitted?: number; skippedWithoutImage?: number; reviewersNotified?: number }; if (!submitted.ok || submittedBody.submitted !== 1 || submittedBody.skippedWithoutImage !== 1 || !submittedBody.reviewersNotified) throw new Error(`Batch publication request failed: ${JSON.stringify(submittedBody)}`);
    const reviewerNotices = await request("/api/notifications", { headers: { cookie: reviewerCookie } }); const reviewerNoticeBody = await reviewerNotices.json() as { unreadCount?: number }; if (!reviewerNotices.ok || !reviewerNoticeBody.unreadCount) throw new Error("Reviewer did not receive the publication notification.");
    const beforeApproval = await request(`/api/personal-collection/public/${item.id}`); if (beforeApproval.status !== 404) throw new Error("Pending item was publicly readable.");

    const queue = await request("/api/admin/personal-submissions", { headers: { cookie: reviewerCookie } });
    const queueBody = await queue.json() as Array<{ id: string; media: Array<{ id: string }> }>; const queued = queueBody.find((entry) => entry.id === item.id); if (!queue.ok || !queued || queued.media[0]?.id !== media.id) throw new Error("Peer reviewer could not see the pending request and image.");
    const reviewImage = await request(`/api/admin/personal-submissions/${item.id}/media/${media.id}`, { headers: { cookie: reviewerCookie } }); if (!reviewImage.ok) throw new Error("Peer reviewer could not access the review image.");
    const withdrawn = await request(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "WITHDRAW" }) });
    const withdrawnBody = await withdrawn.json() as { status?: string }; if (!withdrawn.ok || withdrawnBody.status !== "DRAFT") throw new Error(`Withdrawal failed: ${JSON.stringify(withdrawnBody)}`);
    const resubmitted = await request(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "APPLY_PUBLIC" }) });
    const resubmittedBody = await resubmitted.json() as { status?: string }; if (!resubmitted.ok || resubmittedBody.status !== "PENDING") throw new Error(`Single publication request failed: ${JSON.stringify(resubmittedBody)}`);
    const supplement = await request("/api/admin/personal-submissions", { method: "POST", headers: { "Content-Type": "application/json", cookie: reviewerCookie }, body: JSON.stringify({ id: item.id, decision: "NEEDS_REVISION", comment: "补充图片" }) });
    if (!supplement.ok) throw new Error(`Supplement request failed: ${await supplement.text()}`);
    const authorNotices = await request("/api/notifications", { headers: { cookie: authorCookie } }); const authorNoticeBody = await authorNotices.json() as { notifications?: Array<{ message: string }> }; if (!authorNotices.ok || !authorNoticeBody.notifications?.some((notice) => notice.message.includes("补充图片"))) throw new Error("Author could not see the supplement reason in notifications.");
    const finalSubmission = await request(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "APPLY_PUBLIC" }) });
    if (!finalSubmission.ok) throw new Error(`Resubmission after supplement failed: ${await finalSubmission.text()}`);
    const approved = await request("/api/admin/personal-submissions", { method: "POST", headers: { "Content-Type": "application/json", cookie: reviewerCookie }, body: JSON.stringify({ id: item.id, decision: "APPROVED", comment: "资料核验通过" }) });
    const approvedBody = await approved.json() as { status?: string; isPublic?: boolean }; if (!approved.ok || approvedBody.status !== "APPROVED" || !approvedBody.isPublic) throw new Error(`Peer approval failed: ${JSON.stringify(approvedBody)}`);

    const publicItem = await request(`/api/personal-collection/public/${item.id}`); const publicBody = await publicItem.json() as { media?: Array<{ id: string }> }; if (!publicItem.ok || publicBody.media?.[0]?.id !== media.id) throw new Error("Approved public item or image was not readable.");
    const publicImage = await request(`/api/personal-collection/public/${item.id}/media/${media.id}`); if (!publicImage.ok) throw new Error("Approved public image was not readable.");
    const holdingSearch = await request(`/api/holdings?origin=PERSONAL&q=${encodeURIComponent(`公开藏书工作流验收 ${suffix}`)}`);
    const holdingBody = await holdingSearch.json() as { total?: number; records?: Array<{ record?: { id?: string } }> };
    if (!holdingSearch.ok || holdingBody.total !== 1 || holdingBody.records?.[0]?.record?.id !== item.id) throw new Error(`Approved personal item was not searchable in holdings: ${JSON.stringify(holdingBody)}`);

    const hidden = await request(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json", cookie: authorCookie }, body: JSON.stringify({ action: "SET_PRIVATE" }) });
    if (!hidden.ok) throw new Error("Hide action failed.");
    const hiddenItem = await request(`/api/personal-collection/public/${item.id}`); if (hiddenItem.status !== 404) throw new Error("Hidden item remained publicly readable.");
    console.log("personal_publication_ok=photo-required,batch-skips-no-photo,private-image,batch-apply,review-notice,review-image,withdraw,single-apply,supplement-notice,peer-review,auto-public,holdings-search,public-image,withdraw-public");
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [authorEmail, reviewerEmail] } } });
    if (groupId) await prisma.userGroup.delete({ where: { id: groupId } }).catch(() => undefined);
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
