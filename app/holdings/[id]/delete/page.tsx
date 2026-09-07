import "../../../catalog/catalog.css";
import "../../../catalog/catalog-extra.css";
import "../../../catalog/detail-extra.css";
import "../../../access.css";
import { headers } from "next/headers";
import { getHoldingById } from "../../../../lib/holdings-repository";
import { getSignedInUser, userPermissions } from "../../../../lib/local-auth";
import { HoldingDeletionForm } from "./delete-client";

export const dynamic = "force-dynamic";

export default async function HoldingDeletionPage({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  const canEdit = userPermissions(viewer).includes("HOLDING_WRITE");
  const holding = await getHoldingById((await params).id);

  return (
    <main className="catalog-page holding-detail-page">
      <header className="catalog-header">
        <a href="/" className="catalog-brand">
          <img src="/brand-logo.png" alt="HUI HERITAGE" />
          <span>
            <strong>HUI HERITAGE</strong>
            <small>汉文回教古籍文物遗产</small>
          </span>
        </a>
        <a href="/holdings">返回图书馆检索</a>
      </header>
      <article className="holding-detail-shell library-record-detail">
        <header className="holding-detail-title">
          <p>HUI HERITAGE · LIBRARY RECORD DELETION</p>
          <h1>{holding?.record.title ?? "申请删除馆藏"}</h1>
          <span>提交删除理由后进入二次审核，审核通过才会删除公开馆藏记录。</span>
        </header>
        {!holding ? <p className="holding-empty">没有找到这条图书馆资料。</p> : !canEdit ? <p className="holding-empty">当前账号没有提交馆藏删除申请的权限。</p> : <HoldingDeletionForm holdingId={holding.id} />}
      </article>
    </main>
  );
}
