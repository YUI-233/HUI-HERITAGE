import type { CatalogRecord } from "./catalog";
import { listCatalogRecords } from "./catalog-repository";
import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";

export type HomeRecommendedBook = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  image: string;
  imageAccess: CatalogRecord["imageAccess"];
  href: string;
};

export type HomeRecommendedBooksContent = { slots: Array<string | null> };

const settingKey = "home_recommended_books";
const slotCount = 5;
const defaults: HomeRecommendedBooksContent = { slots: Array.from({ length: slotCount }, () => null) };

function metadataValue(record: CatalogRecord, label: string) {
  return record.metadata?.find((item) => item.label === label)?.value?.trim() || "";
}

function toCandidate(record: CatalogRecord): HomeRecommendedBook {
  const dynasty = metadataValue(record, "年代");
  const author = metadataValue(record, "作者");
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    meta: [dynasty, author, record.source].filter(Boolean).join(" · "),
    image: record.image,
    imageAccess: record.imageAccess,
    href: `/catalog/${record.id}`,
  };
}

function readContent(value: unknown): HomeRecommendedBooksContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const rawSlots = (value as Record<string, unknown>).slots;
  return {
    slots: Array.from({ length: slotCount }, (_, index) => {
      const value = Array.isArray(rawSlots) ? rawSlots[index] : null;
      return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;
    }),
  };
}

export async function listHomeRecommendedBookCandidates(): Promise<HomeRecommendedBook[]> {
  return (await listCatalogRecords({ type: "manuscript" })).map(toCandidate);
}

export async function getHomeRecommendedBooksContent(): Promise<HomeRecommendedBooksContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return cloud ? readContent(cloud) : defaults;
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaults;
}

export async function saveHomeRecommendedBooksContent(value: unknown) {
  const content = readContent(value);
  const selectedIds = content.slots.filter((id): id is string => Boolean(id));
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error("同一本古籍不能重复出现在多个推荐位。");
  if (selectedIds.length) {
    const candidateIds = new Set((await listHomeRecommendedBookCandidates()).map((candidate) => candidate.id));
    if (selectedIds.some((id) => !candidateIds.has(id))) throw new Error("所选古籍已不符合首页推荐条件，请重新选择已审核通过的数字化古籍。");
  }
  if (!await writeCloudSetting(settingKey, content)) await prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } });
  return content;
}

export async function getHomeRecommendedBooks(): Promise<Array<HomeRecommendedBook | null>> {
  const [content, candidates] = await Promise.all([getHomeRecommendedBooksContent(), listHomeRecommendedBookCandidates()]);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return content.slots.map((id) => id ? byId.get(id) ?? null : null);
}

export async function getHomeRecommendedBooksAdminData() {
  const [content, candidates] = await Promise.all([getHomeRecommendedBooksContent(), listHomeRecommendedBookCandidates()]);
  return { content, candidates };
}
