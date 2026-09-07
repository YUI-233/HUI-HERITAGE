import { resetPasswordWithToken } from "../../../../lib/email-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; password?: string } | null;
  if (!body?.token || !body.password) return Response.json({ message: "请填写新密码。" }, { status: 400 });
  try {
    await resetPasswordWithToken(body.token, body.password);
    return Response.json({ message: "密码已重置，请使用新密码登录。" });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "重置密码失败。" }, { status: 400 });
  }
}
