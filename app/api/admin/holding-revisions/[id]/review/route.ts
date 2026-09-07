import { signedInWorkflowActor } from "../../../../../../lib/local-auth";
import { reviewHoldingRevision } from "../../../../../../lib/holding-revision-workflow";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_REVIEW");
    if (!actor) return Response.json({ message: "请先登录有馆藏审核权限的账号。" }, { status: 401 });
    const body = await request.json().catch(() => null) as { decision?: unknown; comment?: unknown } | null;
    const decision = body?.decision;
    if (decision !== "APPROVED" && decision !== "REJECTED" && decision !== "NEEDS_REVISION") {
      return Response.json({ message: "请选择有效的审核结论。" }, { status: 400 });
    }
    return Response.json(await reviewHoldingRevision((await params).id, decision, body?.comment, actor.userId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "审核馆藏修订失败。" }, { status: 400 });
  }
}
