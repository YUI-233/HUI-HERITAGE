import { requirePermission } from "../../../../lib/admin-access";
import { reviewAdminCatalog } from "../../../../lib/admin-catalog";
import { signedInCatalogWorkflowActor } from "../../../../lib/local-auth";

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  const body = await request.json().catch(() => null) as { id?: unknown; type?: unknown; decision?: unknown; comment?: unknown; confirmedViewed?: unknown } | null;
  if (!body || typeof body.id !== "string" || (body.type !== "manuscript" && body.type !== "artifact") || (body.decision !== "APPROVED" && body.decision !== "REJECTED" && body.decision !== "NEEDS_REVISION")) return Response.json({ error: "INVALID_REVIEW", message: "请提供资料类型、编号与审核结论。" }, { status: 400 });
  try {
    if (body.decision === "APPROVED" && body.confirmedViewed !== true) return Response.json({ error: "REVIEW_NOT_VIEWED", message: "请先查看提交资料与全部附件后，再通过并公开。" }, { status: 400 });
    const reviewer = await signedInCatalogWorkflowActor(request, "CATALOG_REVIEW");
    if (!reviewer) return Response.json({ error: "SIGNED_IN_REVIEW_REQUIRED", message: "审核必须使用拥有审核权限的登录账号。" }, { status: 403 });
    return Response.json(await reviewAdminCatalog({ id: body.id, type: body.type, decision: body.decision, comment: typeof body.comment === "string" ? body.comment : undefined }, reviewer));
  } catch (error) { return Response.json({ error: "CATALOG_REVIEW_FAILED", message: error instanceof Error ? error.message : "审核失败。" }, { status: 400 }); }
}
