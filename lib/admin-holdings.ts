import { CollectionOrigin, ReviewStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { listCloudAdminHoldings, saveCloudAdminHolding } from "./cloud-admin-holdings";
import { submitHoldingRevision } from "./holding-revision-workflow";
import { holdingReviewers, notifyUsers } from "./notifications";

type HoldingInput = { id?: string; recordType: "manuscript" | "artifact"; recordId?: string; institution: string; region: string; origin: CollectionOrigin; callNumber?: string; catalogUrl?: string; holdingDescription?: string; status?: ReviewStatus; title?: string; author?: string; dynasty?: string; eraDetail?: string; publicationDate?: string; imprintPublisher?: string; versionType?: string; binding?: string; volumeCount?: number; categories?: string[] };
const origins = new Set<CollectionOrigin>(["DOMESTIC", "OVERSEAS"]);
const statuses = new Set<ReviewStatus>(["DRAFT", "PENDING", "APPROVED", "REJECTED", "NEEDS_REVISION", "ARCHIVED"]);
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const optionalText = (value: unknown, max = 500) => text(value, max) || undefined;
const categories = (value: unknown) => Array.isArray(value) ? value.map((item) => text(item, 100)).filter(Boolean) : text(value, 800).split(/[、，,]/).map((item) => item.trim()).filter(Boolean);

export function parseHoldingInput(value: unknown): HoldingInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>; const recordType = body.recordType === "manuscript" || body.recordType === "artifact" ? body.recordType : null;
  const recordId = text(body.recordId, 100), institution = text(body.institution, 200), region = text(body.region, 120), origin = typeof body.origin === "string" && origins.has(body.origin as CollectionOrigin) ? body.origin as CollectionOrigin : null;
  const id = text(body.id, 100) || undefined;
  if (!recordType || !institution || !region || !origin || (id && !recordId) || (!id && !text(body.title, 500))) return null;
  const status = typeof body.status === "string" && statuses.has(body.status as ReviewStatus) ? body.status as ReviewStatus : "DRAFT";
  const volume = Number(body.volumeCount);
  return { id, recordType, recordId: recordId || undefined, institution, region, origin, callNumber: optionalText(body.callNumber, 200), catalogUrl: optionalText(body.catalogUrl, 1000), holdingDescription: optionalText(body.holdingDescription, 3000), status, title: optionalText(body.title, 500), author: optionalText(body.author, 300), dynasty: optionalText(body.dynasty, 120), eraDetail: optionalText(body.eraDetail, 200), publicationDate: optionalText(body.publicationDate, 200), imprintPublisher: optionalText(body.imprintPublisher, 300), versionType: optionalText(body.versionType, 200), binding: optionalText(body.binding, 200), volumeCount: Number.isFinite(volume) && volume > 0 ? Math.floor(volume) : 1, categories: categories(body.categories) };
}

export async function listAdminHoldings() {
  const cloud = await listCloudAdminHoldings();
  if (cloud) return cloud;
  return prisma.holding.findMany({ include: { book: { select: { id: true, title: true, author: true, dynasty: true, eraDetail: true, publicationDate: true, imprintPublisher: true, versionType: true, binding: true, volumeCount: true, categories: true } }, artifact: { select: { id: true, title: true } } }, orderBy: { updatedAt: "desc" } });
}

export async function saveAdminHolding(input: HoldingInput) {
  const cloud = input.recordId ? await saveCloudAdminHolding(input as Parameters<typeof saveCloudAdminHolding>[0]) : null;
  if (cloud) return cloud;
  if (!input.id) return prisma.$transaction(async (tx) => { const book = await tx.book.create({ data: { title: input.title!, author: input.author ?? null, dynasty: input.dynasty ?? null, eraDetail: input.eraDetail ?? null, publicationDate: input.publicationDate ?? null, imprintPublisher: input.imprintPublisher ?? null, versionType: input.versionType ?? null, binding: input.binding ?? null, volumeCount: input.volumeCount ?? 1, categories: input.categories ?? [], status: input.status ?? "DRAFT" } }); return tx.holding.create({ data: { institution: input.institution, region: input.region, origin: input.origin, callNumber: input.callNumber, catalogUrl: input.catalogUrl, description: input.holdingDescription, status: input.status, bookId: book.id } }); });
  const recordId = input.recordId!;
  const exists = input.recordType === "manuscript" ? await prisma.book.findUnique({ where: { id: recordId } }) : await prisma.artifact.findUnique({ where: { id: recordId } });
  if (!exists) throw new Error("关联馆藏资料不存在。");
  const data = { institution: input.institution, region: input.region, origin: input.origin, callNumber: input.callNumber, catalogUrl: input.catalogUrl, description: input.holdingDescription, status: input.status, bookId: input.recordType === "manuscript" ? recordId : null, artifactId: input.recordType === "artifact" ? recordId : null };
  return prisma.$transaction(async (tx) => {
    const holding = await tx.holding.update({ where: { id: input.id }, data });
    if (input.recordType === "manuscript") await tx.book.update({ where: { id: recordId }, data: { title: input.title || exists.title, author: input.author ?? null, dynasty: input.dynasty ?? null, eraDetail: input.eraDetail ?? null, publicationDate: input.publicationDate ?? null, imprintPublisher: input.imprintPublisher ?? null, versionType: input.versionType ?? null, binding: input.binding ?? null, volumeCount: input.volumeCount ?? 1, categories: input.categories ?? [], status: input.status } });
    return holding;
  });
}

