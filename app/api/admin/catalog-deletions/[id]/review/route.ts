import { requirePermission } from "../../../../../../lib/admin-access";
import { reviewCatalogDeletion } from "../../../../../../lib/catalog-deletion-workflow";
import { signedInCatalogWorkflowActor } from "../../../../../../lib/local-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  const body = await request.json().catch(() => null) as { decision?: unknown; comment?: unknown } | null;
  if (!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED" && body.decision !== "NEEDS_REVISION")) return Response.json({ message: "请选择审核结论。" }, { status: 400 });
  try {
    const actor = await signedInCatalogWorkflowActor(request, "CATALOG_REVIEW");
    if (!actor) return Response.json({ message: "请登录具有审核权限的账号后再处理。" }, { status: 403 });
    const { id } = await params;
    await reviewCatalogDeletion(id, body.decision, body.comment, actor.userId);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "审核删除申请失败。" }, { status: 400 }); }
}
