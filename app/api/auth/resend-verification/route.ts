import { emailDeliveryConfigured, sendVerificationEmail } from "../../../../lib/email-auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLocaleLowerCase();
  if (!email) return Response.json({ message: "请输入邮箱地址。" }, { status: 400 });
  if (!emailDeliveryConfigured()) return Response.json({ message: "邮箱验证服务尚未配置。" }, { status: 503 });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerifiedAt: true } });
    if (user && !user.emailVerifiedAt) await sendVerificationEmail(user);
    return Response.json({ message: "如该邮箱存在待验证账号，验证邮件已发送。" });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "暂时无法发送验证邮件。" }, { status: 429 });
  }
}
