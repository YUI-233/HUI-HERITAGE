import { getSignedInUser } from "../../../../lib/local-auth";
import { getCollectionProfile, updateCollectionProfile } from "../../../../lib/personal-collection-profile";

export async function GET(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录。" }, { status: 401 });
  try {
    return Response.json(await getCollectionProfile(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ code: "PROFILE_READ_FAILED", message: error instanceof Error ? error.message : "暂时无法读取收藏馆设置。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录。" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    return Response.json(await updateCollectionProfile(user, body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ code: "PROFILE_VALIDATION_FAILED", message: error instanceof Error ? error.message : "暂时无法保存收藏馆设置。" }, { status: 400 });
  }
}
