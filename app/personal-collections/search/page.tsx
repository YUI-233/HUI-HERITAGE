import Link from "next/link";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";
import { searchPublicCollectionItems } from "../public-collections-data";
import "../public-collections.css";

export const dynamic = "force-dynamic";

function href({ q, type, page = 1 }: { q: string; type?: string; page?: number }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/personal-collections/search${query ? `?${query}` : ""}`;
}

export default async function PublicCollectionSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const type = params.type === "BOOK" || params.type === "ARTIFACT" ? params.type : undefined;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const result = await searchPublicCollectionItems({ q, type, page, limit: 24 });

  return <>
    <PublicHeader active="personal" />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人收藏馆", href: "/personal-collections" }, { label: "公开馆藏检索" }]} />
    <main className="public-collection-search-page">
      <section className="public-item-search-hero">
        <div><p>PUBLIC COLLECTION INDEX</p><h1>公开馆藏信息检索</h1><span>检索收藏者公开展示的书籍与文物基本信息。</span></div>
        <form action="/personal-collections/search" method="get"><input name="q" type="search" maxLength={100} defaultValue={q} placeholder="题名、作者、年代、分类、编号或收藏馆" aria-label="搜索公开馆藏"/>{type && <input type="hidden" name="type" value={type}/>}<button type="submit">检索</button></form>
      </section>
      <section className="public-item-search-results">
        <div className="public-item-search-toolbar"><nav aria-label="公开馆藏类型"><Link href={href({ q })} aria-current={!type ? "page" : undefined}>全部</Link><Link href={href({ q, type: "BOOK" })} aria-current={type === "BOOK" ? "page" : undefined}>书籍</Link><Link href={href({ q, type: "ARTIFACT" })} aria-current={type === "ARTIFACT" ? "page" : undefined}>文物</Link></nav><span>{q ? <>“{q}”找到 <b>{result.pagination.total}</b> 条</> : <>共 <b>{result.pagination.total}</b> 条公开记录</>}</span></div>
        {result.items.length ? <div className="public-search-item-grid">{result.items.map((item) => <article key={item.id}>
          <Link className="public-search-item-cover" href={`/personal-collection/public/${item.id}`}>{item.cover ? <img src={item.cover.url} alt=""/> : <div><img src="/brand-mark.svg" alt=""/><span>图像待补</span></div>}<small>{item.type === "BOOK" ? "书籍" : "文物"}</small></Link>
          <div className="public-search-item-copy"><p>{item.serialNumber}</p><h2><Link href={`/personal-collection/public/${item.id}`}>{item.title}</Link></h2><span>{[item.era, item.creator].filter(Boolean).join(" · ") || "作者与年代未详"}</span><small>{item.category || item.editionOrCategory || "未分类"}</small><footer><Link href={`/personal-collections/${item.collection.slug}`}>{item.collection.name}</Link><em>收藏者 · {item.collection.ownerName}</em></footer></div>
        </article>)}</div> : <div className="public-collections-empty"><img src="/brand-mark.svg" alt=""/><h2>没有找到相符的公开馆藏</h2><p>请缩短关键词、尝试作者或年代，或切换馆藏类型。</p><Link href="/personal-collections/search">查看全部公开馆藏</Link></div>}
        {result.pagination.totalPages > 1 && <nav className="public-collections-pagination" aria-label="公开馆藏检索分页">
          {result.pagination.page > 1 ? <Link href={href({ q, type, page: result.pagination.page - 1 })}>上一页</Link> : <span aria-disabled="true">上一页</span>}
          {Array.from({ length: result.pagination.totalPages }, (_, index) => index + 1).map((number) => <Link href={href({ q, type, page: number })} aria-current={number === result.pagination.page ? "page" : undefined} key={number}>{number}</Link>)}
          {result.pagination.page < result.pagination.totalPages ? <Link href={href({ q, type, page: result.pagination.page + 1 })}>下一页</Link> : <span aria-disabled="true">下一页</span>}
        </nav>}
      </section>
    </main>
  </>;
}
