import { requirePermission } from "../../../../lib/admin-access";
import { listPendingCatalogDeletionRequests, submitCatalogDeletion } from "../../../../lib/catalog-deletion-workflow";
import { signedInCatalogWorkflowActor } from "../../../../lib/local-auth";

export async function GET(request: Request) {
  const denied = await requirePermission(request, "CATALOG_REVIEW"); if (denied) return denied;
  return Response.json(await listPendingCatalogDeletionRequests(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_WRITE"); if (denied) return denied;
  const body = await request.json().catch(() => null) as { id?: unknown; type?: unknown; reason?: unknown } | null;
  if (!body || typeof body.id !== "string" || (body.type !== "manuscript" && body.type !== "artifact")) return Response.json({ message: "请选择需要删除的古籍或文物资料。" }, { status: 400 });
  try {
    const actor = await signedInCatalogWorkflowActor(request, "CATALOG_WRITE");
    if (!actor) return Response.json({ message: "请登录具有录入权限的账号后再提交删除申请。" }, { status: 403 });
    return Response.json(await submitCatalogDeletion({ id: body.id, type: body.type, reason: body.reason }, actor.userId), { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "提交删除申请失败。" }, { status: 400 }); }
}
