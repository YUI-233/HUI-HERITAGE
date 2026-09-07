import "../catalog/catalog-admin.css";
import "./research-review-alignment.css";
import { AdminHeader } from "../admin-header";
import { ResearchReviewDesk } from "./research-review-desk";
export const dynamic = "force-dynamic";
export default function ResearchReviewPage() { return <main className="catalog-admin-page"><AdminHeader active="/admin/research-review"/><section><p>RESEARCH · REVIEW</p><h1>研究资料审核</h1><p className="catalog-admin-intro">审核新增、修改及删除申请；通过后才会影响公开研究资料。</p><ResearchReviewDesk /></section></main>; }
