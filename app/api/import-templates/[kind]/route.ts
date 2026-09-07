import { csvDocument } from "../../../../lib/csv";

const templates = {
  domestic: {
    filename: "国内馆藏导入模板.csv",
    headers: ["书名", "作者", "册数", "年代", "刊刻年份", "刊刻时间", "版本", "版本信息", "图书馆", "检索号", "备注", "链接", "图片1", "图片2"],
    rows: [["示例书名", "作者姓名", "1", "清", "光绪元年", "1875", "木刻本", "卷次、版式或装帧补充说明", "示例图书馆", "编号-001", "补充说明", "https://example.com/catalog", "https://example.com/image-1.jpg", ""]],
  },
  personal: {
    filename: "个人馆藏导入模板.csv",
    headers: ["书名", "作者", "年代", "版本", "收藏机构", "地区", "索书号／版本", "馆方目录链接", "馆藏说明", "提交状态"],
    rows: [["示例书名", "作者姓名", "年代待考", "版本待考", "个人收藏", "中国·北京", "编号-001", "https://example.com", "请填写馆藏说明", "草稿"]],
  },
  holdings: {
    filename: "机构馆藏导入模板.csv",
    headers: ["关联资料类型", "关联资料编号", "收藏机构", "地区", "来源类型", "索书号／版本", "馆方目录链接", "馆藏说明", "发布状态"],
    rows: [["古籍", "请填写已有资料编号", "示例图书馆", "中国·北京", "国内馆藏", "编号-001", "https://example.com", "请填写馆藏说明", "草稿"]],
  },
  overseas: {
    filename: "海外藏馆信息导入模板.csv",
    headers: ["书名", "作者", "册数", "年代", "刊刻年份", "刊刻时间", "版本", "刊刻主体", "国家", "图书馆", "检索号", "链接", "备注"],
    rows: [["示例书名", "作者姓名", "1", "清", "光绪元年", "1875", "木刻本", "京都清真寺", "美国", "示例图书馆", "编号-001", "https://library.example/item/001", "馆方目录说明或补充备注"]],
  },
  overseasLegacy: {
    filename: "海外藏馆旧版导入模板.csv",
    headers: ["书名", "册数", "作者", "年份", "公历", "出版信息", "版本", "馆藏国家", "馆藏信息", "检索号", "其他", "在线链接", "備註"],
    rows: [["示例书名", "1", "作者姓名", "年代", "1900", "出版信息", "版本", "国家", "收藏机构", "编号-001", "其他说明", "https://example.com", "备注"]],
  },
};

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const template = templates[(await params).kind as keyof typeof templates];
  if (!template) return Response.json({ message: "未找到该 CSV 模板。" }, { status: 404 });
  return new Response(csvDocument(template.headers, template.rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.filename)}`, "Cache-Control": "no-store" } });
}
