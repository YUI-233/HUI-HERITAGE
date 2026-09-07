import "../../catalog/catalog.css";
import "../../catalog/catalog-extra.css";
import "../../catalog/detail-extra.css";
import "../../access.css";
import { headers } from "next/headers";
import { getCatalogRecord } from "../../../lib/catalog-repository";
import { getHoldingById, listHoldingsForCatalogRecord, type HoldingRecord } from "../../../lib/holdings-repository";
import { getSignedInUser, userPermissions } from "../../../lib/local-auth";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";

export const dynamic = "force-dynamic";

type HoldingDetailPageProps = { params: Promise<{ id: string }> };

const originLabels = {
  DOMESTIC: "国内馆藏",
  OVERSEAS: "海外馆藏",
  PERSONAL: "个人公开收藏",
} as const;

function text(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function authorWithDynasty(holding: HoldingRecord) {
  const author = holding.record.author?.trim();
  const dynasty = holding.record.era?.trim();
  return holding.record.type === "manuscript" && author && dynasty ? `[${dynasty}]${author}` : author ?? "未填写";
}

function holdingRows(holding: HoldingRecord) {
  return [
    ["书名", holding.record.title],
    ["作者/来源", authorWithDynasty(holding)],
    ["册数/数量", holding.record.volumeCount ? `${holding.record.volumeCount} 册` : null],
    ...(holding.record.type === "artifact" ? [["年代", holding.record.era]] : []),
    ["刊刻年份", holding.record.eraDetail],
    ["刊刻时间", holding.record.publicationDate],
    ["刊刻主体", holding.record.imprintPublisher],
    ["版本", holding.record.versionType],
    ["装帧", holding.record.binding],
    ["分类", holding.record.category],
    ["备注", holding.description],
  ].filter((row) => row[1] !== null && row[1] !== undefined && row[1] !== "");
}

function locationRows(holding: HoldingRecord) {
  return [
    ["馆藏类型", originLabels[holding.origin]],
    ["国家/地区", holding.region],
    ["图书馆", holding.institution],
    ["检索号", holding.callNumber],
  ].filter((row) => row[1] !== null && row[1] !== undefined && row[1] !== "");
}

async function LibraryHoldingDetail({ holding, canEdit }: { holding: HoldingRecord; canEdit: boolean }) {
  return (
    <main className="catalog-page holding-detail-page">
      <PublicHeader active="holdings"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "图书馆检索", href: "/holdings" }, { label: holding.record.title }]}/>
      <article className="holding-detail-shell library-record-detail">
        <header className="holding-detail-title holding-detail-titlebar">
          <div>
            <p>HUI HERITAGE · LIBRARY RECORD</p>
            <h1>{holding.record.title}</h1>
            <span>
              {originLabels[holding.origin]} · {holding.region} · {holding.institution}
            </span>
          </div>
          {canEdit ? <div className="holding-record-actions">
            <a className="holding-edit-entry holding-edit-entry-secondary" href={`/holdings/${holding.id}/edit`}>✎ 完善信息</a>
            <a className="holding-edit-entry holding-delete-entry" href={`/holdings/${holding.id}/delete`}>申请删除馆藏</a>
          </div> : null}
        </header>
        <div className="holding-detail-columns library-record-columns">
          <section className="holding-bibliography">
            <h2>书目信息</h2>
            <dl>
              {holdingRows(holding).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="holding-locations">
            <div className="holding-section-heading">
              <div>
                <p>COLLECTION LOCATION</p>
                <h2>馆藏位置</h2>
              </div>
            </div>
            <dl className="library-record-location">
              {locationRows(holding).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text(value)}</dd>
                </div>
              ))}
              {holding.catalogUrl ? (
                <div>
                  <dt>官方目录</dt>
                  <dd>
                    <a href={holding.catalogUrl} target="_blank" rel="noreferrer">
                      打开链接 ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      </article>
    </main>
  );
}

export default async function HoldingDetailPage({ params }: HoldingDetailPageProps) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  const canEditHoldings = userPermissions(viewer).includes("HOLDING_WRITE");
  const { id } = await params;
  const holding = await getHoldingById(id);
  if (holding) return <LibraryHoldingDetail holding={holding} canEdit={canEditHoldings} />;

  const record = await getCatalogRecord(id);

  if (!record) {
    return (
      <main className="catalog-page">
        <PublicHeader active="holdings"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "图书馆检索", href: "/holdings" }, { label: "资料详情" }]}/>
        <section className="catalog-empty">
          <h1>未找到这条图书馆资料</h1>
          <a href="/holdings">返回图书馆检索</a>
        </section>
      </main>
    );
  }

  const holdings = await listHoldingsForCatalogRecord(record.id);
  const hasImage = Boolean(record.images?.length || record.memberImages?.length);

  return (
    <main className="catalog-page holding-detail-page">
      <PublicHeader active="holdings"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "图书馆检索", href: "/holdings" }, { label: record.title }]}/>
      <article className="holding-detail-shell">
        <header className="holding-detail-title">
          <p>HUI HERITAGE · LIBRARY RECORD</p>
          <h1>{record.title}</h1>
          <span>{record.type === "manuscript" ? "古籍书目信息与图书馆馆藏分布" : "文物资料与图书馆馆藏分布"}</span>
        </header>
        <div className="holding-detail-columns">
          <section className="holding-bibliography">
            <h2>书目信息</h2>
            <dl>
              {record.metadata?.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              <div>
                <dt>资料说明</dt>
                <dd>{record.summary}</dd>
              </div>
              {record.keywords.length > 0 ? (
                <div>
                  <dt>主题词</dt>
                  <dd>{record.keywords.join("、")}</dd>
                </div>
              ) : null}
            </dl>
            {hasImage ? (
              <a className="holding-image-link" href={`/catalog/${record.id}`}>
                查看馆藏图像与完整资料 →
              </a>
            ) : null}
          </section>
          <section className="holding-locations">
            <div className="holding-section-heading">
              <div>
                <p>COLLECTION LOCATIONS</p>
                <h2>馆藏分布</h2>
              </div>
              <span>{holdings.length} 条记录</span>
            </div>
            {holdings.length ? (
              <div className="holding-location-list">
                {holdings.map((item) => (
                  <article key={item.id}>
                    <div>
                      <p>{item.region}</p>
                      <h3>{item.institution}</h3>
                    </div>
                    <dl>
                      {item.callNumber ? (
                        <div>
                          <dt>检索号</dt>
                          <dd>{item.callNumber}</dd>
                        </div>
                      ) : null}
                      {item.description ? (
                        <div>
                          <dt>备注</dt>
                          <dd>{item.description}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {item.catalogUrl ? (
                      <a href={item.catalogUrl} target="_blank" rel="noreferrer">
                        打开馆方目录 →
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="holding-empty">暂未录入公开馆藏机构信息。</p>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
