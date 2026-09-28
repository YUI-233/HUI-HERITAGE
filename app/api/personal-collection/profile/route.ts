import { getSignedInUser } from "../../../../lib/local-auth";
import { getOrCreateProfile, updateProfile, ProfileError } from "../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(_: Request) {
  try {
    const user = await getSignedInUser(_);
    if (!user) return Response.json({ message: "请先登录后再管理收藏馆。" }, { status: 401 });
    const profile = await getOrCreateProfile(user.id);
    return Response.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "无法读取收藏馆设置。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSignedInUser(request);
    if (!user) return Response.json({ message: "请先登录后再管理收藏馆。" }, { status: 401 });
    const body = await request.json();
    const profile = await updateProfile(user.id, body);
    return Response.json(profile, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ProfileError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "无法保存收藏馆设置，请稍后重试。";
    return Response.json({ message }, { status: 400 });
  }
}
