import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getHomeFeaturedResearchAdminData, saveHomeFeaturedResearchContent } from "../../../../lib/home-featured-research";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getHomeFeaturedResearchAdminData(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  try {
    return Response.json(await saveHomeFeaturedResearchContent(await request.json().catch(() => null)));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "保存推荐学术研究失败。" }, { status: 400 });
  }
}
