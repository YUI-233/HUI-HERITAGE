import Link from "next/link";
import { PublicHeader, Breadcrumbs } from "../components/public-header";
import { getPublicCollections } from "./public-collections-data";
import "./public-collections.css";

export const dynamic = "force-dynamic";

type PublicCollectionsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

function pageHref({ q, page }: { q: string; page?: number }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/personal-collections?${query}` : "/personal-collections";
}

export default async function PublicCollectionsPage({ searchParams }: PublicCollectionsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10) || 1;
  const { items, pagination } = await getPublicCollections({ q, page: requestedPage, limit: 12 });

  return <>
    <PublicHeader active="personal" />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人收藏馆" }]} />
    <main className="public-collections-page">
      <section className="public-collections-intro">
        <div>
          <p>HUI HERITAGE · PERSONAL COLLECTIONS</p>
          <h1>个人收藏馆</h1>
          <span>走进收藏者的书斋，浏览经审核开放的书籍与藏品。</span>
        </div>
        <form action="/personal-collections" method="get" className="public-collections-search">
          <label htmlFor="collection-search">查找收藏馆</label>
          <div>
            <input id="collection-search" name="q" type="search" maxLength={100} defaultValue={q} placeholder="输入收藏馆或收藏者名称" />
            <button type="submit">搜索</button>
          </div>
        </form>
      </section>

      <section className="public-collections-results" aria-labelledby="collection-result-heading">
        <div className="public-collections-result-heading">
          <div>
            <p>OPEN COLLECTIONS</p>
            <h2 id="collection-result-heading">公开收藏馆</h2>
          </div>
          <span>{q ? <>“{q}”找到 <b>{pagination.total}</b> 座收藏馆</> : <>现有 <b>{pagination.total}</b> 座收藏馆开放浏览</>}</span>
        </div>

        {items.length ? <>
          <div className="public-collections-grid">
            {items.map((collection, index) => <Link className="public-collection-card" href={`/personal-collections/${collection.slug}`} aria-label={`进入${collection.name}`} key={collection.slug}>
              <div className="public-collection-cover">
                {collection.cover ? <img src={collection.cover.url} alt="" style={{ objectPosition: index % 2 ? "68% center" : "32% center" }} /> : <div className="public-collection-cover-empty"><img src="/brand-mark.svg" alt="" /><span>馆藏封面待补</span></div>}
              </div>
              <div className="public-collection-card-copy">
                <div className="public-collection-card-top"><span>PERSONAL COLLECTION</span><b>{String(index + 1 + (pagination.page - 1) * pagination.limit).padStart(2, "0")}</b></div>
                <div className="public-collection-card-title"><h3>{collection.name}</h3><p>收藏者 · {collection.ownerName}</p></div>
                <div className="public-collection-description">{collection.description}</div>
                <div className="public-collection-card-footer"><span className="public-collection-stats">书籍 <strong>{collection.bookCount}</strong><i>·</i> 文物 <strong>{collection.artifactCount}</strong><i>·</i> 共 <strong>{collection.totalCount}</strong> 件</span><span className="public-collection-enter">进入收藏馆 <i aria-hidden="true">→</i></span></div>
              </div>
            </Link>)}
          </div>

          {pagination.totalPages > 1 && <nav className="public-collections-pagination" aria-label="公开收藏馆分页">
            <Link href={pageHref({ q, page: pagination.page - 1 })} aria-disabled={pagination.page === 1 ? "true" : undefined}>上一页</Link>
            {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((page) => <Link href={pageHref({ q, page })} aria-current={page === pagination.page ? "page" : undefined} key={page}>{page}</Link>)}
            <Link href={pageHref({ q, page: pagination.page + 1 })} aria-disabled={pagination.page === pagination.totalPages ? "true" : undefined}>下一页</Link>
          </nav>}
        </> : <div className="public-collections-empty">
          <img src="/brand-mark.svg" alt="" />
          <h2>{q ? "没有找到相符的收藏馆" : "暂时还没有公开收藏馆"}</h2>
          <p>{q ? "请尝试其他收藏馆名称或收藏者名称。" : "收藏内容通过审核并开放后，会在这里展示。"}</p>
          {q && <Link href="/personal-collections">查看全部收藏馆</Link>}
        </div>}
      </section>

    </main>
  </>;
}
