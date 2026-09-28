import { Prisma, ReviewStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/** 带 HTTP 状态的业务错误，供路由层映射。 */
export class ProfileError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PUBLIC_ITEM = { status: "APPROVED" as ReviewStatus, isPublic: true };
const PUBLIC_MEDIA_URL = (itemId: string, mediaId: string) =>
  `/api/personal-collection/public/${itemId}/media/${mediaId}`;

export type CollectionCover = { mediaId: string; itemId: string; url: string };
export type ProfileResponse = {
  slug: string;
  displayName: string;
  description: string | null;
  cover: CollectionCover | null;
};

// ---------- slug 生成 ----------

/** 与公开路由静态段冲突的保留字，禁止作为 slug（否则会被 /api/personal-collections/items 遮蔽）。 */
const RESERVED_SLUGS = new Set(["items"]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 生成唯一、稳定的 slug；名称无法转写时回退到随机串。 */
async function generateUniqueSlug(displayName: string): Promise<string> {
  const base = slugify(displayName) || "collection";
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-collection` : base;
  let n = 2;
  while (true) {
    if (!RESERVED_SLUGS.has(candidate)) {
      const taken = await prisma.personalCollectionProfile.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
    }
    candidate = candidate.length > 50 ? `collection-${randomBytes(4).toString("hex")}` : `${base}-${n++}`;
  }
}

function defaultDisplayName(userDisplayName: string | null): string {
  return userDisplayName ? `${userDisplayName} 的收藏馆` : "我的收藏馆";
}

// ---------- 封面解析 ----------

/** 优先使用指定 coverMediaId（须为本人 APPROVED+isPublic 内容的 PUBLIC 图），否则取最新公开内容的第一张 PUBLIC 图。 */
async function resolveCollectionCover(
  ownerId: string,
  coverMediaId: string | null,
): Promise<CollectionCover | null> {
  if (coverMediaId) {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        id: coverMediaId,
        visibility: "PUBLIC",
        personalCollectionItem: { ownerId, status: "APPROVED", isPublic: true },
      },
      select: { id: true, personalCollectionItemId: true },
    });
    if (media?.personalCollectionItemId) {
      return { mediaId: media.id, itemId: media.personalCollectionItemId, url: PUBLIC_MEDIA_URL(media.personalCollectionItemId, media.id) };
    }
  }
  const item = await prisma.personalCollectionItem.findFirst({
    where: { ownerId, ...PUBLIC_ITEM },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      media: { where: { visibility: "PUBLIC" }, select: { id: true }, take: 1 },
    },
  });
  const media = item?.media?.[0];
  if (item && media) {
    return { mediaId: media.id, itemId: item.id, url: PUBLIC_MEDIA_URL(item.id, media.id) };
  }
  return null;
}

async function toProfileResponse(
  profile: { slug: string; displayName: string; description: string | null; coverMediaId: string | null },
  ownerId: string,
): Promise<ProfileResponse> {
  const cover = await resolveCollectionCover(ownerId, profile.coverMediaId);
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    description: profile.description,
    cover,
  };
}

// ---------- Profile 读写（Issue #2） ----------

/** 读取当前用户的资料；不存在则创建默认资料（默认名 = “{displayName} 的收藏馆”）。 */
export async function getOrCreateProfile(ownerId: string): Promise<ProfileResponse> {
  const existing = await prisma.personalCollectionProfile.findUnique({ where: { ownerId } });
  if (existing) return toProfileResponse(existing, ownerId);

  const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true } });
  const displayName = defaultDisplayName(user?.displayName ?? null);
  const profile = await prisma.personalCollectionProfile.create({
    data: { ownerId, slug: await generateUniqueSlug(displayName), displayName, description: null, coverMediaId: null },
  });
  return toProfileResponse(profile, ownerId);
}

export type ProfileUpdateInput = {
  displayName?: unknown;
  description?: unknown;
  coverMediaId?: unknown;
};

/** 保存收藏馆设置：校验名称/简介长度、封面归属与公开状态，upsert 资料。 */
export async function updateProfile(ownerId: string, input: ProfileUpdateInput): Promise<ProfileResponse> {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!displayName || displayName.length < 2 || displayName.length > 40) {
    throw new ProfileError(400, "收藏馆名称应为 2–40 个字符。");
  }

  let coverMediaId: string | null | undefined = undefined;
  if (input.coverMediaId === null) {
    coverMediaId = null;
  } else if (typeof input.coverMediaId === "string" && input.coverMediaId) {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        id: input.coverMediaId,
        personalCollectionItem: { ownerId, status: "APPROVED", isPublic: true },
      },
      select: { id: true, visibility: true },
    });
    if (!media) throw new ProfileError(403, "不能使用这张图片作为收藏馆封面。");
    if (media.visibility !== "PUBLIC") throw new ProfileError(409, "请选择已公开藏品中的图片。");
    coverMediaId = media.id;
  }

  const data: Prisma.PersonalCollectionProfileUpdateInput = { displayName };
  if (input.description != null) {
    const raw = String(input.description).trim();
    if (raw.length > 300) throw new ProfileError(400, "收藏馆简介不能超过 300 个字符。");
    data.description = raw || null;
  }
  if (coverMediaId !== undefined) data.coverMediaId = coverMediaId;

  const profile = await prisma.personalCollectionProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      slug: await generateUniqueSlug(displayName),
      displayName,
      description: input.description != null ? (String(input.description).trim() || null) : null,
      coverMediaId: coverMediaId ?? null,
    },
    update: data,
  });
  return toProfileResponse(profile, ownerId);
}

/** 当前用户可作为公开封面的图片（本人 APPROVED+isPublic 内容的 PUBLIC 图）。 */
export async function listCoverOptions(ownerId: string): Promise<
  Array<{ mediaId: string; itemId: string; itemTitle: string; itemType: string; url: string }>
> {
  const items = await prisma.personalCollectionItem.findMany({
    where: { ownerId, ...PUBLIC_ITEM },
    select: {
      id: true,
      title: true,
      type: true,
      media: { where: { visibility: "PUBLIC" }, select: { id: true } },
    },
  });
  const options: Array<{ mediaId: string; itemId: string; itemTitle: string; itemType: string; url: string }> = [];
  for (const item of items) {
    for (const media of item.media) {
      options.push({
        mediaId: media.id,
        itemId: item.id,
        itemTitle: item.title,
        itemType: item.type,
        url: PUBLIC_MEDIA_URL(item.id, media.id),
      });
    }
  }
  return options;
}

// ---------- 封面失效清理（挂钩审查/撤回/删除） ----------

/** 指定 media 被删除/变为非公开时，若它正是某收藏馆封面则清空引用。 */
export async function clearStaleCoverMedia(ownerId: string, mediaId: string): Promise<void> {
  await prisma.personalCollectionProfile.updateMany({
    where: { ownerId, coverMediaId: mediaId },
    data: { coverMediaId: null },
  });
}

/** 整件内容被撤回/删除公开时，若其任意图片是封面则清空引用。 */
export async function clearStaleCoverByItem(ownerId: string, itemId: string): Promise<void> {
  const profile = await prisma.personalCollectionProfile.findUnique({
    where: { ownerId },
    select: { coverMediaId: true },
  });
  if (!profile?.coverMediaId) return;
  const media = await prisma.mediaAsset.findFirst({
    where: { id: profile.coverMediaId, personalCollectionItemId: itemId },
    select: { id: true },
  });
  if (media) {
    await prisma.personalCollectionProfile.updateMany({ where: { ownerId }, data: { coverMediaId: null } });
  }
}

// ---------- 公开聚合查询（Issue #1） ----------

export type PublicCollectionQuery = { q: string; page: number; limit: number };

/** 公开收藏馆目录：仅包含至少一件 APPROVED+isPublic 内容的用户。 */
export async function listPublicCollections({ q, page, limit }: PublicCollectionQuery) {
  const groups = await prisma.personalCollectionItem.groupBy({
    by: ["ownerId", "type"],
    where: PUBLIC_ITEM,
    _count: { _all: true },
  });
  const ownerCounts = new Map<string, { book: number; artifact: number; total: number }>();
  for (const g of groups) {
    const cur = ownerCounts.get(g.ownerId) ?? { book: 0, artifact: 0, total: 0 };
    if (g.type === "BOOK") cur.book += g._count._all;
    else cur.artifact += g._count._all;
    cur.total += g._count._all;
    ownerCounts.set(g.ownerId, cur);
  }

  const ownerIds = [...ownerCounts.keys()];
  if (!ownerIds.length) {
    return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const [profiles, users, latest] = await Promise.all([
    prisma.personalCollectionProfile.findMany({ where: { ownerId: { in: ownerIds } } }),
    prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, displayName: true } }),
    prisma.personalCollectionItem.findMany({
      where: { ...PUBLIC_ITEM, ownerId: { in: ownerIds } },
      orderBy: { updatedAt: "desc" },
      distinct: ["ownerId"],
      select: { ownerId: true, updatedAt: true },
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.displayName]));
  const profileMap = new Map(profiles.map((p) => [p.ownerId, p]));
  const latestMap = new Map(latest.map((l) => [l.ownerId, l.updatedAt]));

  // 为缺少资料记录的旧用户补建默认资料（确保目录可链接到 slug）。
  const missing = ownerIds.filter((id) => !profileMap.has(id));
  if (missing.length) {
    await Promise.all(
      missing.map(async (ownerId) => {
        const name = defaultDisplayName(userMap.get(ownerId) ?? null);
        await prisma.personalCollectionProfile
          .create({ data: { ownerId, slug: await generateUniqueSlug(name), displayName: name, description: null, coverMediaId: null } })
          .catch(() => undefined);
      }),
    );
    const created = await prisma.personalCollectionProfile.findMany({ where: { ownerId: { in: missing } } });
    for (const p of created) profileMap.set(p.ownerId, p);
  }

  const needle = q.trim().toLowerCase();
  const candidates = ownerIds
    .map((ownerId) => {
      const profile = profileMap.get(ownerId);
      const userDisplayName = userMap.get(ownerId) ?? "";
      const name = profile ? profile.displayName : defaultDisplayName(userDisplayName);
      const counts = ownerCounts.get(ownerId)!;
      return {
        ownerId,
        slug: profile?.slug ?? "",
        name,
        ownerName: userDisplayName,
        description: profile?.description ?? null,
        coverMediaId: profile?.coverMediaId ?? null,
        bookCount: counts.book,
        artifactCount: counts.artifact,
        totalCount: counts.total,
        updatedAt: latestMap.get(ownerId) ?? new Date(0),
      };
    })
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.ownerName.toLowerCase().includes(needle));

  const total = candidates.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pageItems = candidates.slice(start, start + limit);

  const items = await Promise.all(
    pageItems.map(async (c) => ({
      slug: c.slug,
      name: c.name,
      ownerName: c.ownerName,
      description: c.description,
      cover: await resolveCollectionCover(c.ownerId, c.coverMediaId),
      bookCount: c.bookCount,
      artifactCount: c.artifactCount,
      totalCount: c.totalCount,
      updatedAt: c.updatedAt.toISOString(),
    })),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

export type PublicCollectionItemQuery = {
  type?: "BOOK" | "ARTIFACT";
  q: string;
  page: number;
  limit: number;
};

/** 单个公开收藏馆：返回资料 + 内容卡片列表（严格隐私过滤）。无公开内容返回 null（404）。 */
export async function getPublicCollectionBySlug(
  slug: string,
  opts: PublicCollectionItemQuery,
): Promise<{
  collection: {
    slug: string;
    name: string;
    ownerName: string;
    description: string | null;
    cover: CollectionCover | null;
    bookCount: number;
    artifactCount: number;
    totalCount: number;
  };
  items: Array<{
    id: string;
    type: string;
    title: string;
    creator: string | null;
    era: string | null;
    category: string | null;
    editionOrCategory: string | null;
    serialNumber: string;
    cover: CollectionCover | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
} | null> {
  const profile = await prisma.personalCollectionProfile.findUnique({ where: { slug } });
  if (!profile) return null;
  const ownerId = profile.ownerId;

  const hasPublic = await prisma.personalCollectionItem.findFirst({ where: { ownerId, ...PUBLIC_ITEM }, select: { id: true } });
  if (!hasPublic) return null;

  const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true } });

  const counts = await prisma.personalCollectionItem.groupBy({
    by: ["type"],
    where: { ownerId, ...PUBLIC_ITEM },
    _count: { _all: true },
  });
  let bookCount = 0;
  let artifactCount = 0;
  for (const c of counts) {
    if (c.type === "BOOK") bookCount += c._count._all;
    else artifactCount += c._count._all;
  }
  const totalCount = bookCount + artifactCount;

  const trimmedQ = opts.q.trim();
  const where: Prisma.PersonalCollectionItemWhereInput = {
    ownerId,
    ...PUBLIC_ITEM,
    ...(opts.type ? { type: opts.type } : {}),
    ...(trimmedQ
      ? {
          OR: [
            { title: { contains: trimmedQ, mode: "insensitive" } },
            { creator: { contains: trimmedQ, mode: "insensitive" } },
            { serialNumber: { contains: trimmedQ, mode: "insensitive" } },
            { editionOrCategory: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.personalCollectionItem.count({ where });
  const totalPages = total === 0 ? 0 : Math.ceil(total / opts.limit);
  const itemsRaw = await prisma.personalCollectionItem.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (opts.page - 1) * opts.limit,
    take: opts.limit,
    select: {
      id: true,
      type: true,
      title: true,
      creator: true,
      era: true,
      categories: true,
      editionOrCategory: true,
      serialNumber: true,
      media: { where: { visibility: "PUBLIC" }, select: { id: true }, take: 1 },
    },
  });

  const items = itemsRaw.map((it) => ({
    id: it.id,
    type: it.type,
    title: it.title,
    creator: it.creator,
    era: it.era,
    category: it.categories?.[0] ?? null,
    editionOrCategory: it.editionOrCategory,
    serialNumber: it.serialNumber,
    cover: it.media[0]
      ? { itemId: it.id, mediaId: it.media[0].id, url: PUBLIC_MEDIA_URL(it.id, it.media[0].id) }
      : null,
  }));

  return {
    collection: {
      slug: profile.slug,
      name: profile.displayName,
      ownerName: user?.displayName ?? "",
      description: profile.description,
      cover: await resolveCollectionCover(ownerId, profile.coverMediaId),
      bookCount,
      artifactCount,
      totalCount,
    },
    items,
    pagination: { page: opts.page, limit: opts.limit, total, totalPages },
  };
}

// ---------- 跨收藏馆公开检索（PS-01） ----------

export type PublicItemSearchQuery = {
  q: string;
  type?: "BOOK" | "ARTIFACT";
  page: number;
  limit: number;
};

export type PublicItemSearchResult = {
  items: Array<{
    id: string;
    type: string;
    title: string;
    creator: string | null;
    era: string | null;
    category: string | null;
    editionOrCategory: string | null;
    serialNumber: string;
    cover: CollectionCover | null;
    collection: { slug: string; name: string; ownerName: string };
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

/**
 * 跨收藏馆检索公开书籍与文物（PS-01）。
 * 仅返回 APPROVED + isPublic 的内容，封面图片必须是 PUBLIC。
 * q 匹配：题名、作者／来源、年代、分类、版本、收藏编号、收藏馆名称、收藏者公开名称。
 */
export async function searchPublicCollectionItems(opts: PublicItemSearchQuery): Promise<PublicItemSearchResult> {
  const needle = opts.q.trim();
  const like = `%${needle}%`;
  const typeFilter = opts.type
    ? Prisma.sql`AND i."type" = ${opts.type}::personal_item_type`
    : Prisma.empty;
  // 收藏馆资料可能缺失（旧用户），故用 LEFT JOIN 并在 COALESCE 中回退到默认名称。
  const searchFilter = needle
    ? Prisma.sql`AND (
        i."title" ILIKE ${like}
        OR COALESCE(i."creator", '') ILIKE ${like}
        OR COALESCE(i."era", '') ILIKE ${like}
        OR COALESCE(i."edition_or_category", '') ILIKE ${like}
        OR COALESCE(i."serial_number", '') ILIKE ${like}
        OR COALESCE(array_to_string(i."categories", ' '), '') ILIKE ${like}
        OR COALESCE(p."display_name", '') ILIKE ${like}
        OR COALESCE(u."display_name", '') ILIKE ${like}
      )`
    : Prisma.empty;

  const baseWhere = Prisma.sql`
    FROM "personal_collection_items" i
    LEFT JOIN "personal_collection_profiles" p ON p."owner_id" = i."owner_id"
    LEFT JOIN "users" u ON u."id" = i."owner_id"
    WHERE i."status" = 'APPROVED' AND i."is_public" = true
    ${typeFilter}
    ${searchFilter}
  `;

  const countRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>(
    Prisma.sql`SELECT COUNT(DISTINCT i."id") AS total ${baseWhere}`,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / opts.limit);
  const offset = (opts.page - 1) * opts.limit;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      type: string;
      title: string;
      creator: string | null;
      era: string | null;
      category: string | null;
      edition_or_category: string | null;
      serial_number: string;
      media_id: string | null;
      owner_display_name: string | null;
      collection_slug: string | null;
      collection_name: string | null;
    }>
  >(Prisma.sql`
    SELECT t.* FROM (
      SELECT DISTINCT ON (i."id")
        i."id", i."type", i."title", i."creator", i."era",
        (SELECT c.cat FROM unnest(i."categories") AS c(cat) LIMIT 1) AS "category",
        i."edition_or_category", i."serial_number", i."updated_at",
        m."id" AS "media_id",
        u."display_name" AS "owner_display_name",
        p."slug" AS "collection_slug",
        p."display_name" AS "collection_name"
      FROM "personal_collection_items" i
      LEFT JOIN "personal_collection_profiles" p ON p."owner_id" = i."owner_id"
      LEFT JOIN "users" u ON u."id" = i."owner_id"
      LEFT JOIN "media_assets" m
        ON m."personal_collection_item_id" = i."id" AND m."visibility" = 'PUBLIC'
      WHERE i."status" = 'APPROVED' AND i."is_public" = true
      ${typeFilter}
      ${searchFilter}
      ORDER BY i."id", m."created_at" ASC
    ) t
    ORDER BY t."updated_at" DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  const items = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    creator: r.creator,
    era: r.era,
    category: r.category,
    editionOrCategory: r.edition_or_category,
    serialNumber: r.serial_number,
    cover: r.media_id
      ? { itemId: r.id, mediaId: r.media_id, url: PUBLIC_MEDIA_URL(r.id, r.media_id) }
      : null,
    collection: {
      slug: r.collection_slug ?? "",
      name: r.collection_name ?? defaultDisplayName(r.owner_display_name),
      ownerName: r.owner_display_name ?? "",
    },
  }));

  return { items, pagination: { page: opts.page, limit: opts.limit, total, totalPages } };
}
