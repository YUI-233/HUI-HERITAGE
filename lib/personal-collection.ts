import { PersonalItemType, Prisma, ReviewStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { parseCsvDocument } from "./csv";
import { notifyUsers, publicationReviewers } from "./notifications";
import { randomUUID } from "node:crypto";
import { parseCsvDocument } from "./csv";
import { notifyUsers, publicationReviewers } from "./notifications";
import { clearCollectionCoverForItem, clearStaleCoverByItem, clearStaleCoverMedia } from "./personal-collection-profile";
import { prisma } from "./prisma";

import { prisma } from "./prisma";

export type PersonalItemInput = {
  type: PersonalItemType;
  title: string;
  creator?: string;
  era?: string;
  eraDetail?: string;
  publicationDate?: string;
  imprintPublisher?: string;
  editionOrCategory?: string;
  price?: string;
  binding?: string;
  categories?: string[];
  volumeCount?: number;
  description?: string;
};

type PersonalItemRecord = {
  id: string;
  ownerId?: string;
  type: PersonalItemType;
  title: string;
  creator: string | null;
  era: string | null;
  eraDetail: string | null;
  publicationDate: string | null;
  imprintPublisher: string | null;
  editionOrCategory: string | null;
  price: string | null;
  binding: string | null;
  categories: string[];
  volumeCount: number;
  serialNumber: string;
  description: string | null;
  status: ReviewStatus;
  isPublic: boolean;
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  media?: Array<{ id: string; mimeType: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function list(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[、,，;；\n]/) : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function readPersonalItemInput(value: unknown): PersonalItemInput {
  const body = value as Record<string, unknown>;
  const type = body?.type === "ARTIFACT" ? "ARTIFACT" : body?.type === "BOOK" ? "BOOK" : null;
  const title = clean(body?.title);
  const volumeCount = Math.max(1, Math.min(999, Number(body?.volumeCount) || 1));
  if (!type || !title) throw new Error("请填写资料类型和名称。");
  return {
    type,
    title,
    creator: clean(body.creator),
    era: clean(body.era),
    eraDetail: clean(body.eraDetail),
    publicationDate: clean(body.publicationDate),
    imprintPublisher: clean(body.imprintPublisher),
    editionOrCategory: clean(body.editionOrCategory),
    price: clean(body.price),
    binding: clean(body.binding),
    categories: list(body.categories),
    volumeCount,
    description: clean(body.description),
  };
}

export async function listPersonalItems(ownerId: string) {
  // Use SQL here so the local development server can hot-reload this migration safely.
  const items = await prisma.$queryRaw<Omit<PersonalItemRecord, "media">[]>(Prisma.sql`
    SELECT id, type, title, creator, era,
      era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price,
      binding, categories, volume_count AS "volumeCount", serial_number AS "serialNumber",
      description, status, is_public AS "isPublic", review_comment AS "reviewComment",
      reviewed_at AS "reviewedAt", created_at AS "createdAt"
    FROM personal_collection_items
    WHERE owner_id = ${ownerId}
    ORDER BY type ASC, created_at DESC
  `);
  if (!items.length) return [];
  const media = await prisma.mediaAsset.findMany({
    where: { personalCollectionItemId: { in: items.map((item) => item.id) } },
    select: { id: true, mimeType: true, personalCollectionItemId: true }, orderBy: { createdAt: "asc" },
  });
  return items.map((item) => ({ ...item, media: media.filter((asset) => asset.personalCollectionItemId === item.id).map(({ id, mimeType }) => ({ id, mimeType })) }));
}

export async function createPersonalItem(ownerId: string, input: PersonalItemInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ serialNumber: string }>>(Prisma.sql`
      SELECT serial_number AS "serialNumber"
      FROM personal_collection_items
      WHERE owner_id = ${ownerId}
    `);
    const nextSerial = existing.reduce(
      (highest, item) => Math.max(highest, Number(item.serialNumber.match(/^PC-(\d+)$/)?.[1]) || 0),
      0,
    ) + 1;
    const serialNumber = `PC-${String(nextSerial).padStart(4, "0")}`;
    const id = randomUUID();
    const createdAt = new Date();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO personal_collection_items
        (id, owner_id, type, title, creator, era, era_detail, publication_date,
         imprint_publisher, edition_or_category, price, binding, categories, volume_count,
         serial_number, description, created_at, updated_at)
      VALUES
        (${id}, ${ownerId}, ${input.type}::personal_item_type, ${input.title},
         ${input.creator ?? null}, ${input.era ?? null}, ${input.eraDetail ?? null},
         ${input.publicationDate ?? null}, ${input.imprintPublisher ?? null},
         ${input.editionOrCategory ?? null}, ${input.price ?? null}, ${input.binding ?? null},
         ${input.categories ?? []}::text[], ${input.volumeCount ?? 1}, ${serialNumber},
         ${input.description ?? null}, ${createdAt}, ${createdAt})
    `);

    return {
      id,
      ownerId,
      serialNumber,
      type: input.type,
      title: input.title,
      creator: input.creator ?? null,
      era: input.era ?? null,
      eraDetail: input.eraDetail ?? null,
      publicationDate: input.publicationDate ?? null,
      imprintPublisher: input.imprintPublisher ?? null,
      editionOrCategory: input.editionOrCategory ?? null,
      price: input.price ?? null,
      binding: input.binding ?? null,
      categories: input.categories ?? [],
      volumeCount: input.volumeCount ?? 1,
      description: input.description ?? null,
      status: "DRAFT",
      isPublic: false,
      reviewComment: null,
      reviewedAt: null,
      createdAt,
    } satisfies PersonalItemRecord;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updatePersonalItem(ownerId: string, id: string, input: PersonalItemInput) {
  const updatedAt = new Date();
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    UPDATE personal_collection_items
    SET title = ${input.title}, creator = ${input.creator ?? null}, era = ${input.era ?? null},
      era_detail = ${input.eraDetail ?? null}, publication_date = ${input.publicationDate ?? null},
      imprint_publisher = ${input.imprintPublisher ?? null}, edition_or_category = ${input.editionOrCategory ?? null}, price = ${input.price ?? null},
      binding = ${input.binding ?? null}, categories = ${input.categories ?? []}::text[],
      volume_count = ${input.volumeCount ?? 1}, description = ${input.description ?? null}, updated_at = ${updatedAt}
    WHERE id = ${id} AND owner_id = ${ownerId} AND type = ${input.type}::personal_item_type
    RETURNING id, type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error("未找到可编辑的个人收藏记录。");
  return rows[0];
}

export async function deletePersonalItem(ownerId: string, id: string, type: PersonalItemType) {
  const media = await prisma.mediaAsset.findMany({ where: { personalCollectionItemId: id }, select: { id: true } });
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    DELETE FROM personal_collection_items
    WHERE id = ${id} AND owner_id = ${ownerId} AND type = ${type}::personal_item_type
    RETURNING id, type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error("未找到可删除的个人收藏记录。");
  await Promise.all(media.map((m) => clearStaleCoverMedia(ownerId, m.id)));
  return rows[0];
}

export async function submitPersonalItem(ownerId: string, id: string) {
  const candidate = await prisma.personalCollectionItem.findFirst({
    where: { id, ownerId },
    select: { status: true },
  });
  if (!candidate) throw new Error("未找到可申请公开的个人收藏记录。");
  if (!(["DRAFT", "NEEDS_REVISION", "REJECTED"] as ReviewStatus[]).includes(candidate.status)) throw new Error("该记录当前不能申请公开；请先确认它尚未处于审核中。");
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    UPDATE personal_collection_items
    SET status = 'PENDING'::review_status, is_public = false, review_comment = NULL,
      reviewed_by_user_id = NULL, reviewed_at = NULL, updated_at = ${new Date()}
    WHERE id = ${id} AND owner_id = ${ownerId}
      AND status IN ('DRAFT'::review_status, 'NEEDS_REVISION'::review_status, 'REJECTED'::review_status)
    RETURNING id, type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error("该记录当前不能申请公开；请先确认它尚未处于审核中。");
  await prisma.mediaAsset.updateMany({ where: { personalCollectionItemId: id }, data: { visibility: "PRIVATE" } });
  await notifyUsers(await publicationReviewers(), {
    kind: "PERSONAL_PUBLICATION_REQUEST", title: "新的公开申请",
    message: `“${rows[0].title}”已申请公开，等待审核。`, href: "/admin/personal-review",
  });
  return rows[0];
}

/** Apply every eligible book at once. Withdrawal deliberately remains a per-record action. */
export async function submitPersonalBooks(ownerId: string) {
  const candidates = await prisma.personalCollectionItem.findMany({
    where: { ownerId, type: "BOOK", status: { in: ["DRAFT", "NEEDS_REVISION", "REJECTED"] } },
    select: { id: true },
  });
  const eligibleIds = candidates.map((item) => item.id);
  if (!eligibleIds.length) return { submitted: 0, skippedWithoutImage: 0 };
  const rows = await prisma.$queryRaw<Array<{ id: string; title: string }>>(Prisma.sql`
    UPDATE personal_collection_items
    SET status = 'PENDING'::review_status, is_public = false, review_comment = NULL,
      reviewed_by_user_id = NULL, reviewed_at = NULL, updated_at = ${new Date()}
    WHERE owner_id = ${ownerId} AND id IN (${Prisma.join(eligibleIds)})
    RETURNING id, title
  `);
  if (rows.length) await prisma.mediaAsset.updateMany({ where: { personalCollectionItemId: { in: rows.map((row) => row.id) } }, data: { visibility: "PRIVATE" } });
  const notification = rows.length ? await notifyUsers(await publicationReviewers(), {
    kind: "PERSONAL_PUBLICATION_REQUEST", title: "新的公开申请",
    message: `有 ${rows.length} 条个人藏书申请公开，等待审核。`, href: "/admin/personal-review",
  }) : { count: 0 };
  return { submitted: rows.length, skippedWithoutImage: 0, reviewersNotified: notification.count };
}

export async function withdrawPersonalItem(ownerId: string, id: string) {
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    UPDATE personal_collection_items
    SET status = 'DRAFT'::review_status, is_public = false, review_comment = NULL,
      reviewed_by_user_id = NULL, reviewed_at = NULL, updated_at = ${new Date()}
    WHERE id = ${id} AND owner_id = ${ownerId} AND status = 'PENDING'::review_status
    RETURNING id, type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error("仅审核中的公开申请可以撤回。");
  await clearStaleCoverByItem(ownerId, id);
  return rows[0];
}

export async function setPersonalItemPublic(ownerId: string, id: string, isPublic: boolean) {
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    UPDATE personal_collection_items
    SET is_public = ${isPublic}, status = ${isPublic ? "APPROVED" : "DRAFT"}::review_status,
      updated_at = ${new Date()}
    WHERE id = ${id} AND owner_id = ${ownerId}
      AND (${isPublic} = false OR status = 'APPROVED'::review_status)
    RETURNING id, type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error(isPublic ? "仅审核通过的记录可以公开。" : "未找到可调整的个人收藏记录。");
  await prisma.mediaAsset.updateMany({ where: { personalCollectionItemId: id }, data: { visibility: isPublic ? "PUBLIC" : "PRIVATE" } });
  if (!rows[0]) throw new Error(isPublic ? "仅审核通过的记录可以公开。" : "未找到可调整的个人收藏记录。");
  await prisma.mediaAsset.updateMany({ where: { personalCollectionItemId: id }, data: { visibility: isPublic ? "PUBLIC" : "PRIVATE" } });

  if (!isPublic) {
    await clearStaleCoverByItem(ownerId, id);
    await clearCollectionCoverForItem(ownerId, id);
  }

  return rows[0];
}

export type PersonalReviewQueueItem = PersonalItemRecord & {
  ownerEmail: string;
  ownerName: string | null;
  media: Array<{ id: string; mimeType: string }>;
};

export async function listPersonalReviewQueue(reviewerId: string) {
  const items = await prisma.$queryRaw<Omit<PersonalReviewQueueItem, "media">[]>(Prisma.sql`
    SELECT p.id, p.owner_id AS "ownerId", p.type, p.title, p.creator, p.era,
      p.era_detail AS "eraDetail", p.publication_date AS "publicationDate",
      p.imprint_publisher AS "imprintPublisher", p.edition_or_category AS "editionOrCategory", p.price,
      p.binding, p.categories, p.volume_count AS "volumeCount", p.serial_number AS "serialNumber",
      p.description, p.status, p.is_public AS "isPublic", p.review_comment AS "reviewComment",
      p.reviewed_at AS "reviewedAt", p.created_at AS "createdAt", u.email AS "ownerEmail", u.display_name AS "ownerName"
    FROM personal_collection_items p
    JOIN users u ON u.id = p.owner_id
    WHERE p.status = 'PENDING'::review_status AND p.owner_id <> ${reviewerId}
    ORDER BY p.created_at ASC
  `);
  if (!items.length) return [];
  const media = await prisma.mediaAsset.findMany({
    where: { personalCollectionItemId: { in: items.map((item) => item.id) } },
    select: { id: true, mimeType: true, personalCollectionItemId: true }, orderBy: { createdAt: "asc" },
  });
  return items.map((item) => ({ ...item, media: media.filter((asset) => asset.personalCollectionItemId === item.id).map(({ id, mimeType }) => ({ id, mimeType })) }));
}

export async function countPendingPersonalReviewItems(reviewerId: string) {
  return prisma.personalCollectionItem.count({
    where: { status: "PENDING", ownerId: { not: reviewerId } },
  });
}

export async function reviewPersonalItem(reviewerId: string, id: string, decision: "APPROVED" | "NEEDS_REVISION" | "REJECTED", comment?: string) {
  const reviewedAt = new Date();
  const rows = await prisma.$queryRaw<PersonalItemRecord[]>(Prisma.sql`
    UPDATE personal_collection_items
    SET status = ${decision}::review_status, is_public = ${decision === "APPROVED"}, reviewed_by_user_id = ${reviewerId},
      review_comment = ${clean(comment) ?? null}, reviewed_at = ${reviewedAt}, updated_at = ${reviewedAt}
    WHERE id = ${id} AND owner_id <> ${reviewerId} AND status = 'PENDING'::review_status
    RETURNING id, owner_id AS "ownerId", type, title, creator, era, era_detail AS "eraDetail", publication_date AS "publicationDate",
      imprint_publisher AS "imprintPublisher", edition_or_category AS "editionOrCategory", price, binding, categories,
      volume_count AS "volumeCount", serial_number AS "serialNumber", description, status,
      is_public AS "isPublic", review_comment AS "reviewComment", reviewed_at AS "reviewedAt", created_at AS "createdAt"
  `);
  if (!rows[0]) throw new Error("未找到可审核的公开申请；系统不允许审核本人提交的记录。");
  await prisma.mediaAsset.updateMany({ where: { personalCollectionItemId: id }, data: { visibility: decision === "APPROVED" ? "PUBLIC" : "PRIVATE" } });
  if (decision !== "APPROVED" && rows[0].ownerId) await clearCollectionCoverForItem(rows[0].ownerId, id);
  const titles = {
    APPROVED: "公开申请已通过",
    NEEDS_REVISION: "公开申请需要补充",
    REJECTED: "公开申请未通过",
  } as const;
  const defaultMessages = {
    APPROVED: `“${rows[0].title}”已通过审核，现已自动公开。`,
    NEEDS_REVISION: `“${rows[0].title}”需要补充资料后重新申请公开。`,
    REJECTED: `“${rows[0].title}”未通过公开审核。`,
  } as const;
  await notifyUsers(rows[0].ownerId ? [rows[0].ownerId] : [], {
    kind: "PERSONAL_PUBLICATION_REVIEW", title: titles[decision],
    message: clean(comment) ? `审核意见：${clean(comment)}` : defaultMessages[decision],
    href: "/personal-collection",
  });
  return rows[0];
}

export function parsePersonalCollectionRows(document: string[][], defaultType: PersonalItemType) {
  const headerRow = document.findIndex((row) => row.some((cell) => ["书名", "名称", "标题", "图书名称", "藏品名称"].includes(cell.replace(/^\ufeff/, "").replace(/[\s　]/g, "").trim())));
  const [headers = [], ...rows] = document.slice(headerRow >= 0 ? headerRow : 0);
  const normalizedHeaders = headers.map((header) => header.replace(/^\ufeff/, "").replace(/[\s　]/g, "").trim());
  const index = (names: string[]) => names.map((name) => normalizedHeaders.indexOf(name)).find((position) => position >= 0) ?? -1;
  const titleIndex = index(["书名", "名称", "标题", "图书名称", "藏品名称"]);
  if (titleIndex < 0) throw new Error("CSV 必须包含“书名”或“名称”列。");
  const typeIndex = index(["类型"]);
  const creatorIndex = index(["作者／来源", "作者/来源", "作者／制作者", "作者/制作者", "作者", "制作者", "来源", "作者姓名"]);
  const eraIndex = index(["作者年代", "年代", "出版年", "年份"]);
  const eraDetailIndex = index(["刊刻年份", "年代2", "年代２", "年代（二）", "年号"]);
  const publicationIndex = index(["刊刻时间", "出版/刊刻时间", "出版／刊刻时间", "出版刊刻时间"]);
  const publisherIndex = index(["刊刻主体", "出版社/刊刻主体", "出版社／刊刻主体", "出版社"]);
  const editionIndex = index(["版本／类别", "版本/类别", "版本", "类别", "版本信息"]);
  const bindingIndex = index(["装帧"]);
  const categoryIndex = index(["分类", "分类编号"]);
  const priceIndex = index(["价格", "购入价格", "估价"]);
  const volumeIndex = index(["册数", "卷册数", "数量"]);
  const descriptionIndex = index(["说明", "描述", "馆藏说明", "备注", "附注"]);

  return rows.map((row, rowIndex) => {
    const statedType = row[typeIndex]?.trim().toUpperCase();
    const type: PersonalItemType = statedType === "ARTIFACT" || row[typeIndex]?.includes("藏") || row[typeIndex]?.includes("文物")
      ? "ARTIFACT"
      : statedType === "BOOK" || row[typeIndex]?.includes("书")
        ? "BOOK"
        : defaultType;
    try {
      return readPersonalItemInput({
        type,
        title: row[titleIndex],
        creator: creatorIndex >= 0 ? row[creatorIndex] : undefined,
        era: eraIndex >= 0 ? row[eraIndex] : undefined,
        eraDetail: eraDetailIndex >= 0 ? row[eraDetailIndex] : undefined,
        publicationDate: publicationIndex >= 0 ? row[publicationIndex] : undefined,
        imprintPublisher: publisherIndex >= 0 ? row[publisherIndex] : undefined,
        editionOrCategory: editionIndex >= 0 ? row[editionIndex] : undefined,
        price: priceIndex >= 0 ? row[priceIndex] : undefined,
        binding: bindingIndex >= 0 ? row[bindingIndex] : undefined,
        categories: categoryIndex >= 0 ? row[categoryIndex]?.split(/[、,，;；\n]/) : [],
        volumeCount: volumeIndex >= 0 ? row[volumeIndex] : 1,
        description: descriptionIndex >= 0 ? row[descriptionIndex] : undefined,
      });
    } catch {
      throw new Error(`第 ${rowIndex + 2} 行缺少名称或资料类型不正确。`);
    }
  });
}

export function parsePersonalCollectionCsv(input: string, defaultType: PersonalItemType) {
  return parsePersonalCollectionRows(parseCsvDocument(input), defaultType);
}
