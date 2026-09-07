import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";

export const homeBrowseKeys = ["manuscript", "artifact", "holdings", "research"] as const;
export type HomeBrowseKey = typeof homeBrowseKeys[number];
export type HomeBrowseContent = { images: Record<HomeBrowseKey, string> };

const settingKey = "home_browse_images";
export const defaultHomeBrowseContent: HomeBrowseContent = {
  images: {
    manuscript: "/site/home-browse/manuscript-scan.png",
    artifact: "/site/home-browse/artifact-scan.jpg",
    holdings: "/site/home-browse/library-search.png",
    research: "/site/home-browse/academic-research.png",
  },
};

function imagePath(value: unknown, fallback: string) {
  return typeof value === "string" && /^\/site\/home-browse\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(value) ? value : fallback;
}

function readContent(value: unknown): HomeBrowseContent {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).images : null;
  const images = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return { images: {
    manuscript: imagePath(images.manuscript, defaultHomeBrowseContent.images.manuscript),
    artifact: imagePath(images.artifact, defaultHomeBrowseContent.images.artifact),
    holdings: imagePath(images.holdings, defaultHomeBrowseContent.images.holdings),
    research: imagePath(images.research, defaultHomeBrowseContent.images.research),
  } };
}

export async function getHomeBrowseContent(): Promise<HomeBrowseContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return cloud ? readContent(cloud) : defaultHomeBrowseContent;
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaultHomeBrowseContent;
}

export async function saveHomeBrowseContent(value: unknown) {
  const content = readContent(value);
  if (await writeCloudSetting(settingKey, content)) return content;
  await prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } });
  return content;
}
