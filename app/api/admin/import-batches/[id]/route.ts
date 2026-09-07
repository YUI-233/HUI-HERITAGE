import { requirePermission } from "../../../../../lib/admin-access";
import { canViewWorkflow } from "../../../../../lib/local-auth";
import { deleteResubmittableImportBatch, getImportBatchPreview } from "../../../../../lib/import-review-workflow";
import { signedInWorkflowActor } from "../../../../../lib/local-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canViewWorkflow(request))) { const denied = await requirePermission(request, "HOLDING_WRITE"); if (denied) return denied; }
  try { return Response.json(await getImportBatchPreview((await params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "读取预览失败。" }, { status: 404 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
    if (!actor) return Response.json({ message: "删除批量馆藏需要使用拥有录入权限的登录账号。" }, { status: 403 });
    await deleteResubmittableImportBatch((await params).id, actor.userId);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "删除失败。" }, { status: 400 });
  }
}
