import { CollectionOrigin, WorkflowLane } from "@prisma/client";
import { parseCsvDocument } from "./csv";
import { csvDocument } from "./csv";
import { previewCatalogImport } from "./catalog-import-preview";
import { prisma } from "./prisma";
import { writeBookBibliographicMetadata } from "./book-bibliographic-metadata";
import { holdingReviewers, notifyUsers } from "./notifications";
import { usesCloudRuntime } from "./cloud-runtime";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type OfficialFormat = "holdings" | "domestic" | "overseas_latest" | "overseas";
// Legacy columns retain a placeholder for existing database compatibility. Review rights
// are determined by permissions and the submitter's identity, not a fixed A/B lane.
const legacyWorkflowLane: WorkflowLane = "A";
const text = (value: string | undefined) => value?.trim() || undefined;

function batchRecordRows(sourceCsv: string) {
  const [, ...rows] = parseCsvDocument(sourceCsv);
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values, offset) => ({ rowIndex: offset + 1, sourceRow: offset + 2, values }));
}

function assertNoPersonalHoldingRows(sourceCsv: string) {
  const [headers = [], ...rows] = parseCsvDocument(sourceCsv);
  if (headers.indexOf("来源类型") < 0) return;
  if (rows.some((row) => field(row, headers, "来源类型") === "个人公开收藏")) {
    throw new Error("个人馆藏信息不能通过馆藏信息录入提交，请前往个人收藏馆录入。");
  }
}

async function ensureBatchRecords(batchId: string, sourceCsv: string) {
  // Do not use an aggregate here. This path also runs while a local Next
  // server hot-reloads after Prisma generation; a simple record lookup gives
  // the reviewer a safe compatibility path and is sufficient for existence.
  const existing = await prisma.importBatchRecord.findFirst({ where: { batchId }, select: { id: true } });
  if (existing) return;
  const rows = batchRecordRows(sourceCsv);
  if (rows.length) await prisma.importBatchRecord.createMany({ data: rows.map((row) => ({ batchId, ...row })) });
}
const currentHeaderAliases: Record<string, string[]> = { 国家: ["国家", "馆藏国家"], "馆藏国家": ["国家", "馆藏国家"], 备注: ["备注", "備註"] };

export async function createImportBatch(_submittedBy: unknown, sourceCsv: string, submittedByUserId?: string) {
  const preview = previewCatalogImport(sourceCsv);
  if (preview.format !== "holdings" && preview.format !== "domestic" && preview.format !== "overseas_latest" && preview.format !== "overseas") throw new Error("只有机构馆藏和海外藏馆 CSV 进入交叉审核；个人馆藏请使用直接导入。");
  assertNoPersonalHoldingRows(sourceCsv);
  if (preview.valid !== preview.total) throw new Error("请先修正 CSV 中的全部错误后再提交审核。");
  const missingReferences = await findMissingReferenceCandidates(preview.format as OfficialFormat, sourceCsv);
  if (missingReferences.length) throw new Error(`第 ${missingReferences[0].row} 行关联资料编号不存在，请先创建古籍或文物记录后再提交。`);
  const existing = await prisma.importBatch.findFirst({
    where: {
      format: preview.format,
      sourceCsv,
      status: "PENDING",
      submittedByUserId: submittedByUserId ?? null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { ...existing, reused: true };
  const batch = await prisma.importBatch.create({ data: { format: preview.format, submittedBy: legacyWorkflowLane, submittedByUserId, totalRows: preview.total, validRows: preview.valid, sourceCsv, events: { create: { action: "SUBMITTED", lane: null } } } });
  await ensureBatchRecords(batch.id, sourceCsv);
  await notifyUsers(await holdingReviewers(submittedByUserId), {
    kind: "HOLDING_IMPORT_REVIEW",
    title: "有新的馆藏批次待审核",
    message: `${preview.format === "domestic" ? "国内" : "海外"}馆藏资料已提交，共 ${preview.total} 行，请前往审核。`,
    href: "/admin/review",
  });
  return { ...batch, reused: false };
}

export async function listImportBatches() {
  return prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, format: true, submittedBy: true, status: true, totalRows: true, validRows: true, reviewerLane: true, reviewComment: true, reviewedAt: true, createdAt: true, submittedByUser: { select: { displayName: true, email: true } }, events: { orderBy: { createdAt: "asc" }, select: { action: true, lane: true, comment: true, createdAt: true } } } });
}

