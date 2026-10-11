import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";
import { getPublicCollection } from "../public-collections-data";
import { BookListExportButton } from "./book-list-export-button";
import "../public-collections.css";

export const dynamic = "force-dynamic";

type PublicCollectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
};

function collectionHref(slug: string, { type, q, page = 1 }: { type?: string; q?: string; page?: number }) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/personal-collections/${slug}${query ? `?${query}` : ""}`;
}

export default async function PublicCollectionPage({ params, searchParams }: PublicCollectionPageProps) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const type = queryParams.type === "BOOK" || queryParams.type === "ARTIFACT" ? queryParams.type : undefined;
  const q = queryParams.q?.trim() ?? "";
  const requestedPage = Number.parseInt(queryParams.page ?? "1", 10) || 1;
  const result = await getPublicCollection(slug, { type, q, page: requestedPage, limit: 24 });
  if (!result) notFound();
  const { collection, items, pagination } = result;

  return <>
    <PublicHeader active="personal" />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人收藏馆", href: "/personal-collections" }, { label: collection.name }]} />
    <main className="public-collection-page">
      <section className="public-collection-profile">
        <div className="public-collection-profile-cover">
          {collection.cover ? <img src={collection.cover.url} alt="" /> : <div><img src="/brand-mark.svg" alt="" /></div>}
        </div>
        <div className="public-collection-profile-copy">
          <p>PRIVATE STEWARDSHIP · PUBLIC ACCESS</p>
          <h1>{collection.name}</h1>
          <div className="public-collection-owner">收藏者 · {collection.publicCollectorName || collection.ownerName}</div>
          <div className="public-collection-profile-description">{collection.description}</div>
          {(collection.themes?.length || collection.primaryEras?.length || collection.primaryRegion || collection.collectingSinceYear) && <div className="public-collection-profile-facts">
            {collection.themes?.length ? <div><span>收藏主题</span><p>{collection.themes.join(" · ")}</p></div> : null}
            {collection.primaryEras?.length ? <div><span>主要年代</span><p>{collection.primaryEras.join(" · ")}</p></div> : null}
            {collection.primaryRegion ? <div><span>主要地域</span><p>{collection.primaryRegion}</p></div> : null}
            {collection.collectingSinceYear ? <div><span>开始收藏</span><p>{collection.collectingSinceYear} 年</p></div> : null}
          </div>}
          {collection.originStory && <details className="public-collection-origin"><summary>收藏缘起</summary><p>{collection.originStory}</p></details>}
          {collection.collaborationInterests?.length ? <div className="public-collection-collaboration"><span>研究与合作意向</span><div>{collection.collaborationInterests.map((item) => <small key={item}>{item}</small>)}</div></div> : null}
          <dl>
            <div><dt>公开书籍</dt><dd>{collection.bookCount}</dd></div>
            <div><dt>公开藏品</dt><dd>{collection.artifactCount}</dd></div>
            <div><dt>馆藏合计</dt><dd>{collection.totalCount}</dd></div>
          </dl>
          <div className={`public-collection-profile-actions${collection.acceptsMessages === false ? " two-actions" : ""}`}>
            {collection.acceptsMessages !== false && <Link href={`/messages?collection=${encodeURIComponent(collection.slug)}`}>联系收藏者</Link>}
            <BookListExportButton slug={collection.slug} collectionName={collection.name} bookCount={collection.bookCount} />
            <Link href="/personal-collections/search">搜索全部公开馆藏</Link>
          </div>
        </div>
      </section>

      <section className="public-collection-browse" aria-labelledby="public-collection-items-title">
        <div className="public-collection-toolbar">
          <div>
            <p>COLLECTION INDEX</p>
            <h2 id="public-collection-items-title">公开馆藏</h2>
          </div>
          <form action={`/personal-collections/${slug}`} method="get">
            {type && <input type="hidden" name="type" value={type} />}
            <input name="q" type="search" defaultValue={q} placeholder="搜索题名、作者、年代或编号" aria-label="搜索馆内公开收藏" />
            <button type="submit">馆内搜索</button>
          </form>
        </div>

        <div className="public-collection-filter-row">
          <nav aria-label="公开收藏类型">
            <Link href={collectionHref(slug, { q })} aria-current={!type ? "page" : undefined}>全部 <span>{collection.totalCount}</span></Link>
            <Link href={collectionHref(slug, { type: "BOOK", q })} aria-current={type === "BOOK" ? "page" : undefined}>书籍 <span>{collection.bookCount}</span></Link>
            <Link href={collectionHref(slug, { type: "ARTIFACT", q })} aria-current={type === "ARTIFACT" ? "page" : undefined}>藏品 <span>{collection.artifactCount}</span></Link>
          </nav>
          <span>{q ? <>“{q}”找到 <b>{pagination.total}</b> 件</> : <>当前显示 <b>{pagination.total}</b> 件</>}</span>
        </div>

        {items.length ? <>
          <div className="public-collection-items-grid">
            {items.map((item) => <article className="public-collection-item-card" key={item.id}>
              <Link className="public-collection-item-cover" href={`/personal-collection/public/${item.id}`}>
                {item.cover ? <img src={item.cover.url} alt="" /> : <div><img src="/brand-mark.svg" alt="" /><span>图像待补</span></div>}
                <small>{item.type === "BOOK" ? "书籍" : "藏品"}</small>
              </Link>
              <div>
                <p>{item.serialNumber}</p>
                <h3><Link href={`/personal-collection/public/${item.id}`}>{item.title}</Link></h3>
                <span>{[item.era, item.creator].filter(Boolean).join(" · ") || "作者与年代未详"}</span>
                <small>{item.category || item.editionOrCategory || "未分类"}</small>
              </div>
            </article>)}
          </div>

          {pagination.totalPages > 1 && <nav className="public-collections-pagination" aria-label="馆内公开收藏分页">
            <Link href={collectionHref(slug, { type, q, page: pagination.page - 1 })} aria-disabled={pagination.page === 1 ? "true" : undefined}>上一页</Link>
            {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((page) => <Link href={collectionHref(slug, { type, q, page })} aria-current={page === pagination.page ? "page" : undefined} key={page}>{page}</Link>)}
            <Link href={collectionHref(slug, { type, q, page: pagination.page + 1 })} aria-disabled={pagination.page === pagination.totalPages ? "true" : undefined}>下一页</Link>
          </nav>}
        </> : <div className="public-collections-empty public-collection-items-empty">
          <img src="/brand-mark.svg" alt="" />
          <h2>{q ? "没有找到相符的馆藏" : type === "ARTIFACT" ? "暂时没有公开藏品" : "暂时没有公开内容"}</h2>
          <p>{q ? "请调整关键词或切换收藏类型。" : "通过审核并开放的内容会显示在这里。"}</p>
          {(q || type) && <Link href={`/personal-collections/${slug}`}>查看全部公开馆藏</Link>}
        </div>}
      </section>
    </main>
  </>;
}
