import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";
import { usesCloudRuntime } from "./cloud-runtime";

export const searchHeroKeys = ["catalog", "holdings", "research"] as const;
export type SearchHeroKey = typeof searchHeroKeys[number];
export type SearchHeroContent = { images: Record<SearchHeroKey, string | null>; focus: Record<SearchHeroKey, string> };

const settingKey = "search_hero_images";
const allowedFocus = new Set(["left center", "center center", "right center", "center top", "center bottom"]);
export const defaultSearchHeroContent: SearchHeroContent = {
  images: { catalog: null, holdings: null, research: null },
  focus: { catalog: "center center", holdings: "center center", research: "center center" },
};

function imagePath(value: unknown) {
  const path = typeof value === "string" ? value : null;
  if (!path || !/^\/(site\/search-hero|api\/site-media\/search-hero)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(path)) return null;
  return path.startsWith("/site/search-hero/") && !usesCloudRuntime() ? path.replace("/site/search-hero/", "/api/site-media/search-hero/") : path;
}

function readContent(value: unknown): SearchHeroContent {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const images = source.images && typeof source.images === "object" && !Array.isArray(source.images) ? source.images as Record<string, unknown> : {};
  const focus = source.focus && typeof source.focus === "object" && !Array.isArray(source.focus) ? source.focus as Record<string, unknown> : {};
  return {
    images: Object.fromEntries(searchHeroKeys.map((key) => [key, imagePath(images[key])])) as SearchHeroContent["images"],
    focus: Object.fromEntries(searchHeroKeys.map((key) => [key, typeof focus[key] === "string" && allowedFocus.has(focus[key] as string) ? focus[key] : defaultSearchHeroContent.focus[key]])) as SearchHeroContent["focus"],
  };
}

export async function getSearchHeroContent(): Promise<SearchHeroContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return readContent(cloud);
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaultSearchHeroContent;
}

export async function saveSearchHeroContent(value: unknown) {
  const content = readContent(value);
  if (await writeCloudSetting(settingKey, content)) return content;
  await prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } });
  return content;
}
