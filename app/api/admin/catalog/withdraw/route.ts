import { requirePermission } from "../../../../../lib/admin-access";
import { withdrawAdminCatalogSubmission } from "../../../../../lib/admin-catalog";
import { signedInCatalogWorkflowActor } from "../../../../../lib/local-auth";

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_WRITE"); if (denied) return denied;
  const body = await request.json().catch(() => null) as { id?: unknown; type?: unknown } | null;
  if (!body || typeof body.id !== "string" || (body.type !== "manuscript" && body.type !== "artifact")) return Response.json({ message: "请提供资料编号和类型。" }, { status: 400 });
  try {
    const actor = await signedInCatalogWorkflowActor(request, "CATALOG_WRITE");
    if (!actor) return Response.json({ message: "请使用拥有录入权限的登录账号撤回资料。" }, { status: 403 });
    return Response.json(await withdrawAdminCatalogSubmission({ id: body.id, type: body.type }, actor));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "撤回审核失败。" }, { status: 400 });
  }
}
