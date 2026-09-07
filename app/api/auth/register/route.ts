import { registerPublicUser } from "../../../../lib/user-admin";
import { emailDeliveryConfigured, sendVerificationEmail } from "../../../../lib/email-auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; displayName?: string; password?: string } | null;
  if (!body?.email || !body.password) return Response.json({ message: "请填写邮箱和密码。" }, { status: 400 });
  if (!emailDeliveryConfigured()) return Response.json({ message: "邮箱验证服务尚未配置，暂时不能注册新账号。" }, { status: 503 });
  try {
    const email = body.email.trim().toLocaleLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) return Response.json({ message: "该邮箱已注册，请直接登录或重置密码。" }, { status: 409 });
    const user = existing ?? await registerPublicUser({ email, displayName: body.displayName, password: body.password });
    await sendVerificationEmail(user);
    return Response.json({ id: user.id, email: user.email, message: "验证邮件已发送，请前往邮箱完成验证。" }, { status: existing ? 200 : 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "注册失败。" }, { status: 400 });
  }
}
