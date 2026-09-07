import "../research.css";
import "../research-reader.css";
import "../reader-overrides.css";
import { getCatalogRecord } from "../../../lib/catalog-repository";
import { prepareResearchContent } from "../../../lib/research-content";
import { getResearchArticle } from "../../../lib/research-repository";
import { ReaderTools } from "../reader-tools";
import { headers } from "next/headers";
import { getSignedInUser, userPermissions } from "../../../lib/local-auth";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";

export const dynamic = "force-dynamic";
type ResearchDetailPageProps = { params: Promise<{ id: string }> };

export default async function ResearchDetailPage({ params }: ResearchDetailPageProps) {
  const { id } = await params;
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  const canEdit = userPermissions(viewer).includes("RESEARCH_WRITE");
  const article = await getResearchArticle(id);
  if (!article) return <main className="research-page"><PublicHeader active="research"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "学术研究", href: "/research" }, { label: "文章详情" }]}/><section className="research-empty"><h1>未找到这条学术研究</h1><a href="/research">返回学术研究</a></section></main>;

  const [relatedRecords, preparedContent] = await Promise.all([
    Promise.all(article.relatedRecordIds.map(getCatalogRecord)),
    Promise.resolve(prepareResearchContent(article.contentHtml, article.title, article.summary)),
  ]);
  const related = relatedRecords.filter((record): record is NonNullable<typeof record> => record !== null);
  const hasTableOfContents = preparedContent.sections.length > 0;

  return <main className="research-page">
    <PublicHeader active="research"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "学术研究", href: "/research" }, { label: article.title }]}/>
    <article className="research-article">
      <p className="eyebrow">{article.category}</p><div className="research-title-row"><h1>{article.title}</h1>{canEdit && <a className="research-edit-link" href={`/admin/research?articleId=${encodeURIComponent(article.id)}`} aria-label="编辑本文" title="编辑本文">✎</a>}</div><div className="research-byline">{article.author && <span>{article.author}</span>}{article.affiliation && <span>{article.affiliation}</span>}</div><p className="research-summary-label">摘要</p><p className="research-article-summary">{article.summary}</p>
      <dl><div><dt>来源</dt><dd>{article.publication ?? "待补充"}</dd></div>{article.publishedYear && <div><dt>年份</dt><dd>{article.publishedYear}</dd></div>}{article.volumeIssue && <div><dt>卷期</dt><dd>{article.volumeIssue}</dd></div>}{article.pages && <div><dt>页码</dt><dd>{article.pages}</dd></div>}{article.identifier && <div><dt>DOI / 稳定链接</dt><dd>{article.identifier}</dd></div>}</dl>
      {article.keywords.length > 0 && <section className="research-keywords" aria-label="主题词"><p>主题词</p><div>{article.keywords.map((keyword) => <a href={`/research?q=${encodeURIComponent(keyword)}`} key={keyword}>{keyword}</a>)}</div></section>}
      <ReaderTools><div className={`research-reading-layout${hasTableOfContents ? "" : " research-reading-layout-without-toc"}`}>
        {hasTableOfContents && <nav className="research-toc" aria-label="文章目录"><span>文章目录</span>{preparedContent.sections.map((section) => <a href={`#${section.id}`} data-level={section.level} key={section.id}>{section.title}</a>)}</nav>}
        <section className="research-reading-content" dangerouslySetInnerHTML={{ __html: preparedContent.html }} />
      </div></ReaderTools>
    </article>
    {related.length > 0 && <section className="research-related"><p className="eyebrow">RELATED CATALOGUE</p><h2>相关馆藏资料</h2><div>{related.map((record) => <a href={`/catalog/${record.id}`} key={record.id}><span>{record.catalogNumber ?? (record.type === "manuscript" ? "古籍" : "文物图像")}</span><b>{record.title}</b><small>{record.date} · {record.source}</small></a>)}</div></section>}
  </main>;
}
