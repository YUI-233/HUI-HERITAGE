import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";
import { usesCloudRuntime } from "./cloud-runtime";

export type HeroContent = {
  desktopImagePath: string | null;
  mobileImagePath: string | null;
  altText: string;
  attribution: string;
  desktopFocus: string;
  mobileFocus: string;
  brandName: string;
  brandTagline: string;
  eyebrow: string;
  headline: string;
  overlayTone: "none" | "light" | "dark";
  overlayOpacity: number;
};

export const defaultHeroContent: HeroContent = {
  desktopImagePath: null,
  mobileImagePath: null,
  altText: "",
  attribution: "",
  desktopFocus: "center center",
  mobileFocus: "center center",
  brandName: "HUI HERITAGE",
  brandTagline: "汉文回教古籍文物遗产",
  eyebrow: "HUI HERITAGE · 数字馆藏计划",
  headline: "让散落的汉文回教\n古籍与文物重新被看见",
  overlayTone: "none",
  overlayOpacity: 0,
};

function asHeroContent(value: unknown): HeroContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultHeroContent;
  const source = value as Record<string, unknown>;
  const nullableText = (key: "desktopImagePath" | "mobileImagePath") => {
    const value = typeof source[key] === "string" ? source[key] : null;
    return value?.startsWith("/site/hero/") && !usesCloudRuntime() ? value.replace("/site/hero/", "/api/site-media/hero/") : value;
  };
  const requiredText = (key: "altText" | "attribution" | "desktopFocus" | "mobileFocus" | "brandName" | "brandTagline" | "eyebrow" | "headline", fallback: string) => typeof source[key] === "string" ? source[key].trim() : fallback;
  const overlayTone = source.overlayTone === "light" || source.overlayTone === "dark" || source.overlayTone === "none" ? source.overlayTone : "none";
  const overlayOpacity = typeof source.overlayOpacity === "number" && Number.isFinite(source.overlayOpacity) ? Math.min(75, Math.max(0, Math.round(source.overlayOpacity))) : 0;
  return {
    desktopImagePath: nullableText("desktopImagePath"),
    mobileImagePath: nullableText("mobileImagePath"),
    altText: requiredText("altText", ""),
    attribution: requiredText("attribution", ""),
    desktopFocus: requiredText("desktopFocus", "center center"),
    mobileFocus: requiredText("mobileFocus", "center center"),
    brandName: requiredText("brandName", defaultHeroContent.brandName),
    brandTagline: requiredText("brandTagline", defaultHeroContent.brandTagline),
    eyebrow: requiredText("eyebrow", defaultHeroContent.eyebrow),
    headline: requiredText("headline", defaultHeroContent.headline),
    overlayTone,
    overlayOpacity,
  };
}

export async function getHeroContent(): Promise<HeroContent> {
  const cloud = await readCloudSetting<unknown>("home_hero");
  if (cloud !== undefined) return cloud ? asHeroContent(cloud) : defaultHeroContent;
  const setting = await prisma.siteSetting.findUnique({ where: { key: "home_hero" } });
  return setting ? asHeroContent(setting.value) : defaultHeroContent;
}

export async function saveHeroContent(content: HeroContent) {
  if (await writeCloudSetting("home_hero", content)) return content;
  return prisma.siteSetting.upsert({ where: { key: "home_hero" }, create: { key: "home_hero", value: content }, update: { value: content } });
}

export function validateHeroContent(value: unknown): HeroContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const content = asHeroContent(value);
  const allowedFocus = new Set(["left center", "center center", "right center", "center top", "center bottom"]);
  const isPath = (path: string | null) => path === null || /^\/(site\/hero|api\/site-media\/hero)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(path);
  if (!isPath(content.desktopImagePath) || !isPath(content.mobileImagePath) || !allowedFocus.has(content.desktopFocus) || !allowedFocus.has(content.mobileFocus) || content.altText.length > 160 || content.attribution.length > 240 || !content.brandName || content.brandName.length > 60 || content.brandTagline.length > 80 || content.eyebrow.length > 80 || !content.headline || content.headline.length > 120) return null;
  return content;
}
