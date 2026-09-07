import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getHomeRecommendedBooksAdminData, saveHomeRecommendedBooksContent } from "../../../../lib/home-recommended-books";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getHomeRecommendedBooksAdminData(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  try {
    return Response.json(await saveHomeRecommendedBooksContent(await request.json().catch(() => null)));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "保存古籍阅读推荐失败。" }, { status: 400 });
  }
}
