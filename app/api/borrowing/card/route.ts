import { issueBorrowingCard } from "../../../../lib/borrowing";
import { usesCloudRuntime } from "../../../../lib/cloud-runtime";
import { getSignedInUser } from "../../../../lib/local-auth";

export async function POST(request: Request) {
  if (usesCloudRuntime()) return Response.json({ message: "借阅证制度当前仅在本地版本开放。" }, { status: 501 });
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后办理借阅证。" }, { status: 401 });
  const result = await issueBorrowingCard(user.id);
  return Response.json(result, { status: result.ok ? 201 : result.code === "VERIFY_REQUIRED" ? 403 : 400 });
}