export async function listResubmittableImportBatches(submittedByUserId: string) {
  return prisma.importBatch.findMany({
    where: { submittedByUserId, status: { in: ["NEEDS_REVISION", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, format: true, status: true, totalRows: true, reviewComment: true, createdAt: true, updatedAt: true },
  });
}

export async function deleteResubmittableImportBatch(id: string, submittedByUserId: string) {
  const result = await prisma.importBatch.deleteMany({ where: { id, submittedByUserId, status: { in: ["NEEDS_REVISION", "REJECTED"] } } });
  if (!result.count) throw new Error("仅可删除本人被退回或需要补充的批量馆藏。");
}

export async function countPendingImportBatchesForReviewer(userId: string) {
  if (usesCloudRuntime()) return 0;
  return prisma.importBatch.count({
    where: {
      status: "PENDING",
      OR: [
        { submittedByUserId: { not: userId } },
        { submittedByUserId: null },
      ],
    },
  });
}

export async function getImportBatchPreview(id: string) {
  const source = await prisma.importBatch.findUnique({ where: { id }, select: { sourceCsv: true } });
  if (!source) throw new Error("审核批次不存在。");
  await ensureBatchRecords(id, source.sourceCsv);
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: { id: true, format: true, submittedBy: true, status: true, totalRows: true, validRows: true, reviewComment: true, sourceCsv: true, records: { orderBy: { rowIndex: "asc" }, select: { rowIndex: true, sourceRow: true, status: true, reviewComment: true } } },
  });
  if (!batch) throw new Error("审核批次不存在。");
  const { sourceCsv, records, ...summary } = batch;
  const document = parseCsvDocument(sourceCsv);
  const [headers = [], ...dataRows] = document;
  const preview = previewCatalogImport(sourceCsv);
  return {
    ...summary,
    preview: {
      ...preview,
      // The summary above is useful for validation, but reviewers also need to
      // inspect every source field before they approve an institutional batch.
      headers,
      detailRows: dataRows.filter((row) => row.some((value) => value.trim())).map((values, offset) => ({ index: offset + 1, sourceRow: offset + 2, values, status: records.find((record) => record.rowIndex === offset + 1)?.status ?? "PENDING", reviewComment: records.find((record) => record.rowIndex === offset + 1)?.reviewComment ?? null })),
    },
    duplicateCandidates: await findDuplicateCandidates(batch.format as OfficialFormat, sourceCsv),
    referenceWarnings: await findMissingReferenceCandidates(batch.format as OfficialFormat, sourceCsv),
  };
}

export async function getImportBatchAuditReport(id: string) {
  const batch = await prisma.importBatch.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "asc" }, select: { action: true, lane: true, comment: true, createdAt: true } } } });
  if (!batch) throw new Error("审核批次不存在。");
  const preview = previewCatalogImport(batch.sourceCsv); const duplicates = await findDuplicateCandidates(batch.format as OfficialFormat, batch.sourceCsv); const missingReferences = await findMissingReferenceCandidates(batch.format as OfficialFormat, batch.sourceCsv);
  const rows: Array<Array<string | number | null | undefined>> = [
    ["批次", "编号", batch.id], ["批次", "类型", batch.format], ["批次", "提交账号", batch.submittedByUserId], ["批次", "当前状态", batch.status], ["批次", "总行数", batch.totalRows], ["批次", "校验通过行数", batch.validRows], ["批次", "审核账号", batch.reviewedByUserId], ["批次", "审核说明", batch.reviewComment], ["批次", "创建时间", batch.createdAt.toISOString()], ["批次", "审核时间", batch.reviewedAt?.toISOString()],
    ...batch.events.map((event) => ["流程", event.action, `${event.createdAt.toISOString()}${event.comment ? ` · ${event.comment}` : ""}`]),
    ...duplicates.map((duplicate) => ["重复提示", `第 ${duplicate.row} 行`, duplicate.message]),
    ...missingReferences.map((candidate) => ["关联资料提示", `第 ${candidate.row} 行`, candidate.message]),
    ...preview.rows.map((row) => ["CSV 预览", `第 ${row.row} 行 · ${row.recordType}`, `${row.institution} · ${row.status} · ${row.valid ? "通过" : "需修正"}`]),
  ];
  return csvDocument(["类别", "字段", "内容"], rows);
}

