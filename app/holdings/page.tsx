import "../catalog/catalog.css";
import "../catalog/catalog-extra.css";
import "../access.css";
import "../search-hero.css";
import { PublicHeader } from "../components/public-header";
import { HoldingFilterAutoClose } from "./holding-filter-autoclose";
import { isHoldingOrigin, listHoldings, type HoldingRecord } from "../../lib/holdings-repository";
import { getSearchHeroContent } from "../../lib/search-hero-content";
import type { CSSProperties } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type BrowseView = "books" | "institutions";
type DisplayMode = "grouped" | "table";
type SortKey = "title" | "institution" | "region" | "year" | "callNumber";
type SortDirection = "asc" | "desc";
type ColumnFilterKey = "title" | "author" | "publicationDate" | "version" | "imprintPublisher" | "institution" | "region" | "callNumber";

type HoldingsPageProps = {
  searchParams: Promise<{
    q?: string;
    origin?: string;
    view?: string;
    mode?: string;
    sort?: string;
    dir?: string;
    page?: string;
    pageSize?: string;
    title?: string;
    author?: string;
    publicationDate?: string;
    institution?: string;
    region?: string;
    version?: string;
    imprintPublisher?: string;
    callNumber?: string;
  }>;
};

const originLabels = {
  DOMESTIC: "国内馆藏",
  OVERSEAS: "海外馆藏",
  PERSONAL: "个人公开收藏",
} as const;

type HoldingGroup = { title: string; subtitle: string; items: HoldingRecord[] };

function recordTypeLabel(record: HoldingRecord["record"]) {
  return record.type === "artifact" || record.type === "personal-artifact" ? "文物资料" : "古籍资料";
}

