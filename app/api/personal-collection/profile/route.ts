import { getSignedInUser } from "../../../../lib/local-auth";
import { getOrCreateProfile, updateProfile, ProfileError } from "../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后再管理收藏馆。" }, { status: 401 });

  try {
    const profile = await getOrCreateProfile(user.id);
    return Response.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { code: "PROFILE_READ_FAILED", message: error instanceof Error ? error.message : "无法读取收藏馆设置。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "请先登录后再管理收藏馆。" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const profile = await updateProfile(user.id, body);
    return Response.json(profile, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ProfileError) {
      return Response.json({ code: "PROFILE_VALIDATION_FAILED", message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "无法保存收藏馆设置，请稍后重试。";
    return Response.json({ code: "PROFILE_SAVE_FAILED", message }, { status: 400 });
  }
}
