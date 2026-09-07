import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";
import { cloudD1, usesCloudRuntime } from "./cloud-runtime";

export type FeaturedExhibitionSourceType = "HOLDING" | "CATALOG" | "PERSONAL";

export type FeaturedExhibitionContent = {
  sourceType: FeaturedExhibitionSourceType | null;
  sourceId: string | null;
  title: string;
  meta: string;
  description: string;
  buttonLabel: string;
};

export type FeaturedExhibitionCandidate = {
  id: string;
  sourceType: FeaturedExhibitionSourceType;
  sourceLabel: string;
  sourceLines: [string, string];
  title: string;
  meta: string;
  description: string;
  image: string;
  href: string;
};

export type FeaturedExhibition = Omit<FeaturedExhibitionCandidate, "sourceLabel"> & {
  sourceLabel: string;
  buttonLabel: string;
};

const settingKey = "home_featured_exhibition";
const defaults: FeaturedExhibitionContent = {
  sourceType: null,
  sourceId: null,
  title: "",
  meta: "",
  description: "",
  buttonLabel: "查看详情",
};

const originLabels = { DOMESTIC: "国内馆藏", OVERSEAS: "海外馆藏", PERSONAL: "个人馆藏" } as const;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readContent(value: unknown): FeaturedExhibitionContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const item = value as Record<string, unknown>;
  const sourceType = item.sourceType === "HOLDING" || item.sourceType === "CATALOG" || item.sourceType === "PERSONAL" ? item.sourceType : null;
  const sourceId = text(item.sourceId, 80) || null;
  return {
    sourceType: sourceType && sourceId ? sourceType : null,
    sourceId: sourceType && sourceId ? sourceId : null,
    title: text(item.title, 120),
    meta: text(item.meta, 160),
    description: text(item.description, 420),
    buttonLabel: text(item.buttonLabel, 24) || defaults.buttonLabel,
  };
}

function publicImagePath(storageKey: string) {
  return `/${storageKey.replace(/^\/+/, "")}`;
}

function traditionalSourceLabel(value: string) {
  const characters: Record<string, string> = {
    个: "個", 书: "書", 馆: "館", 图: "圖", 国: "國", 华: "華", 学: "學", 术: "術",
    斋: "齋", 阁: "閣", 轩: "軒", 库: "庫", 东: "東", 门: "門", 湾: "灣", 亚: "亞",
    广: "廣", 县: "縣", 区: "區", 汉: "漢", 马: "馬",
  };
  return [...value].map((character) => characters[character] ?? character).join("");
}

type CloudCatalogCandidateRow = {
  id: string;
  type: "manuscript" | "artifact";
  title: string;
  author: string | null;
  era: string | null;
  category: string | null;
  description: string | null;
  source: string | null;
};

type CloudHoldingCandidateRow = {
  id: string;
  record_id: string;
  institution: string;
  region: string;
  origin: "DOMESTIC" | "OVERSEAS";
  description: string | null;
  record_json: string;
};

type CloudCandidateMediaRow = { id: string; record_id: string };

type CloudHoldingSnapshot = {
  title?: string;
  author?: string | null;
  era?: string | null;
  category?: string | null;
};

function cloudMediaPath(recordId: string, mediaId: string) {
  return `/api/catalog/${recordId}/media/${mediaId}`;
}

