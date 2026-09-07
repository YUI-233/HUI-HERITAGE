import "./site-pages-admin.css";
import { AdminHeader } from "../admin-header";
import { SitePagesEditor } from "./site-pages-editor";
import { requireSystemAdminPage } from "../require-system-admin-page";
export const dynamic = "force-dynamic";
export default async function SitePagesAdminPage() { await requireSystemAdminPage(); return <main className="site-pages-admin"><AdminHeader active="/admin/site-pages"/><section><p>LOCAL SUPER ADMIN · SITE CONTENT</p><h1>页脚与功能页管理</h1><SitePagesEditor /></section></main>; }