function field(row: string[], headers: string[], name: string) { const index = (currentHeaderAliases[name] ?? [name]).map((header) => headers.indexOf(header)).find((candidate) => candidate >= 0) ?? -1; return index >= 0 ? row[index] || "" : ""; }

async function findDuplicateCandidates(format: OfficialFormat, sourceCsv: string) {
  const document = parseCsvDocument(sourceCsv); const headers = document[0] ?? []; const candidates: Array<{ row: number; message: string }> = [];
  for (let offset = 1; offset < Math.min(document.length, 101); offset += 1) {
    const row = document[offset];
    if (format === "holdings") {
      const recordType = field(row, headers, "关联资料类型"); const recordId = field(row, headers, "关联资料编号");
      const originValue = field(row, headers, "来源类型"); const origin: CollectionOrigin = originValue === "海外馆藏" ? "OVERSEAS" : originValue === "个人公开收藏" ? "PERSONAL" : "DOMESTIC";
      const existing = await prisma.holding.findFirst({ where: { bookId: recordType === "古籍" ? recordId : null, artifactId: recordType === "文物" ? recordId : null, institution: field(row, headers, "收藏机构"), region: field(row, headers, "地区"), origin, callNumber: text(field(row, headers, "索书号／版本")) ?? null }, select: { id: true } });
      if (existing) candidates.push({ row: offset + 1, message: "已存在相同的馆藏记录；审核通过时会自动跳过。" });
    } else if (format === "domestic" || format === "overseas_latest") {
      const title = field(row, headers, "书名"); const author = text(field(row, headers, "作者")); const institution = field(row, headers, "图书馆"); const region = format === "domestic" ? "中国" : field(row, headers, "国家"); const origin: CollectionOrigin = format === "domestic" ? "DOMESTIC" : "OVERSEAS";
      const book = await prisma.book.findFirst({ where: { title, author: author ?? null, source: "馆藏记录最新模板导入" }, select: { id: true } });
      if (book) {
        const existing = await prisma.holding.findFirst({ where: { bookId: book.id, institution, region, origin, callNumber: text(field(row, headers, "检索号")) ?? null }, select: { id: true } });
        if (existing) candidates.push({ row: offset + 1, message: "已存在相同的馆藏记录；审核通过时会自动跳过。" });
      }
    } else {
      const title = field(row, headers, "书名"); const author = text(field(row, headers, "作者"));
      const book = await prisma.book.findFirst({ where: { title, author: author ?? null, source: "海外藏馆 CSV 审核导入" }, select: { id: true } });
      if (book) {
        const existing = await prisma.holding.findFirst({ where: { bookId: book.id, institution: field(row, headers, "馆藏信息"), region: field(row, headers, "馆藏国家"), origin: "OVERSEAS", callNumber: text(field(row, headers, "检索号")) ?? null }, select: { id: true } });
        if (existing) candidates.push({ row: offset + 1, message: "已存在相同的海外馆藏记录；审核通过时会自动跳过。" });
      }
    }
  }
  return candidates;
}

