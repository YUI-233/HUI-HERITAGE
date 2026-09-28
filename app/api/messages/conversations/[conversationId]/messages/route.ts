import { getSignedInUser } from "../../../../../../lib/local-auth";
import { replyToConversation, MessageError } from "../../../../../../lib/messages";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** MSG-04：回复消息，返回更新后的完整会话详情。 */
export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再发送站内信。" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      throw new MessageError(400, "请求体必须是合法的 JSON。");
    }

    const { conversationId } = await context.params;
    const detail = await replyToConversation(user.id, conversationId, body.body);
    return Response.json(detail, { status: 200, headers: PRIVATE });
  } catch (error) {
    if (error instanceof MessageError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    return Response.json(
      { message: error instanceof Error ? error.message : "无法发送消息，请稍后重试。" },
      { status: 500 },
    );
  }
}
