import "../catalog/catalog-admin.css";
import "./review-desk.css";
import { AdminHeader } from "../admin-header";
import { CatalogReviewDesk } from "./review-desk";
import { CatalogDeletionReview } from "./catalog-deletion-review";

export const dynamic = "force-dynamic";

export default function CatalogReviewPage() {
  return <main className="catalog-admin-page"><AdminHeader active="/admin/catalog-review"/><section><p>CATALOGUE · PEER REVIEW</p><h1>古籍与文物审核</h1><p className="catalog-admin-intro">拥有审核权限的用户可审核其他用户提交的资料与删除申请；系统会拒绝审核本人提交的记录。</p><CatalogReviewDesk /><CatalogDeletionReview /></section></main>;
}
