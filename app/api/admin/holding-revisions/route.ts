import { signedInWorkflowActor } from "../../../../lib/local-auth";
import { listHoldingRevisions } from "../../../../lib/holding-revision-workflow";

export async function GET(request: Request) {
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_REVIEW");
    if (!actor) return Response.json({ message: "请先登录有馆藏审核权限的账号。" }, { status: 401 });
    return Response.json(await listHoldingRevisions(actor.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "读取馆藏修订失败。" }, { status: 400 });
  }
}
