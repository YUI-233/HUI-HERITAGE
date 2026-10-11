import { requireSystemAdmin } from "../../../../lib/admin-access";
import { analyticsFilter, getVisitAnalytics, visitDetails } from "../../../../lib/visit-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
function cell(value: string) { return `"${value.replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`; }
export async function GET(request: Request) {
  const denied = await requireSystemAdmin(request);
  if (denied) return denied;
  let filter;
  try { filter = analyticsFilter(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "筛选无效" }, { status: 400, headers: noStore }); }
  try {
    if (new URL(request.url).searchParams.get("export") === "csv") {
      const rows = await visitDetails(filter, 10001, 0);
      if (rows.length > 10000) return Response.json({ message: "导出最多 10,000 条，请缩小日期范围或增加筛选条件。" }, { status: 400, headers: noStore });
      const lines = [["时间（北京时间）", "用户类型", "页面标题", "页面路径", "内容类型", "来源"], ...rows.map(r => [r.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }), r.userType === "REGISTERED" ? "注册用户" : "游客", r.title, r.path, r.contentType === "BOOK" ? "古籍" : r.contentType === "ARTICLE" ? "文章" : "普通页面", r.source || "直接访问"])];
      return new Response("\uFEFF" + lines.map(r => r.map(cell).join(",")).join("\r\n"), { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="visits-${filter.from}-${filter.to}.csv"` } });
    }
    return Response.json(await getVisitAnalytics(filter), { headers: noStore });
  } catch (error) {
    console.error("Analytics query failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ message: "访问数据暂时无法加载，请稍后重试。" }, { status: 503, headers: noStore });
  }
}
