import "../admin/catalog/catalog-admin.css";
import "../account/account.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "../../lib/local-auth";
import { PersonalSubmissionList } from "./submission-list";
import { PublicHeader } from "../components/public-header";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  return <main className="catalog-admin-page account-page"><PublicHeader active="personal"/><section><p>PERSONAL COLLECTION · PUBLICATION</p><h1>个人馆藏审核</h1><p className="catalog-admin-intro">这里保留审核记录作为辅助查看；日常审核反馈请使用页面右上角的系统通知。审核通过后，记录与已公开图片会自动公开。</p><PersonalSubmissionList/></section></main>;
}
