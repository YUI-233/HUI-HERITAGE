import { emailDeliveryConfigured, sendPasswordResetEmail } from "../../../../lib/email-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLocaleLowerCase();
  if (!email) return Response.json({ message: "请输入邮箱地址。" }, { status: 400 });
  if (!emailDeliveryConfigured()) return Response.json({ message: "密码重置邮件服务尚未配置。" }, { status: 503 });
  try {
    await sendPasswordResetEmail(email);
    return Response.json({ message: "如该邮箱已验证，我们已发送重置密码邮件。" });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "暂时无法处理此请求。" }, { status: 429 });
  }
}
