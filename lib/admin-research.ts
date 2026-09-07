import { ReviewStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { notifyUsers, researchReviewers } from "./notifications";
import { prisma } from "./prisma";

export type ResearchInput = { requestId?: string; articleId?: string; title: string; author?: string; affiliation?: string; publication?: string; publishedYear?: string; volumeIssue?: string; pages?: string; identifier?: string; summary: string; contentHtml: string; category: string; keywords: string[]; relatedRecordIds: string[] };
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown) => Array.isArray(value) ? value.map((item) => text(item, 120)).filter(Boolean).slice(0, 30) : [];
const sanitizeHtml = (value: string) => value
  .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
  .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  .replace(/\s+(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "");
const requestFields = (input: { title: string; author?: string | null; affiliation?: string | null; publication?: string | null; publishedYear?: string | null; volumeIssue?: string | null; pages?: string | null; identifier?: string | null; summary: string; contentHtml: string; category: string; keywords: string[]; relatedRecordIds: string[] }) => ({ title: input.title, author: input.author ?? undefined, publication: input.publication ?? undefined, publishedYear: input.publishedYear ?? undefined, volumeIssue: input.volumeIssue ?? undefined, pages: input.pages ?? undefined, identifier: input.identifier ?? undefined, summary: input.summary, contentHtml: input.contentHtml, category: input.category, keywords: input.keywords, relatedRecordIds: input.relatedRecordIds });
const requestDelegate = () => (prisma as unknown as { researchReviewRequest?: typeof prisma.researchReviewRequest }).researchReviewRequest;
const rawQuery = <T>(sql: string, ...values: unknown[]) => (prisma as unknown as { $queryRawUnsafe: (query: string, ...args: unknown[]) => Promise<T> }).$queryRawUnsafe(sql, ...values);
const saveAffiliation = (table: "research_articles" | "research_review_requests", id: string, affiliation: string | undefined | null) => rawQuery(`UPDATE ${table} SET affiliation=$1 WHERE id=$2`, affiliation || null, id);
const readAffiliation = async (table: "research_articles" | "research_review_requests", id: string) => (await rawQuery<Array<{ affiliation: string | null }>>(`SELECT affiliation FROM ${table} WHERE id=$1`, id))[0]?.affiliation ?? null;

export function parseResearchInput(value: unknown): ResearchInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>; const title = text(body.title, 200), summary = text(body.summary, 5000), category = text(body.category, 120), contentHtml = sanitizeHtml(text(body.contentHtml, 200000));
  if (!title || !summary || !category || !contentHtml || contentHtml === "<p></p>") return null;
  return { requestId: text(body.requestId, 100) || undefined, articleId: text(body.articleId, 100) || undefined, title, summary, contentHtml, category, author: text(body.author, 160) || undefined, affiliation: text(body.affiliation, 300) || undefined, publication: text(body.publication, 300) || undefined, publishedYear: text(body.publishedYear, 40) || undefined, volumeIssue: text(body.volumeIssue, 80) || undefined, pages: text(body.pages, 80) || undefined, identifier: text(body.identifier, 500) || undefined, keywords: list(body.keywords), relatedRecordIds: list(body.relatedRecordIds) };
}

