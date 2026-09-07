import "../catalog/catalog-admin.css";
import "./holdings-import.css";
import "./holdings-revision.css";
import "./holdings-editor.css";
import "./holdings-workflow.css";
import { AdminHeader } from "../admin-header";
import { HoldingsEditor } from "./holdings-editor";
import { HoldingsImportPreviewer } from "./holdings-import-previewer";

export const dynamic = "force-dynamic";

export default function HoldingsAdminPage() {
  return (
    <main className="catalog-admin-page">
      <AdminHeader active="/admin/holdings" />
      <section className="holdings-admin-content">
        <p>HOLDINGS · RECORDS & CSV</p>
        <h1>馆藏信息录入</h1>
        <p className="catalog-admin-intro">国内与海外古籍馆藏均使用最新字段体系；批量提交后，由其他拥有审核权限的用户在审核台处理。个人馆藏信息请前往个人收藏馆录入，不能在本页提交。</p>
        <div className="holdings-entry-workspace">
          <HoldingsEditor />
          <HoldingsImportPreviewer />
        </div>
      </section>
    </main>
  );
}
