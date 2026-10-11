import "../research.css";
import "../research-reader.css";
import "../reader-overrides.css";
import "../article-reader-v2.css";
import { getCatalogRecord } from "../../../lib/catalog-repository";
import { prepareResearchContent } from "../../../lib/research-content";
import { getResearchArticle } from "../../../lib/research-repository";
import { ArticleBookmark, ReaderTools } from "../reader-tools";
import { headers } from "next/headers";
import Link from "next/link";
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
  if (!article) return <main className="research-page"><PublicHeader active="research"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "学术研究", href: "/research" }, { label: "文章详情" }]}/><section className="research-empty"><h1>未找到这条学术研究</h1><Link href="/research">返回学术研究</Link></section></main>;

  const [relatedRecords, preparedContent] = await Promise.all([
    Promise.all(article.relatedRecordIds.map(getCatalogRecord)),
    Promise.resolve(prepareResearchContent(article.contentHtml, article.title, article.summary)),
  ]);
  const related = relatedRecords.filter((record): record is NonNullable<typeof record> => record !== null);
  const hasTableOfContents = preparedContent.sections.length > 0;

  return <main className="research-page">
    <PublicHeader active="research"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "学术研究", href: "/research" }, { label: article.title }]}/>
    <article className="research-article">
      <header className="research-article-masthead">
        <p className="eyebrow">{article.category}</p>
        <div className="research-title-row"><h1>{article.title}</h1><div className="research-title-actions"><ArticleBookmark articleId={article.id}/>{canEdit && <a className="research-edit-link" href={`/admin/research?articleId=${encodeURIComponent(article.id)}`} aria-label="编辑本文" title="编辑本文">✎</a>}</div></div>
        <div className="research-byline">{article.author && <strong>{article.author}</strong>}{article.affiliation && <span>{article.affiliation}</span>}</div>
        <dl className="research-publication-meta"><div><dt>来源</dt><dd>{article.publication ?? "待补充"}</dd></div>{article.publishedYear && <div><dt>年份</dt><dd>{article.publishedYear}</dd></div>}{article.volumeIssue && <div><dt>卷期</dt><dd>{article.volumeIssue}</dd></div>}{article.pages && <div><dt>页码</dt><dd>{article.pages}</dd></div>}{article.identifier && <div><dt>DOI / 稳定链接</dt><dd>{article.identifier}</dd></div>}</dl>
        <section className="research-abstract" aria-labelledby="research-abstract-title"><p id="research-abstract-title">摘要</p><div>{article.summary}</div>{article.keywords.length > 0 && <footer><b>关键词</b>{article.keywords.map((keyword) => <a href={`/research?q=${encodeURIComponent(keyword)}`} key={keyword}>{keyword}</a>)}</footer>}</section>
      </header>
      <ReaderTools><div className={`research-reading-layout${hasTableOfContents ? "" : " research-reading-layout-without-toc"}`}>
        {hasTableOfContents && <nav className="research-toc" aria-label="文章目录"><span>文章目录</span><div>{preparedContent.sections.map((section) => <a href={`#${section.id}`} data-level={section.level} key={section.id}>{section.title}</a>)}</div><small>阅读进度将随正文滚动更新</small></nav>}
        <section className="research-reading-content" dangerouslySetInnerHTML={{ __html: preparedContent.html }} />
      </div></ReaderTools>
    </article>
    {related.length > 0 && <section className="research-related"><p className="eyebrow">RELATED CATALOGUE</p><h2>相关馆藏资料</h2><div>{related.map((record) => <a href={`/catalog/${record.id}`} key={record.id}><span>{record.catalogNumber ?? (record.type === "manuscript" ? "古籍" : "文物图像")}</span><b>{record.title}</b><small>{record.date} · {record.source}</small></a>)}</div></section>}
  </main>;
}