export async function listApprovedResearchForEditing() {
  const articles = await prisma.researchArticle.findMany({ where: { status: "APPROVED" }, orderBy: { updatedAt: "desc" } });
  const affiliations = await rawQuery<Array<{ id: string; affiliation: string | null }>>("SELECT id, affiliation FROM research_articles WHERE status='APPROVED'");
  const affiliationById = new Map(affiliations.map((item) => [item.id, item.affiliation]));
  return articles.map((article) => ({ ...article, affiliation: affiliationById.get(article.id) ?? null }));
}
export async function saveResearchDraft(input: ResearchInput, userId: string) {
  const action = input.articleId ? "UPDATE" : "CREATE";
  if (input.articleId && !await prisma.researchArticle.findFirst({ where: { id: input.articleId, status: "APPROVED" }, select: { id: true } })) throw new Error("未找到可编辑的已审核研究资料。");
  const data = { ...requestFields(input), articleId: input.articleId ?? null, action, submittedByUserId: userId, status: "DRAFT" as ReviewStatus };
  const delegate = requestDelegate();
  if (!delegate) {
    const id = input.requestId || randomUUID();
    const rows = await rawQuery<Array<{ id: string }>>(input.requestId
      ? `UPDATE research_review_requests SET article_id=$1, action=$2, title=$3, author=$4, publication=$5, summary=$6, content_html=$7, category=$8, keywords=$9::text[], related_record_ids=$10::text[], updated_at=NOW() WHERE id=$11 AND submitted_by_user_id=$12 AND status IN ('DRAFT','NEEDS_REVISION') RETURNING id`
      : `INSERT INTO research_review_requests (id, article_id, action, title, author, publication, summary, content_html, category, keywords, related_record_ids, status, submitted_by_user_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],$11::text[],'DRAFT',$12,NOW(),NOW()) RETURNING id`,
      ...(input.requestId ? [input.articleId ?? null, action, input.title, input.author ?? null, input.publication ?? null, input.summary, input.contentHtml, input.category, input.keywords, input.relatedRecordIds, id, userId] : [id, input.articleId ?? null, action, input.title, input.author ?? null, input.publication ?? null, input.summary, input.contentHtml, input.category, input.keywords, input.relatedRecordIds, userId]));
    if (!rows[0]) throw new Error("该草稿无法继续编辑。");
    return { id: rows[0].id };
  }
  if (!input.requestId) { const created = await delegate.create({ data }); await saveAffiliation("research_review_requests", created.id, input.affiliation); return created; }
  const existing = await delegate.findFirst({ where: { id: input.requestId, submittedByUserId: userId, status: { in: ["DRAFT", "NEEDS_REVISION"] } } });
  if (!existing) throw new Error("该草稿无法继续编辑。"); const updated = await prisma.researchReviewRequest.update({ where: { id: existing.id }, data }); await saveAffiliation("research_review_requests", updated.id, input.affiliation); return updated;
}
export async function submitResearchDraft(requestId: string, userId: string, requestReason: string) {
  const delegate = requestDelegate();
  const request = delegate ? await delegate.findFirst({ where: { id: requestId, submittedByUserId: userId, status: { in: ["DRAFT", "NEEDS_REVISION"] } } }) : (await rawQuery<Array<{ id: string; title: string; action: string }>>(`UPDATE research_review_requests SET status='PENDING', review_comment=NULL, reviewed_at=NULL, reviewed_by_user_id=NULL, updated_at=NOW() WHERE id=$1 AND submitted_by_user_id=$2 AND status IN ('DRAFT','NEEDS_REVISION') RETURNING id,title,action`, requestId, userId))[0] ?? null;
  if (!request) throw new Error("未找到可提交的研究资料草稿。");
  const updated = delegate ? await delegate.update({ where: { id: request.id }, data: { status: "PENDING", requestReason, reviewComment: null, reviewedAt: null, reviewedByUserId: null } }) : { id: request.id, status: "PENDING" as ReviewStatus };
  await notifyUsers(await researchReviewers(userId), { kind: "RESEARCH_REVIEW_PENDING", title: "有新的研究资料待审核", message: `《${request.title}》已提交${request.action === "CREATE" ? "新增" : "修改"}审核。`, href: "/admin/research-review" }); return updated;
}
export async function requestResearchDeletion(articleId: string, reason: string, userId: string) {
  const article = await prisma.researchArticle.findFirst({ where: { id: articleId, status: "APPROVED" } }); if (!article) throw new Error("未找到可删除的已审核研究资料。");
  if (await prisma.researchReviewRequest.findFirst({ where: { articleId, action: "DELETE", status: "PENDING" } })) throw new Error("该研究资料已有待审核的删除申请。");
  const request = await prisma.researchReviewRequest.create({ data: { articleId, action: "DELETE", ...requestFields(article), status: "PENDING", requestReason: reason, submittedByUserId: userId } });
  await notifyUsers(await researchReviewers(userId), { kind: "RESEARCH_DELETE_PENDING", title: "有研究资料删除申请待审核", message: `《${article.title}》申请删除。`, href: "/admin/research-review" }); return request;
}
export async function listResearchRequestsForReview(reviewerId: string) {
  const requests = await prisma.researchReviewRequest.findMany({ where: { status: "PENDING", submittedByUserId: { not: reviewerId } }, orderBy: { createdAt: "asc" }, include: { submittedByUser: { select: { displayName: true, email: true } } } });
  const affiliations = await rawQuery<Array<{ id: string; affiliation: string | null }>>("SELECT id, affiliation FROM research_review_requests WHERE status='PENDING'");
  const affiliationById = new Map(affiliations.map((item) => [item.id, item.affiliation]));
  return requests.map((request) => ({ ...request, affiliation: affiliationById.get(request.id) ?? null }));
}
export async function countPendingResearchReviewsForReviewer(userId: string) {
  try { const delegate = requestDelegate(); return delegate ? await delegate.count({ where: { status: "PENDING", submittedByUserId: { not: userId } } }) : Number((await rawQuery<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM research_review_requests WHERE status='PENDING' AND submitted_by_user_id <> $1`, userId))[0]?.count ?? 0); }
  catch { return 0; }
}
export async function reviewResearchRequest(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_REVISION", comment: string | undefined, reviewerId: string) {
  const request = await prisma.researchReviewRequest.findFirst({ where: { id, status: "PENDING", submittedByUserId: { not: reviewerId } } }); if (!request) throw new Error("未找到可审核的研究资料申请。");
  const affiliation = await readAffiliation("research_review_requests", request.id); let approvedArticleId: string | null = null;
  await prisma.$transaction(async (tx) => { if (decision === "APPROVED") { if (request.action === "CREATE") { const article = await tx.researchArticle.create({ data: { ...requestFields(request), status: "APPROVED" } }); approvedArticleId = article.id; } else if (request.action === "UPDATE" && request.articleId) { await tx.researchArticle.update({ where: { id: request.articleId }, data: { ...requestFields(request), status: "APPROVED" } }); approvedArticleId = request.articleId; } else if (request.action === "DELETE" && request.articleId) await tx.researchArticle.update({ where: { id: request.articleId }, data: { status: "ARCHIVED" } }); } await tx.researchReviewRequest.update({ where: { id: request.id }, data: { status: decision, reviewedByUserId: reviewerId, reviewComment: comment || null, reviewedAt: new Date() } }); });
  if (approvedArticleId) await saveAffiliation("research_articles", approvedArticleId, affiliation);
  if (request.submittedByUserId) await notifyUsers([request.submittedByUserId], { kind: "RESEARCH_REVIEW_RESULT", title: "研究资料审核结果", message: `《${request.title}》${decision === "APPROVED" ? "已通过审核" : decision === "NEEDS_REVISION" ? "需补充后重新提交" : "未通过审核"}${comment ? `：${comment}` : "。"}`, href: "/admin/research" }); return { id: request.id, status: decision };
}