async function findMissingReferenceCandidates(format: OfficialFormat, sourceCsv: string) {
  if (format !== "holdings") return [];
  const document = parseCsvDocument(sourceCsv); const headers = document[0] ?? []; const candidates: Array<{ row: number; message: string }> = [];
  for (let offset = 1; offset < Math.min(document.length, 101); offset += 1) {
    const row = document[offset]; const recordType = field(row, headers, "关联资料类型"); const recordId = field(row, headers, "关联资料编号");
    const found = recordType === "古籍"
      ? await prisma.book.findUnique({ where: { id: recordId }, select: { id: true } })
      : recordType === "文物" ? await prisma.artifact.findUnique({ where: { id: recordId }, select: { id: true } }) : null;
    if (!found) candidates.push({ row: offset + 1, message: "关联古籍或文物编号不存在，无法写入馆藏记录。" });
  }
  return candidates;
}

async function applyHoldingRows(sourceCsv: string) {
  assertNoPersonalHoldingRows(sourceCsv);
  const document = parseCsvDocument(sourceCsv); const headers = document[0]; let created = 0; let skipped = 0;
  for (const row of document.slice(1)) {
    const recordType = field(row, headers, "关联资料类型"); const recordId = field(row, headers, "关联资料编号");
    const bookId = recordType === "古籍" ? recordId : null; const artifactId = recordType === "文物" ? recordId : null;
    const found = bookId ? await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } }) : await prisma.artifact.findUnique({ where: { id: artifactId! }, select: { id: true } });
    if (!found) throw new Error(`关联资料编号 ${recordId} 不存在，无法通过审核。`);
    const originValue = field(row, headers, "来源类型"); const origin: CollectionOrigin = originValue === "海外馆藏" ? "OVERSEAS" : originValue === "个人公开收藏" ? "PERSONAL" : "DOMESTIC";
    const institution = field(row, headers, "收藏机构"); const region = field(row, headers, "地区"); const callNumber = text(field(row, headers, "索书号／版本"));
    const duplicate = await prisma.holding.findFirst({ where: { bookId, artifactId, institution, region, origin, callNumber: callNumber ?? null }, select: { id: true } });
    if (duplicate) { skipped += 1; continue; }
    await prisma.holding.create({ data: { bookId, artifactId, institution, region, origin, callNumber, catalogUrl: text(field(row, headers, "馆方目录链接")), description: text(field(row, headers, "馆藏说明")), status: "APPROVED" } });
    created += 1;
  }
  return { created, skipped };
}

async function applyOverseasRows(sourceCsv: string) {
  const document = parseCsvDocument(sourceCsv); const headers = document[0]; let created = 0; let skipped = 0;
  for (const row of document.slice(1)) {
    const title = field(row, headers, "书名"); const author = text(field(row, headers, "作者")); const institution = field(row, headers, "馆藏信息"); const region = field(row, headers, "馆藏国家"); const callNumber = text(field(row, headers, "检索号"));
    const existingBook = await prisma.book.findFirst({ where: { title, author: author ?? null, source: "海外藏馆 CSV 审核导入" }, select: { id: true } });
    const book = existingBook ?? await prisma.book.create({ data: { title, author, dynasty: text(field(row, headers, "年份")), versionType: text(field(row, headers, "版本")), description: text(field(row, headers, "其他")) ?? text(field(row, headers, "備註")), source: "海外藏馆 CSV 审核导入", status: "APPROVED" } });
    const duplicate = await prisma.holding.findFirst({ where: { bookId: book.id, institution, region, origin: "OVERSEAS", callNumber: callNumber ?? null }, select: { id: true } });
    if (duplicate) { skipped += 1; continue; }
    await prisma.holding.create({ data: { bookId: book.id, institution, region, origin: "OVERSEAS", callNumber, catalogUrl: text(field(row, headers, "在线链接")), description: text(field(row, headers, "出版信息")), status: "APPROVED" } });
    created += 1;
  }
  return { created, skipped };
}

const importedImageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function importRemoteBookImage(bookId: string, sourceUrl: string | undefined) {
  if (!sourceUrl) return undefined;
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return `图片链接不是 HTTP(S)：${sourceUrl}`;
    const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    const mimeType = response.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
    if (!response.ok || !importedImageExtensions[mimeType]) return `无法读取图片或格式不支持：${sourceUrl}`;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) return `图片为空或超过 12MB：${sourceUrl}`;
    const suffix = `${bookId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${importedImageExtensions[mimeType]}`;
    const directory = path.join(process.cwd(), "uploads", "private", "manuscripts");
    await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, suffix), bytes);
    await prisma.mediaAsset.create({ data: { storageKey: `private/manuscripts/${suffix}`, mimeType, visibility: "MEMBER_ONLY", bookId } });
    return undefined;
  } catch {
    return `图片链接无效或无法连接：${sourceUrl}`;
  }
}

async function applyLatestHoldingRows(format: "domestic" | "overseas_latest", sourceCsv: string) {
  const document = parseCsvDocument(sourceCsv); const headers = document[0]; let created = 0; let skipped = 0; const imageWarnings: string[] = [];
  for (const row of document.slice(1)) {
    const title = field(row, headers, "书名"); const author = text(field(row, headers, "作者")); const institution = field(row, headers, "图书馆"); const region = format === "domestic" ? "中国" : field(row, headers, "国家"); const origin: CollectionOrigin = format === "domestic" ? "DOMESTIC" : "OVERSEAS"; const callNumber = text(field(row, headers, "检索号"));
    const existingBook = await prisma.book.findFirst({ where: { title, author: author ?? null, source: "馆藏记录最新模板导入" }, select: { id: true } });
    const book = existingBook ?? await prisma.book.create({ data: { title, author, dynasty: text(field(row, headers, "年代")), versionType: text(field(row, headers, "版本")), description: format === "domestic" ? text(field(row, headers, "版本信息")) : undefined, source: "馆藏记录最新模板导入", status: "APPROVED" } });
    if (!existingBook) await writeBookBibliographicMetadata(book.id, { eraDetail: text(field(row, headers, "刊刻年份")) ?? null, publicationDate: text(field(row, headers, "刊刻时间")) ?? null, imprintPublisher: format === "overseas_latest" ? text(field(row, headers, "刊刻主体")) ?? null : null, binding: null, volumeCount: Math.max(1, Number(field(row, headers, "册数")) || 1), categories: [] });
    const duplicate = await prisma.holding.findFirst({ where: { bookId: book.id, institution, region, origin, callNumber: callNumber ?? null }, select: { id: true } });
    if (duplicate) { skipped += 1; continue; }
    await prisma.holding.create({ data: { bookId: book.id, institution, region, origin, callNumber, catalogUrl: text(field(row, headers, "链接")), description: text(field(row, headers, "备注")), status: "APPROVED" } });
    for (const imageHeader of ["图片1", "图片2"]) {
      const warning = await importRemoteBookImage(book.id, text(field(row, headers, imageHeader)));
      if (warning) imageWarnings.push(`第 ${document.indexOf(row) + 1} 行《${title}》：${warning}`);
    }
    created += 1;
  }
  return { created, skipped, imageWarnings };
}

