import "../catalog/catalog-admin.css";
import { AdminHeader } from "../admin-header";
import { UserManager } from "./user-manager";
import { requireSystemAdminPage } from "../require-system-admin-page";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  await requireSystemAdminPage();
  return <main className="catalog-admin-page"><AdminHeader active="/admin/users"/><section><p>SUPER ADMIN · ACCOUNTS</p><h1>账号、用户组与权限</h1><p className="catalog-admin-intro">唯一的系统 Admin 可创建用户组、勾选权限，并把管理员或志愿者账号分配到相应用户组。审核权限按用户组授予；所有具备相应审核权限的用户均可审核他人提交的资料。</p><UserManager /></section></main>;
}
