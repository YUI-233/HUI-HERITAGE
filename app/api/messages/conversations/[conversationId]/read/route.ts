import { getSignedInUser } from "../../../../../../lib/local-auth";
import { markConversationRead, MessageError } from "../../../../../../lib/messages";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** MSG-05：标记会话已读，返回清零后的未读数。 */
export async function PATCH(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再查看站内信。" }, { status: 401 });

    const { conversationId } = await context.params;
    const result = await markConversationRead(user.id, conversationId);
    return Response.json(result, { status: 200, headers: PRIVATE });
  } catch (error) {
    if (error instanceof MessageError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    return Response.json(
      { message: error instanceof Error ? error.message : "无法标记会话已读。" },
      { status: 500 },
    );
  }
}
