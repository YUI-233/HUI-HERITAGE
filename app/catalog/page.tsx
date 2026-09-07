import "./catalog.css";
import "./catalog-extra.css";
import "./catalog-description.css";
import "../search-hero.css";
import "../access.css";
import { PublicHeader } from "../components/public-header";
import { findCatalogRecords, listCatalogRecords } from "../../lib/catalog-repository";
import { manuscriptCategoryGroups } from "../../lib/manuscript-categories";
import { getSearchHeroContent } from "../../lib/search-hero-content";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type CatalogPageProps = { searchParams: Promise<{ q?: string; type?: string; title?: string; category?: string; language?: string; author?: string; time?: string; imprint?: string; page?: string }> };
type Facet = "title" | "category" | "language" | "author" | "time" | "imprint";

const valueFor = (record: Awaited<ReturnType<typeof listCatalogRecords>>[number], label: string) => record.metadata?.find((item) => item.label === label)?.value ?? "";
const manuscriptCaption = (record: Awaited<ReturnType<typeof listCatalogRecords>>[number]) => [record.date, valueFor(record, "作者")].filter(Boolean).join(" · ");
const artifactCaption = (record: Awaited<ReturnType<typeof listCatalogRecords>>[number]) => [record.date, valueFor(record, "作者")].filter(Boolean).join(" · ");
const optionsFor = (records: Awaited<ReturnType<typeof listCatalogRecords>>, facet: Facet) => {
  const values = records.flatMap((record) => {
    if (facet === "title") return [record.title];
    if (facet === "category") return [valueFor(record, "分类")];
    if (facet === "language") return [valueFor(record, "语言")];
    if (facet === "author") return [valueFor(record, "作者")];
    if (facet === "time") return [record.date];
    return [valueFor(record, "刊刻主体")];
  }).filter(Boolean);
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "zh-CN"));
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { q = "", type = "", title = "", category = "", language = "", author = "", time = "", imprint = "", page: pageParam = "1" } = await searchParams;
  const requestedPage = Number.parseInt(pageParam, 10) || 1;
  const [allRecords, heroContent] = await Promise.all([listCatalogRecords({ type }), getSearchHeroContent()]);
  const result = await findCatalogRecords({ query: q, type, title, category, language, author, time, imprint, page: requestedPage });
  const { records, total, page, totalPages } = result;
  const manuscriptOnlyResults = records.length > 0 && records.every((record) => record.type === "manuscript");
  const filters = { title, category, language, author, time, imprint };
  const titleText = type === "manuscript" ? "数字化古籍" : type === "artifact" ? "数字化文物" : "数字化遗产";
  const makeLink = ({ nextType = type, nextPage = 1 }: { nextType?: string; nextPage?: number } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextType) params.set("type", nextType);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/catalog?${query}` : "/catalog";
  };
  const hasFilters = Boolean(q || type || Object.values(filters).some(Boolean));

  return <><PublicHeader active="catalog"/><main className="catalog-page">
    <section className={`catalog-hero ${heroContent.images.catalog ? "search-hero-with-image" : ""}`} style={heroContent.images.catalog ? { "--search-hero-image": `url("${heroContent.images.catalog}")`, "--search-hero-focus": heroContent.focus.catalog } as CSSProperties : undefined}><p>HUI HERITAGE · DIGITAL HERITAGE</p><h1>{titleText}</h1><form action="/catalog" method="get" className="catalog-search"><input name="q" type="search" defaultValue={q} placeholder="检索题名、作者、年代、刊刻机构或主题" aria-label="检索数字化遗产"/>{type && <input type="hidden" name="type" value={type}/>}<button type="submit">检索</button></form></section>
    <section className="catalog-content">
      <nav className="catalog-filters" aria-label="资料类型筛选"><a href={makeLink({ nextType: "" })} aria-current={!type ? "page" : undefined}>全部</a><a href={makeLink({ nextType: "manuscript" })} aria-current={type === "manuscript" ? "page" : undefined}>古籍</a><a href={makeLink({ nextType: "artifact" })} aria-current={type === "artifact" ? "page" : undefined}>文物</a></nav>
      <form className="catalog-facet-form" action="/catalog" method="get" aria-label="数字化遗产筛选">
        {type && <input type="hidden" name="type" value={type}/>}<input type="hidden" name="q" value={q}/>
        <label>书名<input list="catalog-title-options" name="title" defaultValue={title} placeholder="输入或选择书名"/><datalist id="catalog-title-options">{optionsFor(allRecords, "title").map((option) => <option value={option} key={option}/>)}</datalist></label>
        <label>分类<select name="category" defaultValue={category}><option value="">全部分类</option>{manuscriptCategoryGroups.map((group) => <optgroup label={group.label} key={group.label}>{group.options.map((option) => <option value={option} key={option}>{option}</option>)}</optgroup>)}</select></label>
        <label>语言<select name="language" defaultValue={language}><option value="">全部语言</option>{optionsFor(allRecords, "language").map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
        <label>作者<input list="catalog-author-options" name="author" defaultValue={author} placeholder="输入或选择作者"/><datalist id="catalog-author-options">{optionsFor(allRecords, "author").map((option) => <option value={option} key={option}/>)}</datalist></label>
        <label>时间<input list="catalog-time-options" name="time" defaultValue={time} placeholder="如：1907、清代"/><datalist id="catalog-time-options">{optionsFor(allRecords, "time").map((option) => <option value={option} key={option}/>)}</datalist></label>
        <label>刊刻机构<input list="catalog-imprint-options" name="imprint" defaultValue={imprint} placeholder="输入或选择机构"/><datalist id="catalog-imprint-options">{optionsFor(allRecords, "imprint").map((option) => <option value={option} key={option}/>)}</datalist></label>
        <div className="catalog-facet-actions"><button type="submit">应用筛选</button>{hasFilters && <a href="/catalog">清除筛选</a>}</div>
      </form>
      <p className="catalog-count">找到 <b>{total}</b> 条数字化资料{q ? `，关键词：“${q}”` : ""}</p>
      {records.length ? <><div className={`catalog-grid catalog-book-grid ${type === "manuscript" || manuscriptOnlyResults ? "catalog-manuscript-grid" : ""}`}>{records.map((record) => <article className="catalog-card" key={record.id}><a className={`catalog-image ${record.type === "manuscript" ? "catalog-manuscript-cover" : ""}`} href={`/catalog/${record.id}`}>{record.imageAccess === "public" ? <img src={record.image} alt={record.title}/> : <span>暂未上传数字化图片</span>}</a>{record.type === "manuscript" && manuscriptCaption(record) && <p className="catalog-manuscript-caption">{manuscriptCaption(record)}</p>}{record.type !== "manuscript" && artifactCaption(record) && <p className="catalog-artifact-caption">{artifactCaption(record)}</p>}<h2><a href={`/catalog/${record.id}`}>{record.title}</a></h2></article>)}</div>{totalPages > 1 && <nav className="catalog-pagination" aria-label="数字化遗产分页"><a href={makeLink({ nextPage: page - 1 })} aria-disabled={page === 1 ? "true" : undefined}>上一页</a>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <a href={makeLink({ nextPage: number })} aria-current={number === page ? "page" : undefined} key={number}>{number}</a>)}<a href={makeLink({ nextPage: page + 1 })} aria-disabled={page === totalPages ? "true" : undefined}>下一页</a></nav>}</> : <div className="catalog-empty"><h2>没有找到相符资料</h2><p>请调整书名、语言、作者、时间或刊刻机构筛选条件。</p><a href="/catalog">查看全部数字化资料</a></div>}
    </section>
  </main></>;
}
