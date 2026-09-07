import { hasLocalAdminAccess, localAdminIsConfigured } from "../../../../../lib/admin-local";
import { signedInWorkflowActor } from "../../../../../lib/local-auth";
import { listResubmittableImportBatches } from "../../../../../lib/import-review-workflow";

export async function GET(request: Request) {
  const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
  if (!actor) {
    if (!localAdminIsConfigured()) return Response.json({ message: "请先设置 ADMIN_LOCAL_TOKEN。" }, { status: 503 });
    if (!hasLocalAdminAccess(request)) return Response.json({ message: "本地管理员口令无效。" }, { status: 401 });
    return Response.json([]);
  }
  return Response.json(await listResubmittableImportBatches(actor.userId), { headers: { "Cache-Control": "no-store" } });
}
