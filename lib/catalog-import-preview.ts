import { parseCsvDocument } from "./csv";

const holdingHeaders = ["关联资料类型", "关联资料编号", "收藏机构", "地区", "来源类型", "索书号／版本", "馆方目录链接", "馆藏说明", "发布状态"];
export const domesticHoldingHeaders = ["书名", "作者", "册数", "年代", "刊刻年份", "刊刻时间", "版本", "版本信息", "图书馆", "检索号", "备注", "链接", "图片1", "图片2"];
export const overseasHoldingHeaders = ["书名", "作者", "册数", "年代", "刊刻年份", "刊刻时间", "版本", "刊刻主体", "国家", "图书馆", "检索号", "链接", "备注"];
const overseasHeaders = ["书名", "册数", "作者", "年份", "公历", "出版信息", "版本", "馆藏国家", "馆藏信息", "检索号", "其他", "在线链接", "備註"];
export const personalHoldingHeaders = ["书名", "作者", "年代", "版本", "收藏机构", "地区", "索书号／版本", "馆方目录链接", "馆藏说明", "提交状态"];
const origins = new Set(["国内馆藏", "海外馆藏", "个人公开收藏"]);
const statuses = new Set(["草稿", "待审核", "公开", "需补充", "已下架"]);
const latestHeaderAliases: Record<string, string[]> = { 国家: ["国家", "馆藏国家"], 备注: ["备注", "備註"] };
export type ImportPreview = { format: "holdings" | "domestic" | "overseas_latest" | "overseas" | "personal" | "unknown"; total: number; valid: number; errors: Array<{ row: number; message: string }>; rows: Array<{ row: number; recordType: string; institution: string; status: string; valid: boolean }> };

function unknown(message: string): ImportPreview { return { format: "unknown", total: 0, valid: 0, errors: [{ row: 1, message }], rows: [] }; }
function hasLatestHeaders(headers: string[], expected: string[]) { return expected.every((header) => (latestHeaderAliases[header] ?? [header]).some((candidate) => headers.includes(candidate))); }
function latestValue(raw: string[], headers: string[], header: string) { const index = (latestHeaderAliases[header] ?? [header]).map((candidate) => headers.indexOf(candidate)).find((candidate) => candidate >= 0) ?? -1; return index >= 0 ? raw[index] || "" : ""; }

