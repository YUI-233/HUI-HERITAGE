import { getSignedInUser } from "../../../../../lib/local-auth";
import { listCoverOptions } from "../../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(_: Request) {
  try {
    const user = await getSignedInUser(_);
    if (!user) return Response.json({ message: "请先登录后再管理收藏馆。" }, { status: 401 });
    const items = await listCoverOptions(user.id);
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "无法读取可选封面。" },
      { status: 500 },
    );
  }
}
