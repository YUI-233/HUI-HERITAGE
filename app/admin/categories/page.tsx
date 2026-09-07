import "../catalog/catalog-admin.css";
import { AdminHeader } from "../admin-header";
import { requireSystemAdminPage } from "../require-permission-page";
import { CategoryManager } from "./category-manager";
import { listCategoryRequests, listManagedCategories } from "../../../lib/category-requests";

export default async function CategoriesPage() {
  await requireSystemAdminPage();
  const [requests, categories] = await Promise.all([listCategoryRequests(), listManagedCategories(undefined, true)]);
  return <main className="catalog-admin-page"><AdminHeader active="/admin/categories"/><section><p>CATEGORY · MANAGEMENT</p><h1>分类管理</h1><p className="catalog-admin-intro">在此审核古籍、文物和研究资料的新增分类申请。通过后的分类会进入相应录入页面。</p><CategoryManager initialRequests={JSON.parse(JSON.stringify(requests))} initialCategories={JSON.parse(JSON.stringify(categories))} /></section></main>;
}