export function previewCatalogImport(input: string): ImportPreview {
  const document = parseCsvDocument(input); if (!document.length) return { format: "unknown", total: 0, valid: 0, errors: [{ row: 0, message: "文件为空。" }], rows: [] };
  const headers = document[0]; const index = (header: string) => headers.indexOf(header);
  if (holdingHeaders.every((header) => headers.includes(header))) {
    const rows = []; const errors = [];
    for (let offset = 1; offset < document.length; offset += 1) { const raw = document[offset]; const recordType = raw[index("关联资料类型")] || ""; const recordId = raw[index("关联资料编号")] || ""; const institution = raw[index("收藏机构")] || ""; const region = raw[index("地区")] || ""; const origin = raw[index("来源类型")] || ""; const status = raw[index("发布状态")] || "草稿"; const messages: string[] = []; if (recordType !== "古籍" && recordType !== "文物") messages.push("关联资料类型必须是“古籍”或“文物”"); if (!recordId) messages.push("关联资料编号不能为空"); if (!institution) messages.push("收藏机构不能为空"); if (!region) messages.push("地区不能为空"); if (!origins.has(origin)) messages.push("来源类型无效"); if (!statuses.has(status)) messages.push("发布状态无效"); const valid = !messages.length; rows.push({ row: offset + 1, recordType, institution, status, valid }); if (!valid) errors.push({ row: offset + 1, message: messages.join("；") }); }
    return { format: "holdings", total: rows.length, valid: rows.filter((row) => row.valid).length, errors: errors.slice(0, 50), rows: rows.slice(0, 20) };
  }
  const previewLatestHolding = (format: "domestic" | "overseas_latest", institutionHeader: "图书馆", regionHeader?: "国家") => {
    const rows = []; const errors = [];
    for (let offset = 1; offset < document.length; offset += 1) {
      const raw = document[offset]; const title = latestValue(raw, headers, "书名"); const institution = latestValue(raw, headers, institutionHeader); const region = regionHeader ? latestValue(raw, headers, regionHeader) : "中国"; const volumes = latestValue(raw, headers, "册数") || "1";
      const messages: string[] = [];
      if (!title) messages.push("书名不能为空");
      if (!institution) messages.push("图书馆不能为空");
      if (!region) messages.push("馆藏国家不能为空");
      if (!/^[1-9]\d*$/.test(volumes)) messages.push("册数必须为正整数");
      for (const imageHeader of ["图片1", "图片2"]) {
        const imageUrl = latestValue(raw, headers, imageHeader).trim();
        if (!imageUrl) continue;
        try {
          const url = new URL(imageUrl);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
        } catch {
          messages.push(`${imageHeader}须填写公开可访问的 http(s) 图片网址`);
        }
      }
      const valid = !messages.length;
      rows.push({ row: offset + 1, recordType: format === "domestic" ? "国内古籍" : "海外古籍", institution, status: "待导入", valid });
      if (!valid) errors.push({ row: offset + 1, message: messages.join("；") });
    }
    return { format, total: rows.length, valid: rows.filter((row) => row.valid).length, errors: errors.slice(0, 50), rows: rows.slice(0, 20) };
  };
  if (hasLatestHeaders(headers, domesticHoldingHeaders)) return previewLatestHolding("domestic", "图书馆");
  if (hasLatestHeaders(headers, overseasHoldingHeaders)) return previewLatestHolding("overseas_latest", "图书馆", "国家");
  if (overseasHeaders.every((header) => headers.includes(header))) {
    const rows = []; const errors = [];
    for (let offset = 1; offset < document.length; offset += 1) { const raw = document[offset]; const title = raw[index("书名")] || ""; const country = raw[index("馆藏国家")] || ""; const institution = raw[index("馆藏信息")] || ""; const messages: string[] = []; if (!title) messages.push("书名不能为空"); if (!country) messages.push("馆藏国家不能为空"); if (!institution) messages.push("馆藏信息不能为空"); const valid = !messages.length; rows.push({ row: offset + 1, recordType: "海外馆藏", institution: institution || country, status: "待导入", valid }); if (!valid) errors.push({ row: offset + 1, message: messages.join("；") }); }
    return { format: "overseas", total: rows.length, valid: rows.filter((row) => row.valid).length, errors: errors.slice(0, 50), rows: rows.slice(0, 20) };
  }
  if (personalHoldingHeaders.every((header) => headers.includes(header))) {
    const rows = []; const errors = [];
    for (let offset = 1; offset < document.length; offset += 1) {
      const raw = document[offset]; const title = raw[index("书名")] || ""; const institution = raw[index("收藏机构")] || ""; const region = raw[index("地区")] || ""; const status = raw[index("提交状态")] || "提交";
      const messages: string[] = [];
      if (!title) messages.push("书名不能为空");
      if (!institution) messages.push("收藏机构不能为空");
      if (!region) messages.push("地区不能为空");
      if (status !== "草稿" && status !== "提交") messages.push("提交状态只能是“草稿”或“提交”");
      const valid = !messages.length;
      rows.push({ row: offset + 1, recordType: "个人馆藏", institution, status, valid });
      if (!valid) errors.push({ row: offset + 1, message: messages.join("；") });
    }
    return { format: "personal", total: rows.length, valid: rows.filter((row) => row.valid).length, errors: errors.slice(0, 50), rows: rows.slice(0, 20) };
  }
  return unknown(`未识别 CSV 模板。国内馆藏模板应包含“${domesticHoldingHeaders.slice(0, 5).join("、")}”；海外馆藏模板应包含“${overseasHoldingHeaders.slice(0, 5).join("、")}”。`);
}

export type PersonalHoldingCsvRow = { title: string; author?: string; dynasty?: string; versionType?: string; institution: string; region: string; callNumber?: string; catalogUrl?: string; description?: string; status: "DRAFT" | "PENDING" };

export function parsePersonalHoldingImport(input: string): PersonalHoldingCsvRow[] {
  const preview = previewCatalogImport(input);
  if (preview.format !== "personal" || preview.valid !== preview.total) throw new Error("请先修正个人馆藏 CSV 中的所有错误后再导入。");
  const document = parseCsvDocument(input); const headers = document[0]; const index = (header: string) => headers.indexOf(header);
  return document.slice(1).map((raw) => ({
    title: raw[index("书名")] || "",
    author: raw[index("作者")] || undefined,
    dynasty: raw[index("年代")] || undefined,
    versionType: raw[index("版本")] || undefined,
    institution: raw[index("收藏机构")] || "",
    region: raw[index("地区")] || "",
    callNumber: raw[index("索书号／版本")] || undefined,
    catalogUrl: raw[index("馆方目录链接")] || undefined,
    description: raw[index("馆藏说明")] || undefined,
    status: raw[index("提交状态")] === "草稿" ? "DRAFT" : "PENDING",
  }));
}
