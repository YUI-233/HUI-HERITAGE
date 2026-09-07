import { signedInWorkflowActor } from "../../../lib/local-auth";
import { submitHoldingRevision } from "../../../lib/holding-revision-workflow";

export async function POST(request: Request) {
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_WRITE");
    if (!actor) return Response.json({ message: "请先登录具有馆藏提交权限的账号。" }, { status: 401 });

    const body = await request.json().catch(() => null) as { holdingId?: unknown; values?: unknown } | null;
    const holdingId = typeof body?.holdingId === "string" ? body.holdingId : "";
    if (!holdingId) return Response.json({ message: "缺少要修订的图书馆记录。" }, { status: 400 });

    const values = body?.values && typeof body.values === "object" ? body.values : {};
    const revision = await submitHoldingRevision(holdingId, values, actor.userId);
    return Response.json({ revision, message: "已提交修订申请，请到后台「馆藏数据审核」中的「馆藏记录修订审核」处理。" }, { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "提交修订失败。" }, { status: 400 });
  }
}
