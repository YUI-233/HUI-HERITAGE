import { requirePermission } from "../../../../lib/admin-access";
import { signedInCatalogWorkflowActor } from "../../../../lib/local-auth";
import { listPersonalReviewQueue, reviewPersonalItem } from "../../../../lib/personal-collection";

export async function GET(request: Request) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  try {
    const reviewer = await signedInCatalogWorkflowActor(request, "CATALOG_REVIEW");
    if (!reviewer) throw new Error("请使用拥有审核权限的账号登录。");
    return Response.json(await listPersonalReviewQueue(reviewer.userId));
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法读取待审核公开申请。" }, { status: 400 }); }
}

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  try {
    const reviewer = await signedInCatalogWorkflowActor(request, "CATALOG_REVIEW");
    const body = await request.json().catch(() => null) as { id?: unknown; decision?: unknown; comment?: unknown } | null;
    if (!reviewer || !body || typeof body.id !== "string" || (body.decision !== "APPROVED" && body.decision !== "NEEDS_REVISION" && body.decision !== "REJECTED")) throw new Error("请提供公开申请编号和审核结论。");
    return Response.json(await reviewPersonalItem(reviewer.userId, body.id, body.decision, typeof body.comment === "string" ? body.comment : undefined));
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "审核失败。" }, { status: 400 }); }
}
