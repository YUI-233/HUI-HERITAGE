import { getSignedInUser } from "../../../../../lib/local-auth";
import { getConversationDetail, MessageError } from "../../../../../lib/messages";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** MSG-02：会话详情，只允许参与者读取，其他会话统一 404。 */
export async function GET(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再查看站内信。" }, { status: 401 });

    const { conversationId } = await context.params;
    const detail = await getConversationDetail(user.id, conversationId);
    return Response.json(detail, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof MessageError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    return Response.json(
      { message: error instanceof Error ? error.message : "无法读取会话。" },
      { status: 500 },
    );
  }
}
