import { getSignedInUser } from "../../../../lib/local-auth";
import { prisma } from "../../../../lib/prisma";
import { usesCloudRuntime } from "../../../../lib/cloud-runtime";

export async function PUT(request: Request) {
  const viewer = await getSignedInUser(request);
  if (!viewer) return Response.json({ message: "请先登录。" }, { status: 401 });
  if (usesCloudRuntime()) return Response.json({ message: "正式环境的显示名称由 GPT 账户资料管理，暂不能在本站修改。" }, { status: 409 });
  const body = await request.json().catch(() => null) as { displayName?: unknown } | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName) return Response.json({ message: "显示名称不能为空。" }, { status: 400 });
  if (displayName.length > 60) return Response.json({ message: "显示名称不能超过 60 个字符。" }, { status: 400 });
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const previousChange = await prisma.auditEvent.findFirst({ where: { entityType: "USER_PROFILE", entityId: viewer.id, action: "DISPLAY_NAME_CHANGED", createdAt: { gte: startOfYear } }, select: { id: true } });
  if (previousChange) {
    return Response.json({ message: "本年度的显示名称修改机会已使用。" }, { status: 429 });
  }
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: viewer.id }, data: { displayName }, select: { displayName: true } });
    await tx.auditEvent.create({ data: { entityType: "USER_PROFILE", entityId: viewer.id, action: "DISPLAY_NAME_CHANGED", actorId: viewer.id, payload: { changedAt: now.toISOString() } } });
    return updated;
  });
  return Response.json(user);
}
