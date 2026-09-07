import { checkoutBook } from "../../../../lib/borrowing";
import { usesCloudRuntime } from "../../../../lib/cloud-runtime";
import { getSignedInUser } from "../../../../lib/local-auth";

export async function POST(request: Request) {
  if (usesCloudRuntime()) return Response.json({ message: "借阅证制度当前仅在本地版本开放。" }, { status: 501 });
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后借阅古籍。" }, { status: 401 });
  const body = await request.json().catch(() => null) as { bookId?: unknown } | null;
  if (typeof body?.bookId !== "string" || !body.bookId) return Response.json({ code: "INVALID_REQUEST", message: "缺少古籍编号。" }, { status: 400 });
  const result = await checkoutBook(user.id, body.bookId);
  const status = result.ok ? 200 : result.code === "CARD_REQUIRED" ? 409 : result.code === "LIMIT_REACHED" ? 429 : result.code === "VERIFY_REQUIRED" ? 403 : 400;
  return Response.json(result, { status });
}
