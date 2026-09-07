import "../../personal-collection.css";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { PublicDetailGallery } from "../public-detail-gallery";
import { Breadcrumbs, PublicHeader } from "../../../components/public-header";

export const dynamic = "force-dynamic";

const formatAuthorWithEra = (creator?: string | null, era?: string | null) => {
  const name = creator?.trim() || "佚名";
  const period = era?.trim();
  return period ? `[${period}] ${name}` : name;
};

export default async function PublicPersonalItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.personalCollectionItem.findFirst({
    where: { id, status: "APPROVED", isPublic: true },
    include: { owner: { select: { displayName: true, email: true } }, media: { where: { visibility: "PUBLIC" }, orderBy: { createdAt: "asc" } } },
  });
  if (!item) notFound();
  const fields = [
    ["编号", item.serialNumber],
    ["分类", item.type === "BOOK" ? item.categories.join("／") : item.editionOrCategory],
    ["作者／来源", item.type === "BOOK" ? formatAuthorWithEra(item.creator, item.era) : item.creator],
    [item.type === "BOOK" ? "册数" : "数量", `${item.volumeCount} ${item.type === "BOOK" ? "册" : "件"}`],
    ...(item.type === "BOOK" ? [] : [["年代", item.era]]),
    ["刊刻年份", item.eraDetail || "未填写"],
    ["刊刻时间", item.publicationDate || "未填写"],
    ["刊刻主体", item.imprintPublisher || "未填写"],
    ["版本", item.editionOrCategory],
    ["装帧", item.binding],
    ["备注", item.description],
  ].filter(([, value]) => Boolean(value));
  const collector = item.owner.displayName?.trim() || item.owner.email;
  const typeLabel = item.type === "BOOK" ? "书籍" : "藏品";

  return <main className="public-personal-item">
    <PublicHeader active="personal"/><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人收藏馆", href: "/holdings?origin=PERSONAL" }, { label: item.title }]}/>
    <article className="public-personal-detail">
      <PublicDetailGallery itemId={item.id} title={item.title} media={item.media} />
      <div className="public-personal-detail-copy">
        <p>个人收藏 · {typeLabel}详情</p>
        <h1>{item.title}</h1>
        <div className="public-collector">个人收藏 · 收藏者：{collector}</div>
        <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </div>
    </article>
  </main>;
}
