import { prisma } from "./prisma";
import { readCloudResearchArticles } from "./cloud-research-reader";

export type ResearchArticleRecord = {
  id: string;
  title: string;
  author: string | null;
  affiliation: string | null;
  publication: string | null;
  publishedYear: string | null;
  volumeIssue: string | null;
  pages: string | null;
  identifier: string | null;
  summary: string;
  contentHtml: string;
  category: string;
  keywords: string[];
  relatedRecordIds: string[];
};

function toResearchRecord(article: Awaited<ReturnType<typeof prisma.researchArticle.findFirst>>, affiliation: string | null = null): ResearchArticleRecord | null {
  if (!article) return null;
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    affiliation,
    publication: article.publication,
    publishedYear: article.publishedYear,
    volumeIssue: article.volumeIssue,
    pages: article.pages,
    identifier: article.identifier,
    summary: article.summary,
    contentHtml: article.contentHtml ?? "",
    category: article.category,
    keywords: article.keywords,
    relatedRecordIds: article.relatedRecordIds,
  };
}

export async function listResearchArticles({ query = "", category }: { query?: string; category?: string } = {}): Promise<ResearchArticleRecord[]> {
  const cloudArticles = await readCloudResearchArticles();
  if (cloudArticles) {
    const term = query.trim().toLocaleLowerCase();
    return cloudArticles.filter((article) => (!category || article.category === category) && (!term || [article.title, article.author, article.publication, article.summary, article.contentHtml.replace(/<[^>]*>/g, " "), article.category, ...article.keywords].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)));
  }
  const articles = await prisma.researchArticle.findMany({ where: { status: "APPROVED" }, orderBy: [{ category: "asc" }, { title: "asc" }] });
  const affiliations = await prisma.$queryRawUnsafe<Array<{ id: string; affiliation: string | null }>>("SELECT id, affiliation FROM research_articles WHERE status='APPROVED'");
  const affiliationById = new Map(affiliations.map((item) => [item.id, item.affiliation]));
  const term = query.trim().toLocaleLowerCase();
  return articles.map((article) => toResearchRecord(article, affiliationById.get(article.id) ?? null)).filter((article): article is ResearchArticleRecord => article !== null).filter((article) => {
    const searchable = [article.title, article.author, article.publication, article.summary, (article.contentHtml ?? "").replace(/<[^>]*>/g, " "), article.category, ...article.keywords].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!category || article.category === category) && (!term || searchable.includes(term));
  });
}

export async function getResearchArticle(id: string): Promise<ResearchArticleRecord | null> {
  const cloudArticles = await readCloudResearchArticles();
  if (cloudArticles) return cloudArticles.find((article) => article.id === id) ?? null;
  const article = await prisma.researchArticle.findFirst({ where: { id, status: "APPROVED" } });
  if (!article) return null;
  const affiliation = await prisma.$queryRawUnsafe<Array<{ affiliation: string | null }>>("SELECT affiliation FROM research_articles WHERE id=$1", id);
  return toResearchRecord(article, affiliation[0]?.affiliation ?? null);
}
