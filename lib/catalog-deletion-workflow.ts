import { prisma } from "./prisma";
import { notifyUsers, publicationReviewers } from "./notifications";

export type CatalogDeletionType = "manuscript" | "artifact";
type Decision = "APPROVED" | "REJECTED" | "NEEDS_REVISION";

const clean = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function sourceRecord(id: string, type: CatalogDeletionType) {
  if (type === "manuscript") return prisma.book.findFirst({ where: { id, status: "APPROVED" }, select: { id: true, title: true } });
  return prisma.artifact.findFirst({ where: { id, status: "APPROVED" }, select: { id: true, title: true } });
}

export async function submitCatalogDeletion(input: { id: string; type: CatalogDeletionType; reason: unknown }, submittedByUserId: string) {
  const record = await sourceRecord(input.id, input.type);
  if (!record) throw new Error("未找到可申请删除的已审核资料。");
  const reason = clean(input.reason);
  if (!reason) throw new Error("请填写删除理由，供审核人员核对。");
  const existing = await prisma.catalogDeletionRequest.findFirst({ where: { recordId: record.id, recordType: input.type, status: "PENDING" }, select: { id: true } });
  if (existing) throw new Error("这条资料已有待审核的删除申请，请勿重复提交。");
  const request = await prisma.catalogDeletionRequest.create({
    data: { recordId: record.id, recordType: input.type, recordTitle: record.title, requestReason: reason, submittedByUserId },
  });
  await notifyUsers(await publicationReviewers(), {
    kind: "CATALOG_DELETION_PENDING",
    title: "古籍文物删除申请待审核",
    message: `《${record.title}》已提交删除申请，请核对删除理由。`,
    href: "/admin/catalog-review",
  });
  return request;
}

export async function listPendingCatalogDeletionRequests() {
  return prisma.catalogDeletionRequest.findMany({
    where: { status: "PENDING" }, orderBy: { createdAt: "desc" },
    include: { submittedByUser: { select: { displayName: true, email: true } } },
  });
}

export async function reviewCatalogDeletion(id: string, decision: Decision, comment: unknown, reviewedByUserId: string) {
  const request = await prisma.catalogDeletionRequest.findUnique({ where: { id } });
  if (!request) throw new Error("未找到这条删除申请。");
  if (request.status !== "PENDING") throw new Error("这条删除申请已经处理过。");
  if (request.submittedByUserId === reviewedByUserId) throw new Error("不能审核自己提交的删除申请。");
  const reviewComment = clean(comment);
  if (decision !== "APPROVED" && !reviewComment) throw new Error("要求补充或退回时，请填写审核说明。");
  await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      if (request.recordType === "manuscript") await tx.book.updateMany({ where: { id: request.recordId, status: "APPROVED" }, data: { status: "ARCHIVED" } });
      else await tx.artifact.updateMany({ where: { id: request.recordId, status: "APPROVED" }, data: { status: "ARCHIVED" } });
      await tx.auditEvent.create({ data: { entityType: request.recordType === "manuscript" ? "BOOK" : "ARTIFACT", entityId: request.recordId, action: "CATALOG_DELETION_APPROVED", actorId: reviewedByUserId, payload: { requestId: request.id, reason: request.requestReason } } });
    }
    await tx.catalogDeletionRequest.update({ where: { id }, data: { status: decision, reviewedByUserId, reviewComment: reviewComment || null, reviewedAt: new Date() } });
  });
  if (request.submittedByUserId) await notifyUsers([request.submittedByUserId], {
    kind: "CATALOG_DELETION_RESULT",
    title: decision === "APPROVED" ? "古籍文物删除申请已通过" : decision === "NEEDS_REVISION" ? "古籍文物删除申请需补充" : "古籍文物删除申请已退回",
    message: reviewComment || `《${request.recordTitle}》的删除申请已处理。`,
    href: "/admin/catalog",
  });
}