export async function reviewImportBatchRecord(id: string, rowIndex: unknown, decision: unknown, comment: unknown, reviewedByUserId?: string) {
  const parsedRowIndex = Number(rowIndex);
  const nextStatus = decision === "APPROVED" || decision === "REJECTED" || decision === "NEEDS_REVISION" ? decision : null;
  if (!Number.isInteger(parsedRowIndex) || parsedRowIndex < 1) throw new Error("请选择需要审核的资料条目。");
  if (!nextStatus) throw new Error("请选择审核结论。");
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) throw new Error("审核批次不存在。");
  if (batch.status !== "PENDING") throw new Error("该批次已经完成处理，不能再次审核。");
  if (reviewedByUserId && batch.submittedByUserId === reviewedByUserId) throw new Error("同一账号不能审核自己提交的资料，请由其他拥有审核权限的用户处理。");
  await ensureBatchRecords(batch.id, batch.sourceCsv);
  const record = await prisma.importBatchRecord.findUnique({ where: { batchId_rowIndex: { batchId: id, rowIndex: parsedRowIndex } } });
  if (!record) throw new Error("该资料条目不存在。");
  if (record.status !== "PENDING") throw new Error("该资料已经审核，无需重复处理。");

  let applied = { created: 0, skipped: 0 };
  if (nextStatus === "APPROVED") {
    const [headers = []] = parseCsvDocument(batch.sourceCsv);
    const values = Array.isArray(record.values) ? record.values.map((value) => String(value ?? "")) : [];
    const oneRowCsv = csvDocument(headers, [values]);
    applied = batch.format === "holdings"
      ? await applyHoldingRows(oneRowCsv)
      : batch.format === "domestic" || batch.format === "overseas_latest"
        ? await applyLatestHoldingRows(batch.format, oneRowCsv)
        : await applyOverseasRows(oneRowCsv);
  }

  const reviewComment = typeof comment === "string" ? comment.trim().slice(0, 2000) || null : null;
  const updatedRecord = await prisma.importBatchRecord.update({
    where: { id: record.id },
    data: { status: nextStatus, reviewComment, reviewedByUserId, reviewedAt: new Date(), appliedAt: nextStatus === "APPROVED" ? new Date() : null },
  });
  await prisma.importBatchEvent.create({ data: { batchId: id, action: nextStatus, lane: null, comment: reviewComment ? `第 ${parsedRowIndex} 条：${reviewComment}` : `第 ${parsedRowIndex} 条` } });

  const remaining = await prisma.importBatchRecord.count({ where: { batchId: id, status: "PENDING" } });
  let updatedBatch = batch;
  if (remaining === 0) {
    const states = await prisma.importBatchRecord.findMany({ where: { batchId: id }, select: { status: true } });
    const finalStatus = states.some((item) => item.status === "NEEDS_REVISION") ? "NEEDS_REVISION" : states.some((item) => item.status === "REJECTED") ? "REJECTED" : "APPROVED";
    updatedBatch = await prisma.importBatch.update({ where: { id }, data: { status: finalStatus, reviewerLane: null, reviewedByUserId, reviewedAt: new Date() } });
    if (batch.submittedByUserId) await notifyUsers([batch.submittedByUserId], {
      kind: "HOLDING_IMPORT_RESULT",
      title: finalStatus === "APPROVED" ? "馆藏批次已全部审核" : finalStatus === "NEEDS_REVISION" ? "馆藏批次需要补充" : "馆藏批次已退回",
      message: finalStatus === "APPROVED" ? "批次内全部资料已审核并写入正式馆藏记录。" : "批次内资料已全部处理，请查看审核结论后再提交修订文件。",
      href: "/admin/holdings",
    });
  }
  return { record: updatedRecord, batch: updatedBatch, applied, remaining };
}

