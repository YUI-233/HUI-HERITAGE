import "../catalog.css";
import "../catalog-extra.css";
import "../catalog-description.css";
import "../detail-extra.css";
import "../catalog-detail-refinement.css";
import "../../borrowing-card.css";
import "../provenance.css";
import "../../access.css";
import { getCatalogRecord, listCatalogRecords } from "../../../lib/catalog-repository";
import { listHoldingsForCatalogRecord } from "../../../lib/holdings-repository";
import { ImageGallery } from "./image-gallery";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";
import { BorrowingReadButton } from "./borrowing-read-button";

export const dynamic = "force-dynamic";
type DetailPageProps = { params: Promise<{ id: string }> };

export default async function DetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const record = await getCatalogRecord(id);
  if (!record) return <main className="catalog-page"><PublicHeader active="catalog"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "数字化遗产", href: "/catalog" }, { label: "资料详情" }]}/><section className="catalog-empty"><h1>未找到这条资料</h1><a href="/catalog">返回数字化遗产</a></section></main>;

  const [siblings, holdings] = await Promise.all([listCatalogRecords({ type: record.type }), listHoldingsForCatalogRecord(record.id)]);
  const recordIndex = siblings.findIndex((item) => item.id === record.id);
  const previousRecord = recordIndex > 0 ? siblings[recordIndex - 1] : null;
  const nextRecord = recordIndex >= 0 && recordIndex < siblings.length - 1 ? siblings[recordIndex + 1] : null;
  const related = siblings.filter((item) => item.id !== record.id).slice(0, 3);
  const images = record.images?.length ? record.images : record.imageAccess === "public" ? [record.image] : [];
  const memberDocuments = record.memberDocuments ?? [];
  const readerHref = memberDocuments[0] ? `/catalog/${record.id}/reader?volume=${encodeURIComponent(memberDocuments[0].id)}` : null;
  const metadata = record.catalogNumber ? [{ label: "馆藏系统编号", value: record.catalogNumber }, ...(record.metadata ?? [])] : record.metadata ?? [];
  const leadingMetadataLabels = ["馆藏系统编号", "分类", "语言"];
  const bibliography = [
    ...leadingMetadataLabels.flatMap((label) => metadata.filter((item) => item.label === label)),
    ...metadata.filter((item) => !leadingMetadataLabels.includes(item.label)),
    { label: "收藏来源", value: record.source },
  ];
  return <main className="catalog-page">
    <PublicHeader active="catalog"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "数字化遗产", href: "/catalog" }, { label: record.title }]}/>
    <header className="detail-intro"><div><p className="detail-type">{record.type === "manuscript" ? "古籍 · 馆藏目录" : "文物图像 · 公开资料"}</p><h1>{record.title}</h1></div><div className="detail-actions">{readerHref && (record.type === "manuscript" ? <BorrowingReadButton bookId={record.id} title={record.title} readerHref={readerHref} volumes={memberDocuments}/> : <a className="detail-action" href={readerHref}>阅读</a>)}<a className="detail-citation" href={`/api/catalog/${record.id}/citation`}>下载引用信息</a></div></header>
    <article className="detail-layout">
      <div className="detail-image-column"><div className={`detail-image ${record.type === "manuscript" ? "detail-manuscript-cover" : ""}`}><ImageGallery images={images} title={record.title}/></div>{(previousRecord || nextRecord) && <nav className="detail-image-navigator" aria-label="同类资料导航">{previousRecord && <a href={`/catalog/${previousRecord.id}`}><span>← 上一条</span><b>{previousRecord.title}</b></a>}{nextRecord && <a className="detail-next-record" href={`/catalog/${nextRecord.id}`}><span>下一条 →</span><b>{nextRecord.title}</b></a>}</nav>}</div>
      <div className="detail-copy"><section className="detail-bibliographic"><h2>书目信息</h2><dl>{bibliography.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}<div className="detail-topic-row"><dt>主题词</dt><dd className="detail-keywords">{record.keywords.map((keyword) => <a href={`/catalog?q=${encodeURIComponent(keyword)}`} key={keyword}>{keyword}</a>)}</dd></div></dl></section><section className="detail-description"><h2>内容简介</h2><p className="detail-summary">{record.summary}</p></section></div>
    </article>
    {holdings.length > 0 && <section className="detail-holdings"><div><p>COLLECTION PROVENANCE</p><h2>相关馆藏记录</h2><a href={`/holdings?q=${encodeURIComponent(record.title)}`}>查看全部馆藏来源 →</a></div><div className="detail-holdings-list">{holdings.map((holding) => <article key={holding.id}><b>{holding.institution}</b><span>{holding.region}</span>{holding.callNumber && <span>索书号／版本：{holding.callNumber}</span>}{holding.description && <p>{holding.description}</p>}{holding.catalogUrl && <a href={holding.catalogUrl} rel="noreferrer">馆方目录 →</a>}</article>)}</div></section>}
    {related.length > 0 && <section className="detail-related"><div><p>CONTINUE BROWSING</p><h2>继续浏览</h2></div><div className="related-grid">{related.map((item) => <a className="related-card" href={`/catalog/${item.id}`} key={item.id}><div>{item.imageAccess === "public" ? <img src={item.image} alt={item.title}/> : <span>暂未上传图片</span>}</div><p>{item.type === "manuscript" ? "古籍" : "文物图像"} · {item.date}</p><h3>{item.title}</h3></a>)}</div></section>}
  </main>;
}
