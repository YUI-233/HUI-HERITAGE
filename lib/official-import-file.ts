import { csvDocument } from "./csv";
import { parseXlsxDocument } from "./xlsx";

/** Normalizes an official holding spreadsheet to UTF-8 CSV before preview and review. */
export async function readOfficialImportFile(file: File) {
  if (/\.xlsx$/i.test(file.name)) {
    const rows = parseXlsxDocument(await file.arrayBuffer());
    if (rows.length < 2) throw new Error("Excel 文件中没有可导入的馆藏记录。");
    return csvDocument(rows[0], rows.slice(1));
  }
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Chinese Windows exports are commonly GBK/GB18030 encoded.
    return new TextDecoder("gb18030").decode(bytes);
  }
}

export function isOfficialImportFile(file: unknown): file is File {
  return file instanceof File && file.size > 0 && file.size <= 5 * 1024 * 1024 && /\.(csv|xlsx)$/i.test(file.name);
}