export async function submitAdminHolding(input: HoldingInput, submittedByUserId: string) {
  if (input.id) {
    const current = await prisma.holding.findUnique({ where: { id: input.id }, select: { status: true } });
    if (!current) throw new Error("未找到这条馆藏记录。");
    if (current.status === "APPROVED") return { revision: await submitHoldingRevision(input.id, { ...input, origin: input.origin === "DOMESTIC" ? "DOMESTIC" : "OVERSEAS" }, submittedByUserId), submitted: true };
  }

  const holding = await saveAdminHolding({ ...input, status: "PENDING" });
  const existing = await prisma.holdingRevision.findFirst({ where: { holdingId: holding.id, action: "CREATE", status: "PENDING" }, select: { id: true } });
  if (existing) throw new Error("这条新馆藏已在审核队列中，请勿重复提交。");
  const revision = await prisma.holdingRevision.create({
    data: {
      holdingId: holding.id,
      action: "CREATE",
      submittedByUserId,
      proposedBook: input.recordType === "manuscript" ? { title: input.title, author: input.author, dynasty: input.dynasty, eraDetail: input.eraDetail, publicationDate: input.publicationDate, imprintPublisher: input.imprintPublisher, versionType: input.versionType, binding: input.binding, volumeCount: input.volumeCount, categories: input.categories } : undefined,
      proposedHolding: { institution: input.institution, region: input.region, origin: input.origin, callNumber: input.callNumber, catalogUrl: input.catalogUrl, holdingDescription: input.holdingDescription },
    },
  });
  await notifyUsers(await holdingReviewers(submittedByUserId), { kind: "HOLDING_CREATE_PENDING", title: "有新的馆藏信息待审核", message: `《${input.title || "未填写书名"}》已提交馆藏审核。`, href: "/admin/review" });
  return { holding, revision, submitted: true };
}

type PendingHoldingAction = "CREATE" | "UPDATE" | "DELETE";

function holdingTitle(holding: { book: { title: string } | null; artifact: { title: string } | null }, proposedBook: unknown) {
  const title = proposedBook && typeof proposedBook === "object" && "title" in proposedBook ? text((proposedBook as { title?: unknown }).title) : "";
  return title || holding.book?.title || holding.artifact?.title || "未填写书名";
}

export async function listMyPendingHoldingSubmissions(userId: string) {
  const revisions = await prisma.holdingRevision.findMany({
    where: { submittedByUserId: userId, OR: [{ status: "PENDING" }, { status: "DRAFT", action: "UPDATE" }] },
    orderBy: { createdAt: "desc" },
    include: { holding: { include: { book: true, artifact: true } } },
  });
  return revisions.map((revision) => ({
    id: revision.id,
    holdingId: revision.holdingId,
    action: revision.action as PendingHoldingAction,
    status: revision.status,
    draft: revision.status === "DRAFT" && revision.action === "UPDATE" ? revisionDraftForm(revision) : null,
    title: holdingTitle(revision.holding, revision.proposedBook),
    institution: revision.holding.institution,
    origin: revision.holding.origin,
  }));
}

