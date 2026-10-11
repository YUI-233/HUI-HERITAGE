import { listPublicCollections } from "../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toString().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(searchParams.get("limit") || "12", 10) || 12));

  try {
    const result = await listPublicCollections({ q, page, limit });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json(
      { code: "COLLECTIONS_READ_FAILED", message: error instanceof Error ? error.message : "无法读取公开收藏馆目录。" },
      { status: 500 },
    );
  }
}
