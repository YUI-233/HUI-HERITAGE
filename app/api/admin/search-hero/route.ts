import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getSearchHeroContent, saveSearchHeroContent } from "../../../../lib/search-hero-content";

export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await getSearchHeroContent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  return Response.json(await saveSearchHeroContent(await request.json().catch(() => null)));
}
