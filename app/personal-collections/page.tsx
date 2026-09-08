import Link from "next/link";
import { PublicHeader, Breadcrumbs } from "../components/public-header";
import { getPublicCollections } from "./public-collections-data";
import "./public-collections.css";

export const dynamic = "force-dynamic";

type PublicCollectionsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

function paginationHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/personal-collections?${query}` : "/personal-collections";
}

export default async function PublicCollectionsPage({ searchParams }: PublicCollectionsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
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
            <input id="collection-search" name="q" type="search" defaultValue={q} placeholder="输入收藏馆或收藏者名称" />
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
            {items.map((collection, index) => <article className="public-collection-card" key={collection.slug}>
              <Link className="public-collection-cover" href={`/personal-collections/${collection.slug}`} aria-label={`进入${collection.name}`}>
                {collection.cover ? <img src={collection.cover.url} alt="" style={{ objectPosition: index % 2 ? "68% center" : "32% center" }} /> : <div className="public-collection-cover-empty"><img src="/brand-mark.svg" alt="" /><span>馆藏封面待补</span></div>}
                <span className="public-collection-number">{String(index + 1 + (pagination.page - 1) * pagination.limit).padStart(2, "0")}</span>
              </Link>
              <div className="public-collection-card-copy">
                <p>收藏者 · {collection.ownerName}</p>
                <h3><Link href={`/personal-collections/${collection.slug}`}>{collection.name}</Link></h3>
                <div className="public-collection-description">{collection.description}</div>
                <dl>
                  <div><dt>书籍</dt><dd>{collection.bookCount}</dd></div>
                  <div><dt>藏品</dt><dd>{collection.artifactCount}</dd></div>
                  <div><dt>公开合计</dt><dd>{collection.totalCount}</dd></div>
                </dl>
                <Link className="public-collection-enter" href={`/personal-collections/${collection.slug}`}>进入收藏馆 <span aria-hidden="true">→</span></Link>
              </div>
            </article>)}
          </div>

          {pagination.totalPages > 1 && <nav className="public-collections-pagination" aria-label="公开收藏馆分页">
            <Link href={paginationHref(q, pagination.page - 1)} aria-disabled={pagination.page === 1 ? "true" : undefined}>上一页</Link>
            {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((page) => <Link href={paginationHref(q, page)} aria-current={page === pagination.page ? "page" : undefined} key={page}>{page}</Link>)}
            <Link href={paginationHref(q, pagination.page + 1)} aria-disabled={pagination.page === pagination.totalPages ? "true" : undefined}>下一页</Link>
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

