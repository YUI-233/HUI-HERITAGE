import "../catalog/catalog-admin.css";
import "./review.css";
import { AdminHeader } from "../admin-header";
import { HoldingRevisionReview, ImportBatchReview } from "./review-client";

export const dynamic = "force-dynamic";

export default function ImportReviewPage() {
  return (
    <main className="catalog-admin-page review-admin-page">
      <AdminHeader active="/admin/review" />
      <section>
        <p>IMPORT · PEER REVIEW</p>
        <h1>馆藏数据审核</h1>
        <p className="catalog-admin-intro">拥有馆藏审核权限的用户可审核其他账号提交的批量资料、馆藏记录修订与删除申请；审核通过后才会更新或删除正式馆藏记录。</p>
        <HoldingRevisionReview />
        <ImportBatchReview />
      </section>
    </main>
  );
}
