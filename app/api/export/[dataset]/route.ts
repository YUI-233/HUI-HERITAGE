import { csvDocument } from "../../../../lib/csv";
import { listCatalogRecords } from "../../../../lib/catalog-repository";
import { listHoldings } from "../../../../lib/holdings-repository";
import { listResearchArticles } from "../../../../lib/research-repository";

const exportedDatasets = ["catalog", "holdings", "research"] as const;
type ExportedDataset = typeof exportedDatasets[number];

function isExportedDataset(value: string): value is ExportedDataset {
  return exportedDatasets.includes(value as ExportedDataset);
}

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!isExportedDataset(dataset)) return Response.json({ error: "NOT_FOUND", message: "未找到可导出的数据集。" }, { status: 404 });
  let content = "";
  if (dataset === "catalog") {
    const records = await listCatalogRecords();
    content = csvDocument(["编号", "类型", "题名", "年代／版本", "数字化来源", "主题词", "图像访问"], records.map((record) => [record.id, record.type === "manuscript" ? "古籍" : "文物", record.title, record.date, record.source, record.keywords.join("；"), record.imageAccess === "public" ? "游客可见" : record.imageAccess === "member" ? "会员可见" : "未上传"]));
  }
  if (dataset === "holdings") {
    const holdings = await listHoldings();
    content = csvDocument(["编号", "资料题名", "资料类型", "收藏机构", "地区", "来源类型", "索书号／版本", "说明", "馆方目录"], holdings.map((holding) => [holding.id, holding.record.title, holding.record.type === "manuscript" || holding.record.type === "personal-book" ? "古籍" : "文物", holding.institution, holding.region, { DOMESTIC: "国内", OVERSEAS: "海外", PERSONAL: "个人公开收藏" }[holding.origin], holding.callNumber, holding.description, holding.catalogUrl]));
  }
  if (dataset === "research") {
    const articles = await listResearchArticles();
    content = csvDocument(["编号", "题名", "作者", "出处", "分类", "主题词", "摘要", "关联馆藏编号"], articles.map((article) => [article.id, article.title, article.author, article.publication, article.category, article.keywords.join("；"), article.summary, article.relatedRecordIds.join("；")]));
  }
  return new Response(content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="huiheritage-${dataset}.csv"`, "Cache-Control": "no-store" } });
}
