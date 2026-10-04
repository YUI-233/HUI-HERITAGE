import { searchPublicCollectionItems } from "../../../personal-collections/public-collections-data";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedType = url.searchParams.get("type");
    const type = requestedType === "BOOK" || requestedType === "ARTIFACT" ? requestedType : undefined;
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24;
    const result = await searchPublicCollectionItems({ type, q: url.searchParams.get("q") ?? "", page, limit });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ code: "PUBLIC_ITEMS_READ_FAILED", message: error instanceof Error ? error.message : "暂时无法检索公开馆藏。" }, { status: 500 });
  }
}
