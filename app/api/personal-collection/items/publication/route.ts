import { getSignedInUser } from "../../../../../lib/local-auth";
import { submitPersonalBooks } from "../../../../../lib/personal-collection";

export async function POST(request: Request) {
  try {
    const user = await getSignedInUser(request);
    if (!user) throw new Error("请先登录。");
    const body = await request.json() as { action?: string };
    if (body.action !== "APPLY_BOOKS") throw new Error("请选择“一键公开藏书”。");
    return Response.json(await submitPersonalBooks(user.id));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "公开申请未完成。" }, { status: 400 });
  }
}
