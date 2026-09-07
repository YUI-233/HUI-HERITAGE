import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = process.argv[2];
const writeChanges = process.argv.includes("--write");
const previewPath = process.argv[3];

if (!workbookPath) throw new Error("请传入个人书籍 Excel 模板路径。");

const source = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(source);
const sheet = workbook.worksheets.getItemAt(0);
const usedRange = sheet.getUsedRange(true);
const usedValues = usedRange.values;
const headerRowIndex = usedValues.findIndex((row) => row.some((value) => ["书名", "题名"].includes(String(value ?? "").trim())));
if (headerRowIndex < 0) throw new Error("未找到包含“书名”列的表头行。");
const headers = usedValues[headerRowIndex] ?? [];

console.log(JSON.stringify({ sheet: sheet.name, headerRow: headerRowIndex + 1, headers }, null, 2));

if (writeChanges) {
  const replacements = new Map([
    ["年代2", "刊刻年份"],
    ["年代 2", "刊刻年份"],
    ["出版/刊刻时间", "刊刻时间"],
    ["出版／刊刻时间", "刊刻时间"],
    ["出版社/刊刻主体", "刊刻主体"],
    ["出版社／刊刻主体", "刊刻主体"],
  ]);
  headers.forEach((header, index) => {
    const replacement = replacements.get(String(header ?? ""));
    if (replacement) sheet.getCell(headerRowIndex, index).values = [[replacement]];
  });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(workbookPath);
}

if (previewPath) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1.5, format: "png" });
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
}
