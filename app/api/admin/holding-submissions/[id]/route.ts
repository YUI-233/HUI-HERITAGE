import { requirePermission } from "../../../../../lib/admin-access";
import { discardMyHoldingRevisionDraft, withdrawMyHoldingSubmission } from "../../../../../lib/admin-holdings";
import { signedInWorkflowActor } from "../../../../../lib/local-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, "HOLDING_WRITE");
  if (denied) return denied;
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
    if (!actor) return Response.json({ message: "请使用拥有馆藏录入权限的登录账号撤回申请。" }, { status: 403 });
    return Response.json(await withdrawMyHoldingSubmission((await params).id, actor.userId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "撤回馆藏申请失败。" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, "HOLDING_WRITE");
  if (denied) return denied;
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
    if (!actor) return Response.json({ message: "请使用拥有馆藏录入权限的登录账号删除草稿。" }, { status: 403 });
    return Response.json(await discardMyHoldingRevisionDraft((await params).id, actor.userId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "删除馆藏修改草稿失败。" }, { status: 400 });
  }
}