function text(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function tableText(value?: string | number | null) {
  if (value === null || value === undefined || value === "" || value === "未填写" || value === "/") return "—";
  return String(value);
}

function sortText(value?: string | number | null) {
  return String(value ?? "");
}

function uniqueText(values: Array<string | number | null | undefined>) {
  return [...new Set(values.map((value) => text(value)).filter((value) => value && value !== "未填写"))].sort((left, right) =>
    left.localeCompare(right, "zh-CN", { numeric: true }),
  );
}

function includesText(value: string | number | null | undefined, filter?: string) {
  if (!filter) return true;
  return String(value ?? "")
    .toLocaleLowerCase()
    .includes(filter.toLocaleLowerCase());
}

function groupByBook(holdings: HoldingRecord[]) {
  const groups = new Map<string, HoldingGroup>();
  for (const holding of holdings) {
    const key = holding.record.title
      .trim()
      .toLocaleLowerCase()
      .replace(/[《》〈〉「」『』“”"'，、；：·\s]/g, "");
    const current = groups.get(key) ?? {
      title: holding.record.title,
      subtitle: recordTypeLabel(holding.record),
      items: [],
    };
    current.items.push(holding);
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

function groupByInstitution(holdings: HoldingRecord[]) {
  const groups = new Map<string, HoldingGroup>();
  for (const holding of holdings) {
    const key = `${holding.origin}:${holding.region}:${holding.institution}`;
    const current = groups.get(key) ?? {
      title: holding.institution,
      subtitle: `${originLabels[holding.origin]} · ${holding.region}`,
      items: [],
    };
    current.items.push(holding);
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

function sortHoldings(holdings: HoldingRecord[], sort: SortKey, direction: SortDirection) {
  const sorted = [...holdings];
  sorted.sort((left, right) => {
    const leftValue =
      sort === "institution"
        ? left.institution
        : sort === "region"
          ? left.region
          : sort === "year"
            ? left.record.publicationDate || left.record.eraDetail || left.record.era
            : sort === "callNumber"
              ? left.callNumber
              : left.record.title;
    const rightValue =
      sort === "institution"
        ? right.institution
        : sort === "region"
          ? right.region
          : sort === "year"
            ? right.record.publicationDate || right.record.eraDetail || right.record.era
            : sort === "callNumber"
              ? right.callNumber
              : right.record.title;
    const result = sortText(leftValue).localeCompare(sortText(rightValue), "zh-CN", { numeric: true });
    return direction === "desc" ? -result : result;
  });
  return sorted;
}

function paginationItems(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const validPages = [...pages].filter((page) => page >= 1 && page <= total).sort((left, right) => left - right);
  const items: Array<number | string> = [];
  validPages.forEach((page, index) => {
    const previous = validPages[index - 1];
    if (previous && page - previous > 1) items.push(`ellipsis-${previous}`);
    items.push(page);
  });
  return items;
}

function recordDetailHref(holding: HoldingRecord) {
  return holding.origin === "PERSONAL" ? `/personal-collection/public/${holding.record.id}` : `/holdings/${holding.id}`;
}

function personalStudyName(holding: HoldingRecord) {
  return holding.institution.replace(/^个人收藏\s*·\s*/, "").trim() || holding.institution;
}

function holdingPrimaryLabel(holding: HoldingRecord, view: BrowseView) {
  if (view === "institutions") return holding.record.title;
  return holding.origin === "PERSONAL" ? personalStudyName(holding) : holding.institution;
}

function holdingSourceLabel(holding: HoldingRecord) {
  if (holding.origin === "PERSONAL") return "个人收藏";
  return `${originLabels[holding.origin]} · ${holding.region}`;
}

function holdingAuthorLabel(holding: HoldingRecord) {
  const author = text(holding.record.author);
  const authorEra = holding.record.era?.trim();
  if ((holding.origin === "PERSONAL" || holding.record.type === "manuscript") && authorEra && authorEra !== "—" && author !== "未填写") {
    return holding.origin === "PERSONAL" ? `[${authorEra}] ${author}` : `[${authorEra}]${author}`;
  }
  return author;
}

function holdingPublicationYear(holding: HoldingRecord) {
  return holding.record.eraDetail || (holding.origin === "PERSONAL" || holding.record.type === "artifact" ? holding.record.era : null);
}

function OpenBookIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M4.2 5.8c2.75-.72 5.35-.17 7.8 1.68v12.14c-2.45-1.82-5.05-2.38-7.8-1.68V5.8Z" />
      <path d="M19.8 5.8c-2.75-.72-5.35-.17-7.8 1.68v12.14c2.45-1.82 5.05-2.38 7.8-1.68V5.8Z" />
      <path d="M12 7.48v12.14" />
      <path d="M6.5 9.2c1.38-.16 2.56.08 3.55.72" />
      <path d="M17.5 9.2c-1.38-.16-2.56.08-3.55.72" />
    </svg>
  );
}

function InstitutionIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M3.8 20h16.4" />
      <path d="M5.2 8.7h13.6" />
      <path d="M6.4 8.7v9.2" />
      <path d="M10.1 8.7v9.2" />
      <path d="M13.9 8.7v9.2" />
      <path d="M17.6 8.7v9.2" />
      <path d="M4.5 17.9h15" />
      <path d="M12 3.8 4.4 7.6h15.2L12 3.8Z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M4.5 5.5h15v13h-15z" />
      <path d="M4.5 10h15" />
      <path d="M4.5 14.3h15" />
      <path d="M9.5 5.5v13" />
      <path d="M14.5 5.5v13" />
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M4.2 5.5h15.6" />
      <path d="M5.4 7.8 10.4 13v5.4l3.2-1.8V13l5-5.2" />
    </svg>
  );
}

export default async function HoldingsPage({ searchParams }: HoldingsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim();
  const origin = isHoldingOrigin(params.origin) ? params.origin : undefined;
  const view: BrowseView = params.view === "institutions" ? "institutions" : "books";
  const mode: DisplayMode = params.mode === "table" ? "table" : "grouped";
  const sort: SortKey = ["institution", "region", "year", "callNumber"].includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "title";
  const sortDirection: SortDirection = params.dir === "desc" ? "desc" : "asc";
  const requestedPageSize = Number(params.pageSize);
  const pageSize = [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25;
  const requestedPage = Math.max(1, Number(params.page) || 1);

  const columnFilters: Record<ColumnFilterKey, string | undefined> = {
    title: params.title?.trim() || undefined,
    author: params.author?.trim() || undefined,
    publicationDate: params.publicationDate?.trim() || undefined,
    institution: params.institution?.trim() || undefined,
    region: params.region?.trim() || undefined,
    version: params.version?.trim() || undefined,
    imprintPublisher: params.imprintPublisher?.trim() || undefined,
    callNumber: params.callNumber?.trim() || undefined,
  };

  const [rawHoldings, heroContent] = await Promise.all([listHoldings({ query, origin }), getSearchHeroContent()]);
  const holdings = rawHoldings.filter((holding) => {
    const version = holding.record.versionType || holding.record.binding || holding.record.category;
    return (
      includesText(holding.record.title, columnFilters.title) &&
      includesText(holding.record.author, columnFilters.author) &&
      includesText(holding.record.publicationDate, columnFilters.publicationDate) &&
      includesText(holding.institution, columnFilters.institution) &&
      includesText(holding.region, columnFilters.region) &&
      includesText(version, columnFilters.version) &&
      includesText(holding.record.imprintPublisher, columnFilters.imprintPublisher) &&
      includesText(holding.callNumber, columnFilters.callNumber)
    );
  });

  const grouped = view === "books" ? groupByBook(holdings) : groupByInstitution(holdings);
  const sortedTableRows = sortHoldings(holdings, sort, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sortedTableRows.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const tableRows = sortedTableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const tableOptions = {
    authors: uniqueText(rawHoldings.map((holding) => holding.record.author)),
    institutions: uniqueText(rawHoldings.map((holding) => holding.institution)),
    regions: uniqueText(rawHoldings.map((holding) => holding.region)),
    versions: uniqueText(rawHoldings.map((holding) => holding.record.versionType || holding.record.binding || holding.record.category)),
  };

  const makeLink = (next: {
    q?: string;
    origin?: string;
    view?: BrowseView;
    mode?: DisplayMode;
    sort?: SortKey;
    direction?: SortDirection;
    page?: number;
    pageSize?: number;
    clearColumnFilters?: boolean;
  }) => {
    const sp = new URLSearchParams();
    const nextQ = next.q ?? query;
    const nextOrigin = Object.prototype.hasOwnProperty.call(next, "origin") ? next.origin : origin;
    const nextView = next.view ?? view;
    const nextMode = next.mode ?? mode;
    const nextSort = next.sort ?? sort;
    const nextDirection = next.direction ?? sortDirection;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextPage = next.page ?? 1;
    if (nextQ) sp.set("q", nextQ);
    if (nextOrigin) sp.set("origin", nextOrigin);
    if (nextMode !== "table" && nextView !== "books") sp.set("view", nextView);
    if (nextMode !== "grouped") sp.set("mode", nextMode);
    if (nextMode === "table" && nextSort !== "title") sp.set("sort", nextSort);
    if (nextMode === "table" && nextDirection === "desc") sp.set("dir", nextDirection);
    if (nextMode === "table" && nextPageSize !== 25) sp.set("pageSize", String(nextPageSize));
    if (nextMode === "table" && nextPage > 1) sp.set("page", String(nextPage));
    if (!next.clearColumnFilters) {
      for (const [key, value] of Object.entries(columnFilters)) {
        if (value) sp.set(key, value);
      }
    }
    const qs = sp.toString();
    return `/holdings${qs ? `?${qs}` : ""}`;
  };

  const filterLabelMap: Record<ColumnFilterKey, string> = {
    title: "书名",
    author: "作者",
    publicationDate: "刊刻时间",
    institution: "图书馆",
    region: "国家/地区",
    version: "版本",
    imprintPublisher: "刊刻主体",
    callNumber: "检索号",
  };

  const tableFilterHref = (removeKey?: ColumnFilterKey) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (origin) sp.set("origin", origin);
    sp.set("mode", "table");
    if (sort !== "title") sp.set("sort", sort);
    if (sortDirection === "desc") sp.set("dir", sortDirection);
    if (pageSize !== 25) sp.set("pageSize", String(pageSize));
    for (const [key, value] of Object.entries(columnFilters)) {
      if (key !== removeKey && value) sp.set(key, value);
    }
    const qs = sp.toString();
    return `/holdings${qs ? `?${qs}` : ""}`;
  };
  const tableClearFilterHref = makeLink({ mode: "table", clearColumnFilters: true });
  const tableSortHref = (key: SortKey) => makeLink({
    mode: "table",
    sort: key,
    direction: sort === key && sortDirection === "asc" ? "desc" : "asc",
  });
  const sortIndicator = (key: SortKey) => sort === key ? <span className="holding-sort-indicator" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span> : null;

  const activeColumnFilters = (Object.entries(columnFilters) as Array<[ColumnFilterKey, string | undefined]>).filter(([, value]) => value);
  const tablePaginationItems = paginationItems(currentPage, totalPages);
  const firstVisibleRow = sortedTableRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * pageSize, sortedTableRows.length);

  const textFilter = (name: ColumnFilterKey, placeholder: string) => (
    <details className={`holding-column-filter ${columnFilters[name] ? "active" : ""}`}>
      <summary aria-label={`筛选${placeholder}`}>
        <span className="holding-filter-icon" aria-hidden="true"><FunnelIcon /></span>
      </summary>
      <div className="holding-column-filter-panel">
        <input form="holding-table-filter-form" name={name} defaultValue={columnFilters[name]} placeholder={`输入${placeholder}关键词…`} />
        <small>按 Enter 键确定</small>
        <div>
          <a href={tableFilterHref(name)}>清除</a>
          <button form="holding-table-filter-form" type="submit">确定</button>
        </div>
      </div>
    </details>
  );

  const selectFilter = (name: ColumnFilterKey, label: string, options: string[]) => (
    <details className={`holding-column-filter ${columnFilters[name] ? "active" : ""}`}>
      <summary aria-label={`筛选${label}`}>
        <span className="holding-filter-icon" aria-hidden="true"><FunnelIcon /></span>
      </summary>
      <div className="holding-column-filter-panel">
        <select form="holding-table-filter-form" name={name} defaultValue={columnFilters[name] ?? ""}>
          <option value="">全部{label}</option>
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div>
          <a href={tableFilterHref(name)}>清除</a>
          <button form="holding-table-filter-form" type="submit">确定</button>
        </div>
      </div>
    </details>
  );

  const resultUnit = view === "books" ? "种资料" : "家收藏机构";

  return (
    <>
      <PublicHeader active="holdings"/>

      <main className="catalog-page library-search-content">
        <section className={`catalog-hero library-search-hero ${heroContent.images.holdings ? "search-hero-with-image" : ""}`} style={heroContent.images.holdings ? { "--search-hero-image": `url("${heroContent.images.holdings}")`, "--search-hero-focus": heroContent.focus.holdings } as CSSProperties : undefined}>
          <p className="eyebrow">HUI HERITAGE · LIBRARY SEARCH</p>
          <h1>图书馆检索</h1>
          <form className="catalog-search" action="/holdings">
            <input name="q" defaultValue={query} placeholder="搜索书名、作者、图书馆、国家、检索号或备注" />
            {origin ? <input type="hidden" name="origin" value={origin} /> : null}
            {mode !== "table" && view !== "books" ? <input type="hidden" name="view" value={view} /> : null}
            {mode !== "grouped" ? <input type="hidden" name="mode" value={mode} /> : null}
            {mode === "table" && sort !== "title" ? <input type="hidden" name="sort" value={sort} /> : null}
            <button type="submit">检索</button>
          </form>
        </section>

        <section className="catalog-results">
          <nav className="catalog-filters" aria-label="数据范围">
            <a className={!origin ? "active" : undefined} aria-current={!origin ? "page" : undefined} href={makeLink({ origin: undefined })}>
              全部记录
            </a>
            <a
              className={origin === "DOMESTIC" ? "active" : undefined}
              aria-current={origin === "DOMESTIC" ? "page" : undefined}
              href={makeLink({ origin: "DOMESTIC" })}
            >
              国内馆藏
            </a>
            <a
              className={origin === "OVERSEAS" ? "active" : undefined}
              aria-current={origin === "OVERSEAS" ? "page" : undefined}
              href={makeLink({ origin: "OVERSEAS" })}
            >
              海外馆藏
            </a>
            <a
              className={origin === "PERSONAL" ? "active" : undefined}
              aria-current={origin === "PERSONAL" ? "page" : undefined}
              href={makeLink({ origin: "PERSONAL" })}
            >
              个人公开收藏
            </a>
          </nav>

          <div className="library-search-controls">
            <nav className="library-search-browse" aria-label="浏览方式">
              <a aria-current={mode === "grouped" && view === "books" ? "page" : undefined} href={makeLink({ view: "books", mode: "grouped" })}>
                <span className="library-search-nav-icon" aria-hidden="true"><OpenBookIcon /></span>
                按书名
              </a>
              <a
                aria-current={mode === "grouped" && view === "institutions" ? "page" : undefined}
                href={makeLink({ view: "institutions", mode: "grouped" })}
              >
                <span className="library-search-nav-icon" aria-hidden="true"><InstitutionIcon /></span>
                按馆藏机构
              </a>
              <a aria-current={mode === "table" ? "page" : undefined} href={makeLink({ view: "books", mode: "table" })}>
                <span className="library-search-nav-icon" aria-hidden="true"><TableIcon /></span>
                表格视图
              </a>
            </nav>
          </div>

          {mode !== "table" ? <p className="result-count">
            <strong>{holdings.length}</strong> 条记录，<strong>{grouped.length}</strong> {resultUnit}
          </p> : null}

          {holdings.length === 0 ? (
            <div className="empty-state">
              <h2>没有找到相符的图书馆资料</h2>
              <p>可以尝试书名、作者、图书馆、国家或检索号。</p>
              <Link href="/holdings">查看全部图书馆资料</Link>
            </div>
          ) : mode === "table" ? (
            <section className="holding-table-shell">
              <HoldingFilterAutoClose />
              <form id="holding-table-filter-form" className="holding-table-filter-form" action="/holdings">
                {query ? <input type="hidden" name="q" value={query} /> : null}
                {origin ? <input type="hidden" name="origin" value={origin} /> : null}
                <input type="hidden" name="mode" value="table" />
                {sort !== "title" ? <input type="hidden" name="sort" value={sort} /> : null}
                {sortDirection === "desc" ? <input type="hidden" name="dir" value="desc" /> : null}
                {pageSize !== 25 ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
              </form>
              <header className="holding-table-toolbar">
                <div><strong>{holdings.length}</strong> 条记录 <span>当前显示 {firstVisibleRow}–{lastVisibleRow}</span></div>
                <nav aria-label="每页记录数"><span>每页</span>{[25, 50, 100].map((size) => <a href={makeLink({ mode: "table", pageSize: size })} aria-current={pageSize === size ? "page" : undefined} key={size}>{size}</a>)}</nav>
              </header>
              {activeColumnFilters.length ? (
                <div className="holding-active-filters" aria-label="已选筛选条件">
                  <span>已选条件：</span>
                  {activeColumnFilters.map(([key, value]) => (
                    <a className="holding-filter-chip" href={tableFilterHref(key)} key={key}>
                      {filterLabelMap[key]}：{value} ×
                    </a>
                  ))}
                  <a className="holding-filter-clear-all" href={tableClearFilterHref}>清除全部</a>
                </div>
              ) : null}
              <div className="holding-table-view">
              <table className="holding-data-table">
                <thead>
                  <tr>
                    <th>
                      <span className="holding-table-head-cell">
                        <a href={tableSortHref("title")}>书名与作者 {sortIndicator("title")}</a>
                        <span className="holding-table-subfilters">{textFilter("title", "书名")}{selectFilter("author", "作者", tableOptions.authors)}</span>
                      </span>
                    </th>
                    <th>
                      <span className="holding-table-head-cell">
                        <a href={tableSortHref("year")}>年代 {sortIndicator("year")}</a>
                        {textFilter("publicationDate", "刊刻时间")}
                      </span>
                    </th>
                    <th>
                      <span className="holding-table-head-cell">
                        <span>版本／册数</span>
                        {selectFilter("version", "版本", tableOptions.versions)}
                      </span>
                    </th>
                    <th>
                      <span className="holding-table-head-cell">
                        <span>刊刻主体</span>
                        {textFilter("imprintPublisher", "刊刻主体")}
                      </span>
                    </th>
                    <th>
                      <span className="holding-table-head-cell">
                        <a href={tableSortHref("institution")}>馆藏机构 {sortIndicator("institution")}</a>
                        <span className="holding-table-subfilters">{selectFilter("institution", "图书馆", tableOptions.institutions)}{selectFilter("region", "国家", tableOptions.regions)}</span>
                      </span>
                    </th>
                    <th>
                      <span className="holding-table-head-cell">
                        <a href={tableSortHref("callNumber")}>检索号 {sortIndicator("callNumber")}</a>
                        {textFilter("callNumber", "检索号")}
                      </span>
                    </th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((holding) => (
                    <tr key={holding.id}>
                      <td data-label="书名与作者">
                        <a className="holding-table-title" href={recordDetailHref(holding)}>{holding.record.title}</a>
                        <small>{holdingAuthorLabel(holding)}</small>
                      </td>
                      <td data-label="年代"><b>{tableText(holdingPublicationYear(holding))}</b><small>{tableText(holding.record.publicationDate)}</small></td>
                      <td data-label="版本／册数"><b>{tableText(holding.record.versionType || holding.record.binding || holding.record.category)}</b><small>{holding.record.volumeCount ? `${holding.record.volumeCount} 册` : "册数未录入"}</small></td>
                      <td data-label="刊刻主体">{tableText(holding.record.imprintPublisher)}</td>
                      <td data-label="馆藏机构"><b>{holding.institution}</b><small><span className="holding-region-tag">{holding.region}</span>{originLabels[holding.origin]}</small></td>
                      <td data-label="检索号"><code>{tableText(holding.callNumber)}</code></td>
                      <td data-label="操作">
                        <div className="holding-table-actions">
                          <a href={recordDetailHref(holding)}>详情</a>
                          {holding.catalogUrl ? <a href={holding.catalogUrl} target="_blank" rel="noreferrer">馆方目录 ↗</a> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {totalPages > 1 ? <nav className="holding-table-pagination" aria-label="表格分页">
                <a href={makeLink({ mode: "table", page: Math.max(1, currentPage - 1), pageSize })} aria-disabled={currentPage === 1}>上一页</a>
                {tablePaginationItems.map((item) => typeof item === "number" ? <a href={makeLink({ mode: "table", page: item, pageSize })} aria-current={item === currentPage ? "page" : undefined} key={item}>{item}</a> : <span key={item}>…</span>)}
                <a href={makeLink({ mode: "table", page: Math.min(totalPages, currentPage + 1), pageSize })} aria-disabled={currentPage === totalPages}>下一页</a>
              </nav> : null}
            </section>
          ) : (
            <div className="holding-accordion-list">
              {grouped.map((group) => (
                <section className="holding-accordion-group holding-group-static" key={`${group.subtitle}:${group.title}`}>
                  <header className="holding-group-static-header">
                    <div className="holding-group-static-title">
                      <h2>{group.title}</h2>
                    </div>
                    <span className="holding-group-count">共 {group.items.length} 条馆藏记录</span>
                  </header>
                  <div className="holding-compact-rows">
                    {group.items.map((holding) => (
                      <article key={holding.id}>
                        <div className="holding-row-main">
                          <b>{holdingPrimaryLabel(holding, view)}</b>
                          <span>{holdingSourceLabel(holding)}</span>
                        </div>
                        <div className="holding-row-meta">
                          <span>作者：{holdingAuthorLabel(holding)}</span>
                          <span>刊刻年份：{text(holdingPublicationYear(holding))}</span>
                          <span>刊刻主体：{text(holding.record.imprintPublisher)}</span>
                        </div>
                        <div className="holding-row-actions">
                          <a href={recordDetailHref(holding)}>{holding.origin === "PERSONAL" ? "书名详情" : "书目详情"}</a>
                          {holding.catalogUrl ? (
                            <a href={holding.catalogUrl} target="_blank" rel="noreferrer">
                              官方目录 ↗
                            </a>
                          ) : <span aria-hidden="true" className="holding-row-action-placeholder" />}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
