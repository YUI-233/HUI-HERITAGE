import { getSignedInUser } from "../../../../lib/local-auth";
import { listPersonalItems } from "../../../../lib/personal-collection";

export async function GET(request: Request) {
  try {
    const user = await getSignedInUser(request); if (!user) throw new Error("请先登录。");
    return Response.json(await listPersonalItems(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法读取我的公开申请。" }, { status: 401 }); }
}
