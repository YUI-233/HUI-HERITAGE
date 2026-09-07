import "../catalog/catalog-admin.css";
import "./personal-review.css";
import { AdminHeader } from "../admin-header";
import { PersonalReviewDesk } from "./personal-review-desk";

export const dynamic = "force-dynamic";

export default function PersonalReviewPage() {
  return (
    <main className="catalog-admin-page personal-review-page">
      <AdminHeader active="/admin/personal-review" />
      <section>
        <p>PERSONAL COLLECTION · PUBLICATION REVIEW</p>
        <h1>个人馆藏审核</h1>
        <p className="catalog-admin-intro">
          审核权限沿用“古籍／文物审核”。所有具备该权限的用户均可核验其他用户的公开申请；系统不允许审核本人记录。请先查看完整资料与图片，再作出结论。
        </p>
        <PersonalReviewDesk />
      </section>
    </main>
  );
}
