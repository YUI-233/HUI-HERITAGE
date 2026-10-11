import "../admin/catalog/catalog-admin.css";
import "./personal-collection.css";
import "./artifact-visibility.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "../../lib/local-auth";
import { PersonalCollectionWorkspace } from "./personal-collection-workspace";
import { PublicHeader } from "../components/public-header";

export const dynamic = "force-dynamic";

export default async function PersonalCollectionPage({ searchParams }: { searchParams: Promise<{ section?: string; view?: string }> }) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  const params = await searchParams;
  const requestedSection = params.section;
  const initialSection = requestedSection === "books" || requestedSection === "artifacts" || requestedSection === "items" || requestedSection === "settings" ? requestedSection : "shelf";
  const initialManagementView = params.view === "create" && (initialSection === "books" || initialSection === "artifacts") ? "create" : "table";
  const studyName = viewer.displayName?.trim() || viewer.email.split("@")[0] || "我的书斋";
  return <main className="catalog-admin-page personal-collection-page">
    <PublicHeader active="personal"/>
    <section>
      <div className="study-heading"><p>PERSONAL LIBRARY</p><div><h1>{studyName}</h1><span>个人收藏馆</span></div></div>
      <PersonalCollectionWorkspace initialSection={initialSection} initialManagementView={initialManagementView} defaultProfileName={studyName} />
    </section>
  </main>;
}
