import "./research.css";
import "./research-search-alignment.css";
import "../search-hero.css";
import { listResearchArticles } from "../../lib/research-repository";
import { PublicHeader } from "../components/public-header";
import { getSearchHeroContent } from "../../lib/search-hero-content";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type ResearchArticle = (Awaited<ReturnType<typeof listResearchArticles>>)[number];
type ResearchPageProps = { searchParams: Promise<{ q?: string; category?: string; view?: string }> };

export default async function ResearchPage({ searchParams }: ResearchPageProps) {
  const { q = "", category = "", view = "category" } = await searchParams;
  const articles = await listResearchArticles({ query: q, category });
  const heroContent = await getSearchHeroContent();
  const browseView = view === "author" ? "author" : "category";
  const orderedArticles = [...articles].sort((a, b) => browseView === "author"
    ? (a.author || "佚名").localeCompare(b.author || "佚名", "zh-CN") || a.title.localeCompare(b.title, "zh-CN")
    : a.category.localeCompare(b.category, "zh-CN") || a.title.localeCompare(b.title, "zh-CN"));
  const articlesByCategory = orderedArticles.reduce<Record<string, ResearchArticle[]>>((groups, article) => {
    const categoryName = article.category || "未分类";
    (groups[categoryName] ??= []).push(article);
    return groups;
  }, {});
  const makeLink = (nextView: "author" | "category") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (nextView !== "category") params.set("view", nextView);
    const value = params.toString();
    return value ? `/research?${value}` : "/research";
  };
  return <main className="research-page">
    <PublicHeader active="research"/>
    <section className={`research-hero ${heroContent.images.research ? "search-hero-with-image" : ""}`} style={heroContent.images.research ? { "--search-hero-image": `url("${heroContent.images.research}")`, "--search-hero-focus": heroContent.focus.research } as CSSProperties : undefined}><p className="eyebrow">ACADEMIC RESEARCH</p><h1>学术研究</h1><p>这里提供学术研究的检索与阅读起点，而不是定论。每一条路径都可回到馆藏记录，继续查看来源、主题词与相关资料。</p><form action="/research" method="get" className="research-search"><input name="q" defaultValue={q} placeholder="检索学术研究题名、主题词或资料线索" aria-label="检索学术研究"/>{category && <input type="hidden" name="category" value={category}/>}<button type="submit">检索</button></form></section>
    <section className="research-list"><nav className="research-filters" aria-label="学术研究浏览方式"><a href={makeLink("category")} aria-current={browseView === "category" ? "page" : undefined}>按分类</a><a href={makeLink("author")} aria-current={browseView === "author" ? "page" : undefined}>按作者</a></nav>{orderedArticles.length ? browseView === "category" ? <div className="research-category-groups">{Object.entries(articlesByCategory).map(([categoryName, categoryArticles]) => <CategoryGroup categoryName={categoryName} articles={categoryArticles} key={categoryName}/>)}</div> : orderedArticles.map((article, index) => <a href={`/research/${article.id}`} key={article.id}><span>{String(index + 1).padStart(2, "0")}</span><div><p className="research-category">{article.author || "佚名"}</p><h2>{article.title}</h2><p>{article.summary}</p></div><b>查看资料 →</b></a>) : <div className="research-empty"><h2>没有找到相符的学术研究</h2><Link href="/research">查看全部学术研究</Link></div>}</section>
    <section className="research-note"><p>使用提示</p><span>资料信息会随整理、考证与补充持续更新；引用时请以具体馆藏详情页显示的题名与收藏来源为准。</span></section>
  </main>;
}

function CategoryGroup({ categoryName, articles }: { categoryName: string; articles: ResearchArticle[] }) {
  const visibleArticles = articles.slice(0, 6);
  const hiddenArticles = articles.slice(6);
  return <section className="research-category-group" aria-labelledby={`research-category-${categoryName}`}><header><p>学术分类</p><h2 id={`research-category-${categoryName}`}>{categoryName}</h2><span>{articles.length} 篇文章</span></header><div className="research-card-grid">{visibleArticles.map((article, index) => <ResearchCard article={article} index={index + 1} key={article.id}/>)}</div>{hiddenArticles.length > 0 && <details className="research-category-more"><summary>展开全部 {articles.length} 篇文章 <span aria-hidden="true">↓</span></summary><div className="research-card-grid">{hiddenArticles.map((article, index) => <ResearchCard article={article} index={index + 7} key={article.id}/>)}</div></details>}</section>;
}

function ResearchCard({ article, index }: { article: ResearchArticle; index: number }) {
  return <a className="research-card" href={`/research/${article.id}`}><span>{String(index).padStart(2, "0")}</span><div><p className="research-card-author">{article.author || "佚名"}</p><h3>{article.title}</h3><p className="research-card-summary">{article.summary}</p></div><b>查看资料 →</b></a>;
}
