import { getSignedInUser } from "../../../lib/local-auth";
import { listNotifications, markNotificationsRead } from "../../../lib/notifications";

export async function GET(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  return Response.json(await listNotifications(user.id));
}

export async function POST(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "READ_ALL") return Response.json({ message: "无效的通知操作。" }, { status: 400 });
  await markNotificationsRead(user.id);
  return Response.json({ ok: true });
}
