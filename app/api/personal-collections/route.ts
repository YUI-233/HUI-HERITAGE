import { getPublicCollections } from "../../personal-collections/public-collections-data";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "12", 10) || 12;
    const result = await getPublicCollections({ q: url.searchParams.get("q") ?? "", page, limit });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ code: "COLLECTIONS_READ_FAILED", message: error instanceof Error ? error.message : "暂时无法读取公开收藏馆。" }, { status: 500 });
  }
}
