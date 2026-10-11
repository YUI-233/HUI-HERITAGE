import "../admin/catalog/catalog-admin.css";
import "./account.css";
import "./account-name-editor.css";
import "../borrowing-card.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser, userPermissions } from "../../lib/local-auth";
import { AccountActions, AccountNameEditor } from "./account-actions";
import { PublicHeader } from "../components/public-header";
import { countPendingImportBatchesForReviewer } from "../../lib/import-review-workflow";
import { countPendingCatalogReviewsForReviewer } from "../../lib/admin-catalog";
import { countPendingResearchReviewsForReviewer } from "../../lib/admin-research";
import { countPendingHoldingRevisionsForReviewer } from "../../lib/holding-revision-workflow";
import { countPendingPersonalReviewItems } from "../../lib/personal-collection";
import { prisma } from "../../lib/prisma";
import { getBorrowingSummary } from "../../lib/borrowing";
import { usesCloudRuntime } from "../../lib/cloud-runtime";
import { BorrowingCardPanel } from "./borrowing-card-panel";

export const dynamic = "force-dynamic";

type Entry = { href: string; title: string; badge?: string };

export default async function AccountPage() {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  const permissions = userPermissions(viewer);
  const isAdmin = viewer.role === "SUPER_ADMIN";
  const emailVerified = "emailVerifiedAt" in viewer ? Boolean(viewer.emailVerifiedAt) : true;
  const pendingHoldingReviews = permissions.includes("HOLDING_REVIEW")
    ? (await Promise.all([countPendingImportBatchesForReviewer(viewer.id), countPendingHoldingRevisionsForReviewer(viewer.id)])).reduce((total, count) => total + count, 0)
    : 0;
  const pendingCatalogReviews = permissions.includes("CATALOG_REVIEW") ? await countPendingCatalogReviewsForReviewer(viewer.id) : 0;
  const pendingPersonalReviews = permissions.includes("CATALOG_REVIEW") ? await countPendingPersonalReviewItems(viewer.id) : 0;
  const pendingResearchReviews = permissions.includes("RESEARCH_REVIEW") ? await countPendingResearchReviewsForReviewer(viewer.id) : 0;
  const groupName = isAdmin ? "系统 Admin" : viewer.group?.name ?? "注册用户";
  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const displayNameChangeThisYear = await prisma.auditEvent.findFirst({ where: { entityType: "USER_PROFILE", entityId: viewer.id, action: "DISPLAY_NAME_CHANGED", createdAt: { gte: startOfYear } }, select: { id: true } });
  const canChangeDisplayName = !displayNameChangeThisYear;
  const reviewEntries = [
    permissions.includes("CATALOG_REVIEW") && { href: "/admin/catalog-review", title: "古籍与文物审核", badge: pendingCatalogReviews ? `${pendingCatalogReviews} 个待审核` : undefined },
    permissions.includes("CATALOG_REVIEW") && { href: "/admin/personal-review", title: "个人馆藏审核", badge: pendingPersonalReviews ? `${pendingPersonalReviews} 个待审核` : undefined },
    permissions.includes("HOLDING_REVIEW") && { href: "/admin/review", title: "馆藏数据审核", badge: pendingHoldingReviews ? `${pendingHoldingReviews} 个待审核` : undefined },
    permissions.includes("RESEARCH_REVIEW") && { href: "/admin/research-review", title: "研究资料审核", badge: pendingResearchReviews ? `${pendingResearchReviews} 个待审核` : undefined },
    isAdmin && { href: "/admin/categories", title: "分类管理" },
  ].filter(Boolean) as Entry[];
  const editEntries = (isAdmin
    ? [{ href: "/admin/hero", title: "首页展示管理" }, { href: "/admin/catalog", title: "古籍文物录入" }, { href: "/admin/holdings", title: "馆藏信息录入" }, { href: "/admin/research", title: "研究资料编辑" }, { href: "/admin/analytics", title: "访问数据" }, { href: "/admin/users", title: "账号授权" }]
    : [permissions.includes("CATALOG_WRITE") && { href: "/admin/catalog", title: "古籍文物录入" }, permissions.includes("HOLDING_WRITE") && { href: "/admin/holdings", title: "馆藏信息录入" }, permissions.includes("RESEARCH_WRITE") && { href: "/admin/research", title: "研究资料编辑" }].filter(Boolean)) as Entry[];
  const hasManagementModules = editEntries.length > 0 || reviewEntries.length > 0;
  const borrowing = usesCloudRuntime() ? null : await getBorrowingSummary(viewer.id);

  return <main className="catalog-admin-page account-page">
    <PublicHeader />
    <section>
      <p>ACCOUNT CENTER</p><h1>账号中心</h1>
      <article className="account-profile-panel"><div><p>ACCOUNT</p><AccountNameEditor displayName={viewer.displayName || ""} canChange={canChangeDisplayName} /></div><dl><div className="account-wide"><dt>邮箱</dt><dd>{viewer.email}</dd></div><div><dt>验证状态</dt><dd>{emailVerified ? <><span className="account-status-check" aria-hidden="true" />已验证</> : "待验证"}</dd></div><div><dt>账户状态</dt><dd>{viewer.isActive ? <><span className="account-status-check" aria-hidden="true" />正常</> : "已停用"}</dd></div><div><dt>用户组</dt><dd>{groupName}</dd></div>{borrowing && <BorrowingCardPanel exempt={borrowing.exempt} card={borrowing.card ? { cardNumber: borrowing.card.cardNumber, issuedAt: borrowing.card.issuedAt.toISOString() } : null} holderName={borrowing.holderName} limited={borrowing.limited} limit={borrowing.limit} borrowedToday={borrowing.borrowedToday} remaining={borrowing.remaining} records={borrowing.records.map((record) => ({ id: record.id, bookId: record.bookId, title: record.title }))}/>}</dl><AccountActions /></article>
      <div className={`account-modules ${hasManagementModules ? "" : "personal-only"}`}>
        {hasManagementModules ? <article className="account-card account-personal-module"><p>PERSONAL LIBRARY</p><h2>个人收藏馆</h2><span>个人书籍、文物与电子书架均在此管理。</span><div className="account-personal-actions"><a className="button-link" href="/personal-collection">进入个人收藏馆</a><a className="button-link account-secondary-link" href="/messages">查看站内信</a></div></article> : <article className="account-personal-full"><div><p>PERSONAL LIBRARY</p><h2>个人收藏馆</h2></div><span>个人书籍、文物与电子书架均在此管理。</span><div className="account-personal-actions"><a className="button-link" href="/personal-collection">进入个人收藏馆</a><a className="button-link account-secondary-link" href="/messages">查看站内信</a></div></article>}
        {editEntries.length > 0 && <article className="account-card account-permission-module"><p>EDIT PERMISSIONS</p><h2>编辑权限</h2>{editEntries.map((entry) => <a className="account-entry" href={entry.href} key={entry.title}><b>{entry.title}</b></a>)}</article>}
        {reviewEntries.length > 0 && <article className="account-card account-permission-module"><p>REVIEW PERMISSIONS</p><h2>审核权限</h2>{reviewEntries.map((entry) => <a className="account-entry" href={entry.href} key={entry.title}><b>{entry.title}{entry.badge && <em>{entry.badge}</em>}</b></a>)}</article>}
      </div>
    </section>
  </main>;
}
