import { requireSystemAdmin } from "../../../../lib/admin-access";
import { getHeroContent, saveHeroContent, validateHeroContent } from "../../../../lib/hero-content";

export async function GET() {
  return Response.json(await getHeroContent(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = await requireSystemAdmin(request); if (denied) return denied;
  const content = validateHeroContent(await request.json().catch(() => null));
  if (!content) return Response.json({ error: "INVALID_HERO_CONTENT", message: "图片路径、焦点位置或文字不符合规范。" }, { status: 400 });
  await saveHeroContent(content);
  return Response.json(content);
}
