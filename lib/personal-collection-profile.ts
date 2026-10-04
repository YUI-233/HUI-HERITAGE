import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const collaborationOptions = new Set(["学术研究", "版本鉴定", "数字化合作", "展览借展"]);

type ProfileWithCover = Prisma.PersonalCollectionProfileGetPayload<{
  include: { coverMedia: { include: { personalCollectionItem: true } } };
}>;

function text(value: unknown, maximum: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("资料字段格式不正确。");
  const result = value.trim();
  if (result.length > maximum) throw new Error(`填写内容不能超过 ${maximum} 个字符。`);
  return result || null;
}

function terms(value: unknown, label: string, maximumItems: number, maximumLength = 20) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label}格式不正确。`);
  const result = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  if (result.length > maximumItems) throw new Error(`${label}最多填写 ${maximumItems} 项。`);
  if (result.some((item) => item.length > maximumLength)) throw new Error(`${label}的每一项不能超过 ${maximumLength} 个字符。`);
  return result;
}

function slugBase(displayName: string, ownerId: string) {
  const readable = displayName.normalize("NFKD").toLocaleLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (readable.length >= 2) return readable;
  return `collection-${createHash("sha256").update(ownerId).digest("hex").slice(0, 12)}`;
}

async function availableSlug(displayName: string, ownerId: string) {
  const base = slugBase(displayName, ownerId);
  for (let index = 0; index < 100; index += 1) {
    const slug = index ? `${base}-${index + 1}` : base;
    const existing = await prisma.personalCollectionProfile.findUnique({ where: { slug }, select: { ownerId: true } });
    if (!existing || existing.ownerId === ownerId) return slug;
  }
  return `${base}-${createHash("sha256").update(`${ownerId}-${Date.now()}`).digest("hex").slice(0, 8)}`;
}

function validCover(profile: ProfileWithCover) {
  const media = profile.coverMedia;
  const item = media?.personalCollectionItem;
  return Boolean(media && item && item.ownerId === profile.ownerId && item.status === "APPROVED" && item.isPublic
    && media.visibility === "PUBLIC" && media.mimeType.startsWith("image/"));
}

export function serializeCollectionProfile(profile: ProfileWithCover) {
  const cover = validCover(profile) && profile.coverMedia?.personalCollectionItemId ? {
    mediaId: profile.coverMedia.id,
    itemId: profile.coverMedia.personalCollectionItemId,
    url: `/api/personal-collection/public/${profile.coverMedia.personalCollectionItemId}/media/${profile.coverMedia.id}`,
  } : null;
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    description: profile.description,
    publicCollectorName: profile.publicCollectorName,
    themes: profile.themes,
    primaryEras: profile.primaryEras,
    primaryRegion: profile.primaryRegion,
    collectingSinceYear: profile.collectingSinceYear,
    originStory: profile.originStory,
    collaborationInterests: profile.collaborationInterests,
    acceptsMessages: profile.acceptsMessages,
    cover,
  };
}

export async function ensureCollectionProfile(owner: { id: string; displayName: string | null; email: string }) {
  const existing = await prisma.personalCollectionProfile.findUnique({
    where: { ownerId: owner.id }, include: { coverMedia: { include: { personalCollectionItem: true } } },
  });
  if (existing) return existing;
  const displayName = owner.displayName?.trim() || "个人收藏馆";
  const slug = await availableSlug(displayName, owner.id);
  try {
    return await prisma.personalCollectionProfile.create({
      data: { ownerId: owner.id, slug, displayName },
      include: { coverMedia: { include: { personalCollectionItem: true } } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.personalCollectionProfile.findUnique({
        where: { ownerId: owner.id }, include: { coverMedia: { include: { personalCollectionItem: true } } },
      });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

export async function getCollectionProfile(owner: { id: string; displayName: string | null; email: string }) {
  return serializeCollectionProfile(await ensureCollectionProfile(owner));
}

export async function updateCollectionProfile(owner: { id: string; displayName: string | null; email: string }, body: Record<string, unknown>) {
  const displayName = text(body.displayName, 40);
  if (!displayName || displayName.length < 2) throw new Error("收藏馆名称应为 2–40 个字符。");
  const publicCollectorName = text(body.publicCollectorName, 20);
  const themes = terms(body.themes, "收藏主题", 5);
  const primaryEras = terms(body.primaryEras, "主要收藏年代", 5);
  const primaryRegion = text(body.primaryRegion, 60);
  const originStory = text(body.originStory, 500);
  const collaborationInterests = terms(body.collaborationInterests, "研究与合作意向", 4);
  if (collaborationInterests.some((item) => !collaborationOptions.has(item))) throw new Error("研究与合作意向包含不支持的选项。");
  const year = body.collectingSinceYear;
  const collectingSinceYear = year === null || year === undefined || year === "" ? null : Number(year);
  if (collectingSinceYear !== null && (!Number.isInteger(collectingSinceYear) || collectingSinceYear < 1000 || collectingSinceYear > new Date().getFullYear())) {
    throw new Error("开始收藏年份应为不晚于今年的四位年份。");
  }
  if (body.acceptsMessages !== null && body.acceptsMessages !== undefined && typeof body.acceptsMessages !== "boolean") {
    throw new Error("私信设置格式不正确。");
  }
  const coverMediaId = body.coverMediaId === null || body.coverMediaId === undefined || body.coverMediaId === "" ? null : String(body.coverMediaId);
  if (coverMediaId) {
    const cover = await prisma.mediaAsset.findFirst({
      where: {
        id: coverMediaId, visibility: "PUBLIC", mimeType: { startsWith: "image/" },
        personalCollectionItem: { ownerId: owner.id, status: "APPROVED", isPublic: true },
      }, select: { id: true },
    });
    if (!cover) throw new Error("所选图片不具备公开封面资格，请重新选择。");
  }
  await ensureCollectionProfile(owner);
  const updated = await prisma.personalCollectionProfile.update({
    where: { ownerId: owner.id },
    data: {
      displayName, description: text(body.description, 300), publicCollectorName, themes, primaryEras,
      primaryRegion, collectingSinceYear, originStory, collaborationInterests,
      acceptsMessages: body.acceptsMessages === undefined ? null : body.acceptsMessages as boolean | null,
      coverMediaId,
    },
    include: { coverMedia: { include: { personalCollectionItem: true } } },
  });
  return serializeCollectionProfile(updated);
}

export async function listCollectionCoverOptions(ownerId: string) {
  const items = await prisma.personalCollectionItem.findMany({
    where: { ownerId, status: "APPROVED", isPublic: true },
    select: {
      id: true, title: true, type: true,
      media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, select: { id: true } },
    }, orderBy: { updatedAt: "desc" },
  });
  return items.flatMap((item) => item.media.map((media) => ({
    mediaId: media.id,
    itemId: item.id,
    itemTitle: item.title,
    itemType: item.type,
    url: `/api/personal-collection/public/${item.id}/media/${media.id}`,
  })));
}

export async function clearCollectionCoverForItem(ownerId: string, itemId: string) {
  const media = await prisma.mediaAsset.findMany({ where: { personalCollectionItemId: itemId }, select: { id: true } });
  if (!media.length) return;
  await prisma.personalCollectionProfile.updateMany({
    where: { ownerId, coverMediaId: { in: media.map((item) => item.id) } }, data: { coverMediaId: null },
  });
}
