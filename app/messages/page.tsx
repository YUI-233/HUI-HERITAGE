import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "../../lib/local-auth";
import { Breadcrumbs, PublicHeader } from "../components/public-header";
import { getPublicCollection } from "../personal-collections/public-collections-data";
import { MessageCenter } from "./message-center";
import "./messages.css";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const { collection: collectionSlug } = await searchParams;
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) {
    const next = collectionSlug ? `/messages?collection=${encodeURIComponent(collectionSlug)}` : "/messages";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const collection = collectionSlug ? await getPublicCollection(collectionSlug) : null;
  const recipient = collection ? { collectionSlug: collection.collection.slug, collectionName: collection.collection.name, displayName: collection.collection.ownerName } : null;

  return <>
    <PublicHeader active="personal"/>
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "账号中心", href: "/account" }, { label: "站内信" }]}/>
    <main className="messages-page"><section className="messages-title"><p>COLLECTOR CORRESPONDENCE</p><h1>藏友站内信</h1><span>围绕公开书籍与文物进行友好交流。请勿发送敏感个人信息或商业广告。</span></section><MessageCenter initialRecipient={recipient}/></main>
  </>;
}
