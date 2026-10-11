import { inflateRawSync } from "node:zlib";

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelColumn(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStoredFiles(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const write16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
  const write32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write32(localView, 14, crc);
    write32(localView, 18, content.length);
    write32(localView, 22, content.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write32(centralView, 16, crc);
    write32(centralView, 20, content.length);
    write32(centralView, 24, content.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, localOffset);
  const output = new Uint8Array(localOffset + centralSize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Creates a standards-compliant XLSX workbook with one text-valued worksheet. */
export function createXlsxDocument(sheetName: string, rows: Array<Array<unknown>>) {
  const safeSheetName = (sheetName.replace(/[\\\/:*?\[\]]/g, " ").trim() || "Sheet1").slice(0, 31);
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = excelColumn(columnIndex) + String(rowIndex + 1);
      return '<c r="' + reference + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + "</t></is></c>";
    }).join("");
    return '<row r="' + String(rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  const worksheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows + "</sheetData></worksheet>";
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xmlEscape(safeSheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const files = [
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
  ];
  return zipStoredFiles(files);
}

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
