import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";
import { listResearchArticles } from "./research-repository";
import { usesCloudRuntime } from "./cloud-runtime";

export type HomeFeaturedResearchContent = {
  articleId: string | null;
  buttonLabel: string;
  backgroundImagePath: string | null;
};

export type HomeFeaturedResearchCandidate = {
  id: string;
  title: string;
  author: string | null;
  affiliation: string | null;
  publication: string | null;
  publishedYear: string | null;
  category: string;
  summary: string;
  keywords: string[];
  meta: string;
  href: string;
};

export type HomeFeaturedResearch = HomeFeaturedResearchCandidate & {
  buttonLabel: string;
  backgroundImagePath: string | null;
};

const settingKey = "home_featured_research";
const defaults: HomeFeaturedResearchContent = {
  articleId: null,
  buttonLabel: "继续阅读",
  backgroundImagePath: null,
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readContent(value: unknown): HomeFeaturedResearchContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const item = value as Record<string, unknown>;
  const articleId = text(item.articleId, 80) || null;
  const backgroundImagePath = text(item.backgroundImagePath, 240) || null;
  return {
    articleId,
    buttonLabel: text(item.buttonLabel, 24) || defaults.buttonLabel,
    backgroundImagePath: backgroundImagePath && /^\/site\/featured-research\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(backgroundImagePath) ? backgroundImagePath : null,
  };
}

function toCandidate(article: {
  id: string;
  title: string;
  author: string | null;
  affiliation: string | null;
  publication: string | null;
  publishedYear: string | null;
  category: string;
  summary: string;
  keywords: string[];
}): HomeFeaturedResearchCandidate {
  return {
    ...article,
    meta: [article.author, article.affiliation, article.publication, article.publishedYear].filter(Boolean).join(" · ") || article.category,
    href: `/research/${article.id}`,
  };
}

export async function listHomeFeaturedResearchCandidates(): Promise<HomeFeaturedResearchCandidate[]> {
  if (usesCloudRuntime()) return (await listResearchArticles()).map((article) => toCandidate(article));
  const articles = await prisma.researchArticle.findMany({
    where: { status: "APPROVED" },
    select: { id: true, title: true, author: true, publication: true, publishedYear: true, category: true, summary: true, keywords: true },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
  const affiliations = await prisma.$queryRawUnsafe<Array<{ id: string; affiliation: string | null }>>("SELECT id, affiliation FROM research_articles WHERE status='APPROVED'");
  const affiliationById = new Map(affiliations.map((item) => [item.id, item.affiliation]));
  return articles.map((article) => toCandidate({ ...article, affiliation: affiliationById.get(article.id) ?? null }));
}

export async function getHomeFeaturedResearchContent(): Promise<HomeFeaturedResearchContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return cloud ? readContent(cloud) : defaults;
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaults;
}

export async function saveHomeFeaturedResearchContent(value: unknown) {
  const content = readContent(value);
  if (content.articleId) {
    const article = await prisma.researchArticle.findFirst({ where: { id: content.articleId, status: "APPROVED" }, select: { id: true } });
    if (!article) throw new Error("所选文章已不符合首页展示条件，请重新选择已审核通过的文章。");
  }
  if (!await writeCloudSetting(settingKey, content)) await prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } });
  return content;
}

export async function getHomeFeaturedResearch(): Promise<HomeFeaturedResearch | null> {
  const content = await getHomeFeaturedResearchContent();
  if (!content.articleId) return null;
  if (usesCloudRuntime()) {
    const article = (await listResearchArticles()).find((item) => item.id === content.articleId);
    return article ? { ...toCandidate(article), buttonLabel: content.buttonLabel, backgroundImagePath: content.backgroundImagePath } : null;
  }
  const article = await prisma.researchArticle.findFirst({
    where: { id: content.articleId, status: "APPROVED" },
    select: { id: true, title: true, author: true, publication: true, publishedYear: true, category: true, summary: true, keywords: true },
  });
  if (!article) return null;
  const affiliations = await prisma.$queryRawUnsafe<Array<{ affiliation: string | null }>>("SELECT affiliation FROM research_articles WHERE id=$1", article.id);
  return { ...toCandidate({ ...article, affiliation: affiliations[0]?.affiliation ?? null }), buttonLabel: content.buttonLabel, backgroundImagePath: content.backgroundImagePath };
}

export async function getHomeFeaturedResearchAdminData() {
  const [content, candidates] = await Promise.all([getHomeFeaturedResearchContent(), listHomeFeaturedResearchCandidates()]);
  return { content, candidates };
}
