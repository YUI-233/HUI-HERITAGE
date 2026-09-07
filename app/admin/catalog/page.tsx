import "./catalog-admin.css";
import { headers } from "next/headers";
import { AdminHeader } from "../admin-header";
import { CatalogEditor } from "./catalog-editor";
import { getSignedInUser, userPermissions } from "../../../lib/local-auth";

export const dynamic = "force-dynamic";

export default async function CatalogAdminPage() {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  const canManageCatalog = userPermissions(viewer).includes("CATALOG_WRITE");
  return <main className="catalog-admin-page"><AdminHeader active="/admin/catalog"/><section><p>CATALOGUE · RECORDING</p><h1>古籍文物录入</h1>{!viewer ? <div className="catalog-access-card"><h2>先登录，再管理已有资料</h2><p>登录具有“录入古籍／文物”权限的账号后，即可搜索《宝命真经赞》、补充信息并上传封面图片。</p><a href="/login">前往登录</a></div> : !canManageCatalog ? <div className="catalog-access-card"><h2>当前账号没有馆藏录入权限</h2><p>请使用系统 Admin 账号，或请 Admin 为当前账号分配“录入古籍／文物”权限后再进入此页面。</p><a href="/account">查看账户</a></div> : <><CatalogEditor /><p className="catalog-admin-intro">古籍与文物图片会在前台公开展示，便于读者浏览；pdf 保持会员在线阅读。选择已有资料后，可在右侧分别上传或管理图片与 pdf。</p></>}</section></main>;
}
