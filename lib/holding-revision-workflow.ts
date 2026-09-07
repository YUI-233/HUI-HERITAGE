import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { holdingReviewers, notifyUsers } from "./notifications";

export type HoldingRevisionInput = {
  title?: string;
  author?: string | null;
  dynasty?: string | null;
  eraDetail?: string | null;
  publicationDate?: string | null;
  imprintPublisher?: string | null;
  versionType?: string | null;
  binding?: string | null;
  volumeCount?: number | null;
  categories?: string[] | string;
  description?: string | null;
  institution?: string;
  region?: string;
  origin?: "DOMESTIC" | "OVERSEAS";
  callNumber?: string | null;
  catalogUrl?: string | null;
  holdingDescription?: string | null;
};

export type HoldingRevisionAction = "CREATE" | "UPDATE" | "DELETE";

type Decision = "APPROVED" | "REJECTED" | "NEEDS_REVISION";

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanRequired(value: unknown, fallback: string) {
  return cleanText(value) ?? fallback;
}

function cleanVolume(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.max(1, Math.floor(parsed));
}

function cleanCategories(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean) as string[];
  const text = cleanText(value);
  return text ? text.split(/[、，,]/).map((item) => item.trim()).filter(Boolean) : [];
}

function revisionTitle(input: HoldingRevisionInput) {
  return cleanText(input.title) ?? "未填写书名";
}

export async function getHoldingRevisionSource(holdingId: string) {
  return prisma.holding.findFirst({
    where: { id: holdingId, status: "APPROVED", origin: { in: ["DOMESTIC", "OVERSEAS"] } },
    include: { book: true, artifact: true },
  });
}

function currentBookValues(current: NonNullable<Awaited<ReturnType<typeof getHoldingRevisionSource>>>) {
  if (!current.book) return null;
  return {
    title: current.book.title,
    author: current.book.author,
    dynasty: current.book.dynasty,
    eraDetail: current.book.eraDetail,
    publicationDate: current.book.publicationDate,
    imprintPublisher: current.book.imprintPublisher,
    versionType: current.book.versionType,
    binding: current.book.binding,
    volumeCount: current.book.volumeCount,
    categories: current.book.categories,
    description: current.book.description,
  };
}

function currentHoldingValues(current: NonNullable<Awaited<ReturnType<typeof getHoldingRevisionSource>>>) {
  return {
    institution: current.institution,
    region: current.region,
    origin: current.origin,
    callNumber: current.callNumber,
    catalogUrl: current.catalogUrl,
    description: current.description,
  };
}

