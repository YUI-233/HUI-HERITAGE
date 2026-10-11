import { searchPublicCollectionItems } from "../../../../lib/personal-collection-profile";

export const dynamic = "force-dynamic";

/**
 * PS-01：跨收藏馆检索公开书籍与文物。
 * 无需登录。静态段 /items 优先于 /[slug]，故 slug 生成时已避开 "items" 保留字。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  if (q.length > 100) {
    return Response.json({ code: "INVALID_QUERY", message: "搜索关键词不能超过 100 个字符。" }, { status: 400 });
  }

  const rawType = searchParams.get("type");
  if (rawType && rawType !== "BOOK" && rawType !== "ARTIFACT") {
    return Response.json({ code: "INVALID_TYPE", message: "内容类型只允许 BOOK 或 ARTIFACT。" }, { status: 400 });
  }

  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(searchParams.get("limit") || "24", 10) || 24));

  try {
    const result = await searchPublicCollectionItems({
      q,
      type: rawType as "BOOK" | "ARTIFACT" | undefined,
      page,
      limit,
    });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json(
      { code: "PUBLIC_ITEMS_READ_FAILED", message: error instanceof Error ? error.message : "无法检索公开馆藏信息。" },
      { status: 500 },
    );
  }
}

  }
}
