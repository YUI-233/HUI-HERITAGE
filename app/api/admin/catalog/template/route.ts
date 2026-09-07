import { csvDocument } from "../../../../../lib/csv";

export async function GET() {
  const headers = ["分类编号", "分类", "书名", "作者", "册数", "年代", "刊刻年份", "刊刻时间", "刊刻主体", "版本", "装帧", "备注"];
  const row = ["2.2.2", "教法 / 礼制仪规 / 杂学（礼制仪规）", "示例书名", "作者姓名", 1, "清", "光绪十八年", "1892", "清真堂", "木刻本", "线装", "请填写备注"];
  return new Response(csvDocument(headers, [row]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename*=UTF-8''huiheritage-manuscript-template.csv" } });
}
