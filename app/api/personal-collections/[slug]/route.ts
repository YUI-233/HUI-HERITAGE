import { getPublicCollection } from "../../../personal-collections/public-collections-data";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const requestedType = url.searchParams.get("type");
    const type = requestedType === "BOOK" || requestedType === "ARTIFACT" ? requestedType : undefined;
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24;
    const result = await getPublicCollection(slug, { type, q: url.searchParams.get("q") ?? "", page, limit });
    if (!result) return Response.json({ code: "COLLECTION_NOT_FOUND", message: "未找到该公开收藏馆。" }, { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ code: "COLLECTION_READ_FAILED", message: error instanceof Error ? error.message : "暂时无法读取公开收藏馆。" }, { status: 500 });
  }
}
