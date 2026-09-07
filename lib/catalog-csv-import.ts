import { parseCsvDocument } from "./csv";
import { manuscriptCategoryGroups } from "./manuscript-categories";
import type { AdminCatalogInput } from "./admin-catalog";

const categoryByCode = new Map<string, string>();
for (const group of manuscriptCategoryGroups) {
  const groupCode = group.label.match(/^(?:[一二三四五六七八九十]+、|\d+、)/)?.[0]?.replace("、", "");
  if (groupCode) categoryByCode.set(groupCode, group.label);
  for (const option of group.options) categoryByCode.set(option.match(/^\d+(?:\.\d+)*/)?.[0] ?? option, option);
}

const normalizeHeader = (value: string) => value.replace(/^\ufeff/, "").replace(/[\s　]/g, "").trim();
const clean = (value: string | undefined) => value?.trim() || undefined;

function categoryValues(code: string | undefined, label: string | undefined) {
  const values = [code, label].flatMap((value) => value?.split(/[、,，;；\n]/).map((item) => item.trim()).filter(Boolean) ?? []);
  return [...new Set(values.map((value) => categoryByCode.get(value) ?? value))].slice(0, 12);
}

export function parseManuscriptCsv(input: string): AdminCatalogInput[] {
  const [rawHeaders = [], ...rows] = parseCsvDocument(input);
  const headers = rawHeaders.map(normalizeHeader);
  const index = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
  const titleIndex = index("书名", "题名");
  if (titleIndex < 0) throw new Error("CSV 必须包含“书名”列。");
  const authorIndex = index("作者"); const volumeIndex = index("册数", "卷册数"); const eraIndex = index("年代", "朝代"); const eraDetailIndex = index("刊刻年份", "年代2", "年代２", "年代（二）", "年号"); const publicationIndex = index("刊刻时间", "出版/刊刻时间", "出版／刊刻时间", "出版刊刻时间"); const publisherIndex = index("刊刻主体", "出版社/刊刻主体", "出版社／刊刻主体", "出版社"); const versionIndex = index("版本"); const bindingIndex = index("装帧"); const descriptionIndex = index("备注", "说明"); const categoryCodeIndex = index("分类编号"); const categoryIndex = index("分类");
  const result: AdminCatalogInput[] = [];
  rows.forEach((row, rowIndex) => {
    const title = clean(row[titleIndex]);
    if (!title) throw new Error(`第 ${rowIndex + 2} 行缺少书名。`);
    const volumeCount = Math.max(1, Math.min(999, Math.floor(Number(row[volumeIndex]) || 1)));
    result.push({ type: "manuscript", title, author: clean(row[authorIndex]), dynasty: clean(row[eraIndex]), eraDetail: clean(row[eraDetailIndex]), publicationDate: clean(row[publicationIndex]), imprintPublisher: clean(row[publisherIndex]), versionType: clean(row[versionIndex]), binding: clean(row[bindingIndex]), volumeCount, categories: categoryValues(row[categoryCodeIndex], row[categoryIndex]), description: clean(row[descriptionIndex]), status: "DRAFT" });
  });
  if (!result.length) throw new Error("CSV 中没有可导入的古籍记录。请至少保留一行数据。");
  return result;
}
