import { getSignedInUser } from "../../../../../lib/local-auth";
import { listCollectionCoverOptions } from "../../../../../lib/personal-collection-profile";

export async function GET(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录。" }, { status: 401 });
  try {
    return Response.json({ items: await listCollectionCoverOptions(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ code: "COVER_OPTIONS_READ_FAILED", message: error instanceof Error ? error.message : "暂时无法读取可选封面。" }, { status: 500 });
  }
}
