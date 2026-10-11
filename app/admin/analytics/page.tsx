import "../catalog/catalog-admin.css";
import "./analytics.css";
import { AdminHeader } from "../admin-header";
import { requireSystemAdminPage } from "../require-system-admin-page";
import { AnalyticsDashboard } from "./analytics-dashboard";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  await requireSystemAdminPage();
  return <main className="catalog-admin-page analytics-page"><AdminHeader active="/admin/analytics"/><section><p className="analytics-eyebrow">ADMIN · VISIT ANALYTICS</p><h1>访问数据</h1><p className="analytics-intro">了解网站访问情况，查看注册用户与游客的阅读趋势及热门古籍、文章。</p><AnalyticsDashboard/></section></main>;
}
