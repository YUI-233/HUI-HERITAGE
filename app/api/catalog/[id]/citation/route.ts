import { getCatalogRecord } from "../../../../../lib/catalog-repository";

type CitationRouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: CitationRouteProps) {
  const { id } = await params;
  const record = await getCatalogRecord(id);
  if (!record) return Response.json({ error: "NOT_FOUND", message: "未找到这条馆藏资料" }, { status: 404 });

  const recordType = record.type === "manuscript" ? "古籍" : "文物图像";
  const citation = `HUI HERITAGE. ${record.title}[数字馆藏]. 汉文回教古籍文物遗产. 类型：${recordType}；年代：${record.date}；收藏来源：${record.source}。`;
  return new Response(citation, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="huiheritage-${record.id}-citation.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
