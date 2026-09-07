import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getHomeBrowseContent, saveHomeBrowseContent } from "../../../../lib/home-browse";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getHomeBrowseContent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  try {
    return Response.json(await saveHomeBrowseContent(await request.json().catch(() => null)));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "保存首页浏览图片失败。" }, { status: 400 });
  }
}
