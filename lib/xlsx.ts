import { inflateRawSync } from "node:zlib";

function text(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity] ?? entity);
}

function zipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
  if (end < 0) throw new Error("Excel 文件格式不正确。");
  const entries = new Map<string, Uint8Array>(); let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  while (cursor < end && view.getUint32(cursor, true) === 0x02014b50) {
    const method = view.getUint16(cursor + 10, true); const compressed = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const offset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Excel 文件目录损坏。");
    const localNameLength = view.getUint16(offset + 26, true); const localExtraLength = view.getUint16(offset + 28, true); const contentStart = offset + 30 + localNameLength + localExtraLength;
    const content = bytes.slice(contentStart, contentStart + compressed);
    entries.set(name, method === 0 ? content : method === 8 ? inflateRawSync(content) : (() => { throw new Error("该 Excel 压缩格式暂不支持。"); })());
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function columnIndex(reference: string) {
  return reference.replace(/\d/g, "").split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

/** Reads the first worksheet of a simple .xlsx workbook into the same rows shape used by CSV imports. */
export function parseXlsxDocument(input: ArrayBuffer) {
  const entries = zipEntries(new Uint8Array(input)); const decoder = new TextDecoder();
  const sharedXml = decoder.decode(entries.get("xl/sharedStrings.xml") ?? new Uint8Array()).replace(/<(\/?)[A-Za-z]+:/g, "<$1");
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => text(match[1]));
  const sheetPath = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()[0];
  if (!sheetPath) throw new Error("Excel 文件中没有可读取的工作表。");
  const sheet = decoder.decode(entries.get(sheetPath)).replace(/<(\/?)[A-Za-z]+:/g, "<$1"); const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = /\br="([A-Z]+\d+)"/i.exec(cellMatch[1])?.[1]; if (!reference) continue;
      const index = columnIndex(reference); const type = /\bt="([^"]+)"/.exec(cellMatch[1])?.[1]; const value = /<v[^>]*>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellMatch[2])?.[1] ?? "";
      row[index] = type === "s" ? shared[Number(value)] ?? "" : text(value);
    }
    if (row.some((cell) => cell?.trim())) rows.push(row.map((cell) => cell ?? ""));
  }
  return rows;
}