export async function reviewImportBatch(id: string, _reviewer: unknown, decision: unknown, comment: unknown, reviewedByUserId?: string) {
  const nextStatus = decision === "APPROVED" || decision === "REJECTED" || decision === "NEEDS_REVISION" ? decision : null;
  if (!nextStatus) throw new Error("请选择审核结论。");
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) throw new Error("审核批次不存在。");
  if (batch.status !== "PENDING") throw new Error("该批次当前不能再次审核。");
  if (reviewedByUserId && batch.submittedByUserId === reviewedByUserId) throw new Error("同一账号不能审核自己提交的批次，请由其他拥有审核权限的用户处理。");
  let applied = { created: 0, skipped: 0 };
  if (nextStatus === "APPROVED") applied = batch.format === "holdings" ? await applyHoldingRows(batch.sourceCsv) : batch.format === "domestic" || batch.format === "overseas_latest" ? await applyLatestHoldingRows(batch.format, batch.sourceCsv) : await applyOverseasRows(batch.sourceCsv);
  const reviewComment = typeof comment === "string" ? comment.trim().slice(0, 2000) || null : null;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.importBatch.update({ where: { id }, data: { status: nextStatus, reviewerLane: null, reviewedByUserId, reviewComment, reviewedAt: new Date() } });
    await tx.importBatchRecord.updateMany({ where: { batchId: id, status: "PENDING" }, data: { status: nextStatus, reviewComment, reviewedByUserId, reviewedAt: new Date(), appliedAt: nextStatus === "APPROVED" ? new Date() : null } });
    await tx.importBatchEvent.create({ data: { batchId: id, action: nextStatus, lane: null, comment: reviewComment } });
    return result;
  });
  if (batch.submittedByUserId) {
    const title = nextStatus === "APPROVED" ? "馆藏批次已审核通过" : nextStatus === "NEEDS_REVISION" ? "馆藏批次需要补充" : "馆藏批次已退回";
    const conclusion = reviewComment ? `审核说明：${reviewComment}` : nextStatus === "APPROVED" ? "资料已写入正式馆藏记录。" : "请查看审核结论后处理。";
    await notifyUsers([batch.submittedByUserId], { kind: "HOLDING_IMPORT_RESULT", title, message: conclusion, href: "/admin/holdings" });
  }
  return { batch: updated, applied };
}

export async function resubmitImportBatch(id: string, _submittedBy: unknown, sourceCsv: string, submittedByUserId?: string) {
  const preview = previewCatalogImport(sourceCsv);
  if (preview.format !== "holdings" && preview.format !== "domestic" && preview.format !== "overseas_latest" && preview.format !== "overseas") throw new Error("只能重新提交机构馆藏或海外藏馆 CSV。");
  assertNoPersonalHoldingRows(sourceCsv);
  if (preview.valid !== preview.total) throw new Error("请先修正 CSV 中的全部错误后再重新提交。");
  const missingReferences = await findMissingReferenceCandidates(preview.format as OfficialFormat, sourceCsv);
  if (missingReferences.length) throw new Error(`第 ${missingReferences[0].row} 行关联资料编号不存在，请先创建古籍或文物记录后再重新提交。`);
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) throw new Error("审核批次不存在。");
  if (submittedByUserId && batch.submittedByUserId && batch.submittedByUserId !== submittedByUserId) throw new Error("只有原提交账号可以重新提交此批次。");
  if (batch.status !== "NEEDS_REVISION" && batch.status !== "REJECTED") throw new Error("只有“需补充”或“退回”的批次可以重新提交。");
  if (batch.format !== preview.format) throw new Error("重新提交的 CSV 模板必须与原批次一致。");
  const result = await prisma.$transaction(async (tx) => {
    await tx.importBatchRecord.deleteMany({ where: { batchId: id } });
    const rows = batchRecordRows(sourceCsv);
    if (rows.length) await tx.importBatchRecord.createMany({ data: rows.map((row) => ({ batchId: id, ...row })) });
    const result = await tx.importBatch.update({ where: { id }, data: { sourceCsv, totalRows: preview.total, validRows: preview.valid, status: "PENDING", reviewerLane: null, reviewedByUserId: null, reviewComment: null, reviewedAt: null } });
    await tx.importBatchEvent.create({ data: { batchId: id, action: "RESUBMITTED", lane: null } });
    return result;
  });
  await notifyUsers(await holdingReviewers(submittedByUserId ?? batch.submittedByUserId ?? undefined), {
    kind: "HOLDING_IMPORT_REVIEW",
    title: "有修订后的馆藏批次待审核",
    message: `一批 ${preview.format === "domestic" ? "国内" : "海外"}馆藏资料已重新提交，共 ${preview.total} 行，请前往审核。`,
    href: "/admin/review",
  });
  return result;
}
