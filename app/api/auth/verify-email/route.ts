import { verifyEmailToken } from "../../../../lib/email-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) return Response.json({ message: "缺少验证链接。" }, { status: 400 });
  try {
    const result = await verifyEmailToken(body.token);
    return Response.json({ email: result.email, message: result.alreadyVerified ? "该邮箱已经验证完成，可以直接登录。" : "邮箱验证成功，现在可以登录。" });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "邮箱验证失败。" }, { status: 400 });
  }
}
