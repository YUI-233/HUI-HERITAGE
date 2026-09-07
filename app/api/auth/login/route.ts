import { createSessionCookie, verifyPassword } from "../../../../lib/local-auth";
import { prisma } from "../../../../lib/prisma";
import { ensureSystemAdmin } from "../../../../lib/user-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLocaleLowerCase();
  if (!email || !body?.password) return Response.json({ message: "请填写邮箱和密码。" }, { status: 400 });
  try { await ensureSystemAdmin(); } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "系统管理员账号初始化失败。" }, { status: 503 }); }
  const user = await prisma.user.findUnique({ where: { email } });
  // 旧账号在邮箱验证功能上线前已经是已启用状态；继续允许其登录。
  // 新注册账号会在验证前保持 isActive=false，因此仍无法绕过验证。
  if (!user?.isActive || !user.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) return Response.json({ message: "邮箱或密码不正确，或账号已停用。" }, { status: 401 });
  return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } }, { headers: { "Set-Cookie": createSessionCookie(user.id), "Cache-Control": "no-store" } });
}
