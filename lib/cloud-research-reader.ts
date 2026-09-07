import { cloudD1, usesCloudRuntime } from "./cloud-runtime";
import type { ResearchArticleRecord } from "./research-repository";

type Row = { id: string; title: string; author: string | null; affiliation: string | null; publication: string | null; published_year: string | null; volume_issue: string | null; pages: string | null; identifier: string | null; summary: string; content_html: string; category: string; keywords_json: string; related_record_ids_json: string };
function array(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }

export async function readCloudResearchArticles(): Promise<ResearchArticleRecord[] | null> {
  if (!usesCloudRuntime()) return null;
  const db = await cloudD1();
  const result = await db!.prepare("SELECT id, title, author, affiliation, publication, published_year, volume_issue, pages, identifier, summary, content_html, category, keywords_json, related_record_ids_json FROM cloud_research_articles WHERE status = ? ORDER BY category ASC, title COLLATE NOCASE ASC").bind("APPROVED").all<Row>();
  return (result.results ?? []).map((row) => ({ id: row.id, title: row.title, author: row.author, affiliation: row.affiliation, publication: row.publication, publishedYear: row.published_year, volumeIssue: row.volume_issue, pages: row.pages, identifier: row.identifier, summary: row.summary, contentHtml: row.content_html, category: row.category, keywords: array(row.keywords_json), relatedRecordIds: array(row.related_record_ids_json) }));
}
