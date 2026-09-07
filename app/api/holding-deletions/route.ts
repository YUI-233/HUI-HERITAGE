import { signedInWorkflowActor } from "../../../lib/local-auth";
import { submitHoldingDeletion } from "../../../lib/holding-revision-workflow";

export async function POST(request: Request) {
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
    if (!actor) return Response.json({ message: "请先登录具有馆藏提交权限的账号。" }, { status: 401 });

    const body = await request.json().catch(() => null) as { holdingId?: unknown; reason?: unknown } | null;
    const holdingId = typeof body?.holdingId === "string" ? body.holdingId : "";
    if (!holdingId) return Response.json({ message: "缺少要申请删除的图书馆记录。" }, { status: 400 });

    const revision = await submitHoldingDeletion(holdingId, body?.reason, actor.userId);
    return Response.json({ revision, message: "删除申请已提交，请到后台「馆藏数据审核」中的「馆藏记录修订审核」处理。" }, { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "提交删除申请失败。" }, { status: 400 });
  }
}
