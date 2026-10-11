import { headers } from "next/headers";
import { NotificationBell } from "../components/notification-bell";
import { getSignedInUser, userPermissions, type UserPermission } from "../../lib/local-auth";
import { countPendingImportBatchesForReviewer } from "../../lib/import-review-workflow";
import { countPendingCatalogReviewsForReviewer } from "../../lib/admin-catalog";
import { countPendingResearchReviewsForReviewer } from "../../lib/admin-research";
import { countPendingHoldingRevisionsForReviewer } from "../../lib/holding-revision-workflow";
import { countPendingPersonalReviewItems } from "../../lib/personal-collection";

const entries: Array<{ href: string; label: string; permission?: UserPermission; systemAdmin?: boolean }> = [
  { href: "/admin/hero", label: "首页展示管理", systemAdmin: true },
  { href: "/admin/catalog", label: "古籍文物录入", permission: "CATALOG_WRITE" },
  { href: "/admin/catalog-review", label: "古籍与文物审核", permission: "CATALOG_REVIEW" },
  { href: "/admin/personal-review", label: "个人馆藏审核", permission: "CATALOG_REVIEW" },
  { href: "/admin/holdings", label: "馆藏信息录入", permission: "HOLDING_WRITE" },
  { href: "/admin/review", label: "馆藏数据审核", permission: "HOLDING_REVIEW" },
  { href: "/admin/research", label: "研究资料编辑", permission: "RESEARCH_WRITE" },
  { href: "/admin/research-review", label: "研究资料审核", permission: "RESEARCH_REVIEW" },
  { href: "/admin/categories", label: "分类管理", systemAdmin: true },
  { href: "/admin/analytics", label: "访问数据", systemAdmin: true },
  { href: "/admin/users", label: "账号与权限", systemAdmin: true },
];

export async function AdminHeader({ active }: { active: string }) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  const permissions = userPermissions(viewer);
  const isSystemAdmin = viewer?.role === "SUPER_ADMIN";
  const visibleEntries = entries.filter((entry) => entry.systemAdmin ? isSystemAdmin : entry.permission && permissions.includes(entry.permission));
  const canReviewHoldings = permissions.includes("HOLDING_REVIEW");
  const canReviewCatalog = permissions.includes("CATALOG_REVIEW");
  const canReviewResearch = permissions.includes("RESEARCH_REVIEW");
  const pendingHoldingReviews = viewer && canReviewHoldings
    ? (await Promise.all([countPendingImportBatchesForReviewer(viewer.id), countPendingHoldingRevisionsForReviewer(viewer.id)])).reduce((total, count) => total + count, 0)
    : 0;
  const pendingCatalogReviews = viewer && canReviewCatalog ? await countPendingCatalogReviewsForReviewer(viewer.id) : 0;
  const pendingPersonalReviews = viewer && canReviewCatalog ? await countPendingPersonalReviewItems(viewer.id) : 0;
  const pendingResearchReviews = viewer && canReviewResearch ? await countPendingResearchReviewsForReviewer(viewer.id) : 0;
  return <header>
    <a href="/"><img src="/brand-logo.png" alt="HUI HERITAGE"/><strong>HUI HERITAGE</strong></a>
    <nav aria-label="后台功能入口">
      {visibleEntries.map((entry) => <a href={entry.href} aria-current={entry.href === active || (entry.href === "/admin/hero" && active.startsWith("/admin/hero/")) ? "page" : undefined} key={entry.href}>
        {entry.label}{entry.href === "/admin/catalog-review" && pendingCatalogReviews > 0 && <b className="nav-notification-count" aria-label={`${pendingCatalogReviews} 个待审核事项`}>{pendingCatalogReviews}</b>}{entry.href === "/admin/personal-review" && pendingPersonalReviews > 0 && <b className="nav-notification-count" aria-label={`${pendingPersonalReviews} 个待审核事项`}>{pendingPersonalReviews}</b>}{entry.href === "/admin/review" && pendingHoldingReviews > 0 && <b className="nav-notification-count" aria-label={`${pendingHoldingReviews} 个待审核批次`}>{pendingHoldingReviews}</b>}
        {entry.href === "/admin/research-review" && pendingResearchReviews > 0 && <b className="nav-notification-count" aria-label={`${pendingResearchReviews} 个待审核事项`}>{pendingResearchReviews}</b>}
      </a>)}
    </nav>
    <div className="header-account-actions"><NotificationBell/><a href="/account">账号中心</a></div>
  </header>;
}
