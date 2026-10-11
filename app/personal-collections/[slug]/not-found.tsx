import Link from "next/link";
import { Breadcrumbs, PublicHeader } from "../../components/public-header";
import "../public-collections.css";

export default function PublicCollectionNotFound() {
  return <>
    <PublicHeader active="personal" />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人收藏馆", href: "/personal-collections" }, { label: "未找到" }]} />
    <main className="public-collections-state-page public-collection-not-found">
      <section>
        <img src="/brand-mark.svg" alt="" />
        <p>COLLECTION NOT FOUND</p>
        <h1>这个收藏馆暂未开放</h1>
        <div>收藏馆可能已关闭，或其中暂时没有通过审核的公开内容。</div>
        <nav aria-label="继续浏览">
          <Link className="state-primary-link" href="/personal-collections">查看其他收藏馆</Link>
          <Link href="/">返回首页</Link>
        </nav>
      </section>
    </main>
  </>;
}