export async function submitHoldingRevision(holdingId: string, input: HoldingRevisionInput, submittedByUserId?: string) {
  const current = await getHoldingRevisionSource(holdingId);
  if (!current) throw new Error("没有找到可修订的正式图书馆记录。");
  if (!current.book) throw new Error("目前第一版先支持古籍类图书馆记录修订。");

  const proposedBook = {
    title: cleanRequired(input.title, current.book.title),
    author: cleanText(input.author),
    dynasty: cleanText(input.dynasty),
    eraDetail: cleanText(input.eraDetail),
    publicationDate: cleanText(input.publicationDate),
    imprintPublisher: cleanText(input.imprintPublisher),
    versionType: cleanText(input.versionType),
    binding: cleanText(input.binding),
    volumeCount: cleanVolume(input.volumeCount),
    categories: cleanCategories(input.categories),
    description: cleanText(input.description),
  };
  const proposedHolding = {
    institution: cleanRequired(input.institution, current.institution),
    region: cleanRequired(input.region, current.region),
    origin: input.origin === "DOMESTIC" || input.origin === "OVERSEAS" ? input.origin : current.origin,
    callNumber: cleanText(input.callNumber),
    catalogUrl: cleanText(input.catalogUrl),
    description: cleanText(input.holdingDescription),
  };

  const reusableDraft = submittedByUserId ? await prisma.holdingRevision.findFirst({ where: { holdingId: current.id, action: "UPDATE", submittedByUserId, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, select: { id: true } }) : null;
  const revision = reusableDraft
    ? await prisma.holdingRevision.update({ where: { id: reusableDraft.id }, data: { status: "PENDING", proposedBook: proposedBook as Prisma.InputJsonValue, proposedHolding: proposedHolding as Prisma.InputJsonValue, reviewComment: null, reviewedAt: null, reviewedByUserId: null }, include: { submittedByUser: { select: { displayName: true, email: true } } } })
    : await prisma.holdingRevision.create({
      data: {
        holdingId: current.id,
        action: "UPDATE",
        submittedByUserId,
        proposedBook: proposedBook as Prisma.InputJsonValue,
        proposedHolding: proposedHolding as Prisma.InputJsonValue,
      },
      include: { submittedByUser: { select: { displayName: true, email: true } } },
    });

  const reviewers = await holdingReviewers(submittedByUserId);
  await notifyUsers(reviewers, {
    kind: "HOLDING_REVISION_PENDING",
    title: "馆藏记录修订待审核",
    message: `${revision.submittedByUser?.displayName || revision.submittedByUser?.email || "有用户"}提交了《${proposedBook.title}》的馆藏记录修订。`,
    href: "/admin/review?section=revisions",
  });

  return revision;
}

export async function submitHoldingDeletion(holdingId: string, reason: unknown, submittedByUserId?: string) {
  const current = await getHoldingRevisionSource(holdingId);
  if (!current) throw new Error("没有找到可申请删除的正式图书馆记录。");
  const requestReason = cleanText(reason);
  if (!requestReason) throw new Error("请填写申请删除馆藏的理由。");

  const existing = await prisma.holdingRevision.findFirst({
    where: { holdingId: current.id, action: "DELETE", status: "PENDING" },
    select: { id: true },
  });
  if (existing) throw new Error("这条馆藏记录已有待审核的删除申请，请勿重复提交。");

  const proposedBook = currentBookValues(current);
  const proposedHolding = currentHoldingValues(current);
  const revision = await prisma.holdingRevision.create({
    data: {
      holdingId: current.id,
      action: "DELETE",
      requestReason,
      submittedByUserId,
      proposedBook: proposedBook ? proposedBook as Prisma.InputJsonValue : Prisma.JsonNull,
      proposedHolding: proposedHolding as Prisma.InputJsonValue,
    },
    include: { submittedByUser: { select: { displayName: true, email: true } } },
  });

  const reviewers = await holdingReviewers(submittedByUserId);
  await notifyUsers(reviewers, {
    kind: "HOLDING_DELETION_PENDING",
    title: "馆藏删除申请待审核",
    message: `${revision.submittedByUser?.displayName || revision.submittedByUser?.email || "有用户"}申请删除《${revisionTitle(proposedBook ?? {})}》的馆藏记录。`,
    href: "/admin/review?section=revisions",
  });

  return revision;
}

export async function listHoldingRevisions(reviewerUserId: string) {
  return prisma.holdingRevision.findMany({
    where: {
      OR: [
        { submittedByUserId: { not: reviewerUserId } },
        { submittedByUserId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      holding: { include: { book: true } },
      submittedByUser: { select: { id: true, displayName: true, email: true } },
      reviewedByUser: { select: { id: true, displayName: true, email: true } },
    },
  });
}

export async function countPendingHoldingRevisionsForReviewer(userId: string) {
  return prisma.holdingRevision.count({
    where: {
      status: "PENDING",
      OR: [
        { submittedByUserId: { not: userId } },
        { submittedByUserId: null },
      ],
    },
  });
}

export async function reviewHoldingRevision(id: string, decision: Decision, comment?: unknown, reviewedByUserId?: string) {
  const revision = await prisma.holdingRevision.findUnique({
    where: { id },
    include: {
      holding: { include: { book: true } },
      submittedByUser: { select: { id: true } },
    },
  });
  if (!revision) throw new Error("没有找到这条修订申请。");
  if (revision.status !== "PENDING") throw new Error("这条修订申请已经处理过。");
  if (reviewedByUserId && revision.submittedByUserId === reviewedByUserId) throw new Error("系统不允许审核本人提交的修订。");
  if (decision !== "APPROVED" && !cleanText(comment)) throw new Error("要求补充或退回时，请填写审核说明。");

  const reviewComment = cleanText(comment);
  const isDeletion = revision.action === "DELETE";
  const isCreation = revision.action === "CREATE";
  const proposedBook = revision.proposedBook as HoldingRevisionInput | null;
  const proposedHolding = revision.proposedHolding as HoldingRevisionInput;
  const result = await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      if (isDeletion) {
        await tx.holding.update({ where: { id: revision.holdingId }, data: { status: "ARCHIVED" } });
      } else if (revision.holding.bookId && proposedBook) {
        await tx.book.update({
          where: { id: revision.holding.bookId },
          data: {
            title: cleanRequired(proposedBook.title, revision.holding.book?.title ?? "未填写书名"),
            author: cleanText(proposedBook.author),
            dynasty: cleanText(proposedBook.dynasty),
            eraDetail: cleanText(proposedBook.eraDetail),
            publicationDate: cleanText(proposedBook.publicationDate),
            imprintPublisher: cleanText(proposedBook.imprintPublisher),
            versionType: cleanText(proposedBook.versionType),
            binding: cleanText(proposedBook.binding),
            volumeCount: cleanVolume(proposedBook.volumeCount),
            categories: cleanCategories(proposedBook.categories),
            description: cleanText(proposedBook.description),
          },
        });
      }
      if (!isDeletion) {
        await tx.holding.update({
          where: { id: revision.holdingId },
          data: {
            institution: cleanRequired(proposedHolding.institution, revision.holding.institution),
            region: cleanRequired(proposedHolding.region, revision.holding.region),
            origin: proposedHolding.origin === "DOMESTIC" || proposedHolding.origin === "OVERSEAS" ? proposedHolding.origin : revision.holding.origin,
            callNumber: cleanText(proposedHolding.callNumber),
            catalogUrl: cleanText(proposedHolding.catalogUrl),
            description: cleanText(proposedHolding.holdingDescription ?? proposedHolding.description),
          },
        });
      }
    }
    if (isCreation) {
      await tx.holding.update({ where: { id: revision.holdingId }, data: { status: decision } });
      if (revision.holding.bookId) await tx.book.update({ where: { id: revision.holding.bookId }, data: { status: decision } });
    }
    return tx.holdingRevision.update({
      where: { id },
      data: { status: decision, reviewedByUserId, reviewComment, reviewedAt: new Date() },
    });
  });

  if (revision.submittedByUserId) {
    const title = isDeletion
      ? decision === "APPROVED" ? "馆藏删除申请已通过" : decision === "NEEDS_REVISION" ? "馆藏删除申请需补充" : "馆藏删除申请已退回"
      : isCreation ? decision === "APPROVED" ? "新馆藏信息已通过" : decision === "NEEDS_REVISION" ? "新馆藏信息需补充" : "新馆藏信息已退回"
      : decision === "APPROVED" ? "馆藏修订已通过" : decision === "NEEDS_REVISION" ? "馆藏修订需补充" : "馆藏修订已退回";
    await notifyUsers([revision.submittedByUserId], {
      kind: isDeletion ? "HOLDING_DELETION_RESULT" : "HOLDING_REVISION_RESULT",
      title,
      message: reviewComment || `《${revisionTitle(proposedBook ?? {})}》的${isDeletion ? "馆藏删除申请" : isCreation ? "新馆藏信息" : "馆藏修订"}已处理。`,
      href: isDeletion ? "/admin/review?section=revisions" : `/holdings/${revision.holdingId}`,
    });
  }
  return result;
}