function revisionDraftForm(revision: { holdingId: string; proposedBook: unknown; proposedHolding: unknown; holding: { bookId: string | null; artifactId: string | null; book: { title: string; author: string | null; dynasty: string | null; eraDetail: string | null; publicationDate: string | null; imprintPublisher: string | null; versionType: string | null; binding: string | null; volumeCount: number; categories: string[] } | null; artifact: { title: string } | null; institution: string; region: string; origin: CollectionOrigin; callNumber: string | null; catalogUrl: string | null; description: string | null } }) {
  const book = revision.proposedBook && typeof revision.proposedBook === "object" ? revision.proposedBook as Record<string, unknown> : {};
  const holding = revision.proposedHolding && typeof revision.proposedHolding === "object" ? revision.proposedHolding as Record<string, unknown> : {};
  const sourceBook = revision.holding.book;
  const stringValue = (source: Record<string, unknown>, key: string, fallback: string | null = "") => typeof source[key] === "string" ? source[key] : fallback ?? "";
  const categoryValue = Array.isArray(book.categories) ? book.categories.filter((item): item is string => typeof item === "string").join("、") : stringValue(book, "categories", sourceBook?.categories.join("、") ?? "");
  const origin = holding.origin === "DOMESTIC" || holding.origin === "OVERSEAS" ? holding.origin : revision.holding.origin;
  return {
    id: revision.holdingId,
    recordType: sourceBook ? "manuscript" as const : "artifact" as const,
    recordId: sourceBook ? revision.holding.bookId ?? "" : revision.holding.artifactId ?? "",
    title: stringValue(book, "title", sourceBook?.title ?? revision.holding.artifact?.title ?? ""),
    author: stringValue(book, "author", sourceBook?.author ?? ""),
    dynasty: stringValue(book, "dynasty", sourceBook?.dynasty ?? ""),
    eraDetail: stringValue(book, "eraDetail", sourceBook?.eraDetail ?? ""),
    publicationDate: stringValue(book, "publicationDate", sourceBook?.publicationDate ?? ""),
    imprintPublisher: stringValue(book, "imprintPublisher", sourceBook?.imprintPublisher ?? ""),
    versionType: stringValue(book, "versionType", sourceBook?.versionType ?? ""),
    binding: stringValue(book, "binding", sourceBook?.binding ?? ""),
    volumeCount: String(typeof book.volumeCount === "number" ? book.volumeCount : sourceBook?.volumeCount ?? 1),
    categories: categoryValue,
    institution: stringValue(holding, "institution", revision.holding.institution),
    region: stringValue(holding, "region", revision.holding.region),
    origin,
    callNumber: stringValue(holding, "callNumber", revision.holding.callNumber ?? ""),
    catalogUrl: stringValue(holding, "catalogUrl", revision.holding.catalogUrl ?? ""),
    holdingDescription: stringValue(holding, "holdingDescription", stringValue(holding, "description", revision.holding.description ?? "")),
    status: "DRAFT",
  };
}

export async function withdrawMyHoldingSubmission(revisionId: string, userId: string) {
  const revision = await prisma.holdingRevision.findFirst({
    where: { id: revisionId, submittedByUserId: userId, status: "PENDING" },
    include: { holding: { include: { book: true, artifact: true } } },
  });
  if (!revision) throw new Error("仅可撤回本人仍在审核中的馆藏申请。");

  await prisma.$transaction(async (tx) => {
    await tx.holdingRevision.update({ where: { id: revision.id }, data: { status: "DRAFT" } });
    if (revision.action === "CREATE") {
      await tx.holding.update({ where: { id: revision.holdingId }, data: { status: "DRAFT" } });
      if (revision.holding.bookId) await tx.book.update({ where: { id: revision.holding.bookId }, data: { status: "DRAFT" } });
    }
  });

  return { id: revision.id, action: revision.action as PendingHoldingAction, draft: revision.action === "UPDATE" ? revisionDraftForm(revision) : null };
}

export async function discardMyHoldingRevisionDraft(revisionId: string, userId: string) {
  const revision = await prisma.holdingRevision.findFirst({ where: { id: revisionId, submittedByUserId: userId, action: "UPDATE", status: "DRAFT" }, select: { id: true } });
  if (!revision) throw new Error("仅可删除本人尚未提交的馆藏修改草稿。");
  await prisma.holdingRevision.update({ where: { id: revision.id }, data: { status: "ARCHIVED" } });
  return { id: revision.id, deleted: true };
}

export async function deleteAdminHoldingDraft(id: string) {
  const holding = await prisma.holding.findFirst({ where: { id, status: { in: ["DRAFT", "NEEDS_REVISION", "REJECTED"] } }, select: { id: true, bookId: true } });
  if (!holding) throw new Error("仅可删除草稿、需补充或退回的馆藏记录。");
  await prisma.$transaction(async (tx) => {
    await tx.holding.delete({ where: { id: holding.id } });
    if (holding.bookId && await tx.holding.count({ where: { bookId: holding.bookId } }) === 0) await tx.book.delete({ where: { id: holding.bookId } });
  });
}
