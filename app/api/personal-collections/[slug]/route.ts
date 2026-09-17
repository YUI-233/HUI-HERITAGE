import { getPublicCollectionBySlug } from "../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const type = typeParam === "BOOK" || typeParam === "ARTIFACT" ? typeParam : undefined;
  const q = (searchParams.get("q") || "").toString().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(searchParams.get("limit") || "24", 10) || 24));
  try {
    const result = await getPublicCollectionBySlug(slug, { type, q, page, limit });
    if (!result) {
      return Response.json({ message: "未找到该公开收藏馆，或其中已无公开内容。" }, { status: 404 });
    }
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "无法读取公开收藏馆。" },
      { status: 500 },
    );
  }
}
