import { getSignedInUser } from "../../../../lib/local-auth";
import { listConversations, startConversation, MessageError } from "../../../../lib/messages";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new MessageError(400, "请求体必须是合法的 JSON。");
  }
}

/** MSG-01：会话列表，按最近消息倒序。 */
export async function GET(request: Request) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再查看站内信。" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10) || 50));

    const result = await listConversations(user.id, page, limit);
    return Response.json(result, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof MessageError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    return Response.json(
      { message: error instanceof Error ? error.message : "无法读取会话列表。" },
      { status: 500 },
    );
  }
}

/** MSG-03：按公开收藏馆 slug 发起私信；双方已有会话时在原会话追加。 */
export async function POST(request: Request) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再发送站内信。" }, { status: 401 });

    const body = await readJson(request);
    const detail = await startConversation(user.id, body);
    return Response.json(detail, { status: 200, headers: PRIVATE });
  } catch (error) {
    if (error instanceof MessageError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    return Response.json(
      { message: error instanceof Error ? error.message : "无法发起会话，请稍后重试。" },
      { status: 500 },
    );
  }
}
