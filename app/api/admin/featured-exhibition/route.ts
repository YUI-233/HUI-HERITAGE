import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getFeaturedExhibitionAdminData, saveFeaturedExhibitionContent } from "../../../../lib/featured-exhibition";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getFeaturedExhibitionAdminData(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  try {
    return Response.json(await saveFeaturedExhibitionContent(await request.json().catch(() => null)));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "保存精选展览失败。" }, { status: 400 });
  }
}