function readHoldingSnapshot(value: string): CloudHoldingSnapshot {
  try {
    const parsed = JSON.parse(value) as CloudHoldingSnapshot;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function listCloudFeaturedExhibitionCandidates(): Promise<FeaturedExhibitionCandidate[]> {
  const db = await cloudD1();
  if (!db) return [];

  const [catalogResult, holdingResult, mediaResult] = await Promise.all([
    db.prepare(`SELECT id, type, title, author, era, category, description, source
      FROM cloud_catalog_records WHERE status = ? ORDER BY updated_at DESC, id ASC`).bind("APPROVED").all<CloudCatalogCandidateRow>(),
    db.prepare(`SELECT id, record_id, institution, region, origin, description, record_json
      FROM cloud_holdings WHERE status = ? ORDER BY updated_at DESC, id ASC`).bind("APPROVED").all<CloudHoldingCandidateRow>(),
    db.prepare(`SELECT id, record_id FROM cloud_media_assets
      WHERE visibility = ? AND mime_type LIKE ? ORDER BY sort_order ASC, created_at ASC`).bind("PUBLIC", "image/%").all<CloudCandidateMediaRow>(),
  ]);

  const firstMediaByRecord = new Map<string, string>();
  for (const media of mediaResult.results ?? []) {
    if (!firstMediaByRecord.has(media.record_id)) firstMediaByRecord.set(media.record_id, media.id);
  }

  const holdings = holdingResult.results ?? [];
  const holdingCandidates = holdings.flatMap((holding) => {
    const mediaId = firstMediaByRecord.get(holding.record_id);
    if (!mediaId) return [];
    const snapshot = readHoldingSnapshot(holding.record_json);
    const title = text(snapshot.title, 160);
    if (!title) return [];
    return [{
      id: holding.id,
      sourceType: "HOLDING" as const,
      sourceLabel: `图书馆馆藏 · ${originLabels[holding.origin]}`,
      sourceLines: [traditionalSourceLabel(holding.region || originLabels[holding.origin]), traditionalSourceLabel(holding.institution)] as [string, string],
      title,
      meta: [text(snapshot.era, 80), text(snapshot.author, 120), holding.institution].filter(Boolean).join(" · ") || holding.institution,
      description: holding.description?.trim() || "馆藏资料，等待补充说明。",
      image: cloudMediaPath(holding.record_id, mediaId),
      href: `/holdings/${holding.id}`,
    }];
  });

  const linkedCatalogIds = new Set(holdings.map((holding) => holding.record_id));
  const catalogCandidates = (catalogResult.results ?? []).flatMap((record) => {
    if (linkedCatalogIds.has(record.id)) return [];
    const mediaId = firstMediaByRecord.get(record.id);
    if (!mediaId) return [];
    const isBook = record.type === "manuscript";
    return [{
      id: record.id,
      sourceType: "CATALOG" as const,
      sourceLabel: `数字化遗产 · ${isBook ? "古籍" : "文物"}`,
      sourceLines: ["數字化遺產", traditionalSourceLabel(record.source?.trim() || (isBook ? "古籍資料" : "文物資料"))] as [string, string],
      title: record.title,
      meta: [record.era?.trim(), isBook ? record.author?.trim() : record.category?.trim(), record.source?.trim()].filter(Boolean).join(" · ") || `平台数字化${isBook ? "古籍" : "文物"}`,
      description: record.description?.trim() || `数字化${isBook ? "古籍" : "文物"}资料，等待补充说明。`,
      image: cloudMediaPath(record.id, mediaId),
      href: `/catalog/${record.id}`,
    }];
  });

  return [...holdingCandidates, ...catalogCandidates];
}

export async function listFeaturedExhibitionCandidates(): Promise<FeaturedExhibitionCandidate[]> {
  if (usesCloudRuntime()) return listCloudFeaturedExhibitionCandidates();
  const [holdings, books, artifacts, personalItems] = await Promise.all([
    prisma.holding.findMany({
      where: { status: "APPROVED" },
      include: {
        book: { include: { media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, take: 1 } } },
        artifact: { include: { media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, take: 1 } } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
    prisma.book.findMany({
      where: { status: "APPROVED", media: { some: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } } } },
      include: { media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
    prisma.artifact.findMany({
      where: { status: "APPROVED", media: { some: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } } } },
      include: { media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
    prisma.personalCollectionItem.findMany({
      where: { status: "APPROVED", isPublic: true, media: { some: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } } } },
      include: { media: { where: { visibility: "PUBLIC", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" }, take: 1 }, owner: { select: { displayName: true, email: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
  ]);

  const holdingCandidates = holdings.flatMap((holding) => {
    const record = holding.book ?? holding.artifact;
    const media = record?.media[0];
    if (!record || !media) return [];
    const author = holding.book?.author?.trim();
    const era = holding.book?.dynasty?.trim() ?? holding.artifact?.era?.trim();
    return [{
      id: holding.id,
      sourceType: "HOLDING" as const,
      sourceLabel: `图书馆馆藏 · ${originLabels[holding.origin]}`,
      sourceLines: [traditionalSourceLabel(holding.region || originLabels[holding.origin]), traditionalSourceLabel(holding.institution)] as [string, string],
      title: record.title,
      meta: [era, author, holding.institution].filter(Boolean).join(" · ") || holding.institution,
      description: holding.description?.trim() || record.description?.trim() || "馆藏资料，等待补充说明。",
      image: publicImagePath(media.storageKey),
      href: `/holdings/${holding.id}`,
    }];
  });

  const linkedCatalogIds = new Set(holdings.flatMap((holding) => [holding.bookId, holding.artifactId]).filter(Boolean));
  const catalogCandidates = [
    ...books.filter((book) => !linkedCatalogIds.has(book.id)).flatMap((book) => {
      const media = book.media[0];
      if (!media) return [];
      return [{ id: book.id, sourceType: "CATALOG" as const, sourceLabel: "数字化遗产 · 古籍", sourceLines: ["數字化遺產", traditionalSourceLabel(book.source?.trim() || "古籍資料")] as [string, string], title: book.title, meta: [book.dynasty?.trim(), book.author?.trim(), book.source?.trim()].filter(Boolean).join(" · ") || "平台数字化古籍", description: book.description?.trim() || "数字化古籍资料，等待补充说明。", image: publicImagePath(media.storageKey), href: `/catalog/${book.id}` }];
    }),
    ...artifacts.filter((artifact) => !linkedCatalogIds.has(artifact.id)).flatMap((artifact) => {
      const media = artifact.media[0];
      if (!media) return [];
      return [{ id: artifact.id, sourceType: "CATALOG" as const, sourceLabel: "数字化遗产 · 文物", sourceLines: ["數字化遺產", traditionalSourceLabel(artifact.source?.trim() || "文物資料")] as [string, string], title: artifact.title, meta: [artifact.era?.trim(), artifact.category?.trim(), artifact.source?.trim()].filter(Boolean).join(" · ") || "平台数字化文物", description: artifact.description?.trim() || "数字化文物资料，等待补充说明。", image: publicImagePath(media.storageKey), href: `/catalog/${artifact.id}` }];
    }),
  ];

  const personalCandidates = personalItems.flatMap((item) => {
    const media = item.media[0];
    if (!media) return [];
    const collector = item.owner.displayName?.trim() || item.owner.email;
    return [{
      id: item.id,
      sourceType: "PERSONAL" as const,
      sourceLabel: `个人收藏馆 · ${item.type === "BOOK" ? "书籍" : "藏品"}`,
      sourceLines: ["個人收藏館", traditionalSourceLabel(collector)] as [string, string],
      title: item.title,
      meta: [item.era?.trim(), item.creator?.trim(), collector].filter(Boolean).join(" · ") || "个人公开收藏",
      description: item.description?.trim() || "个人公开收藏资料，等待补充说明。",
      image: `/api/personal-collection/public/${item.id}/media/${media.id}`,
      href: `/personal-collection/public/${item.id}`,
    }];
  });

  return [...holdingCandidates, ...catalogCandidates, ...personalCandidates];
}

export async function getFeaturedExhibitionContent(): Promise<FeaturedExhibitionContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return cloud ? readContent(cloud) : defaults;
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaults;
}

export async function saveFeaturedExhibitionContent(value: unknown) {
  const content = readContent(value);
  if (content.sourceId && content.sourceType) {
    const candidates = await listFeaturedExhibitionCandidates();
    if (!candidates.some((candidate) => candidate.id === content.sourceId && candidate.sourceType === content.sourceType)) {
      throw new Error("所选资料已不符合首页展示条件，请重新选择公开且带图片的资料。");
    }
  }
  if (await writeCloudSetting(settingKey, content)) return content;
  return prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } }).then(() => content);
}

export async function getFeaturedExhibition(): Promise<FeaturedExhibition | null> {
  const [content, candidates] = await Promise.all([getFeaturedExhibitionContent(), listFeaturedExhibitionCandidates()]);
  if (!content.sourceId || !content.sourceType) return null;
  const selected = candidates.find((candidate) => candidate.id === content.sourceId && candidate.sourceType === content.sourceType);
  if (!selected) return null;
  return {
    ...selected,
    title: content.title || selected.title,
    meta: content.meta || selected.meta,
    description: content.description || selected.description,
    buttonLabel: content.buttonLabel,
  };
}

export async function getFeaturedExhibitionAdminData() {
  const [content, candidates] = await Promise.all([getFeaturedExhibitionContent(), listFeaturedExhibitionCandidates()]);
  return { content, candidates };
}
