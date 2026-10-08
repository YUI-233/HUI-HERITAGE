import { deflateRawSync } from "node:zlib";
import type { ReviewStatus } from "@prisma/client";
import { prisma } from "./prisma";

const PUBLIC_ITEM = { status: "APPROVED" as ReviewStatus, isPublic: true };

/** 带 HTTP 状态与错误码的业务错误，供路由层映射。 */
export class CollectionExportError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ExportedBook = {
  serialNumber: string;
  title: string;
  creator: string | null;
  era: string | null;
  eraDetail: string | null;
  publicationDate: string | null;
  imprintPublisher: string | null;
  editionOrCategory: string | null;
  binding: string | null;
  categories: string[];
  volumeCount: number;
  description: string | null;
};

export type PublicBookExport = {
  fileName: string;
  bytes: Buffer;
  bookCount: number;
  collection: { slug: string; name: string; ownerName: string };
  exportedAt: Date;
};

/** PC-03 导出列顺序，与契约文档一致；只取公开字段，不含邮箱、用户 ID 与审核信息。 */
const COLUMNS: Array<{ header: string; value: (book: ExportedBook) => string }> = [
  { header: "编号", value: (b) => b.serialNumber },
  { header: "书名", value: (b) => b.title },
  { header: "作者", value: (b) => b.creator ?? "" },
  { header: "作者年代", value: (b) => b.era ?? "" },
  { header: "刊刻年份", value: (b) => b.eraDetail ?? "" },
  { header: "刊刻时间", value: (b) => b.publicationDate ?? "" },
  { header: "刊刻主体", value: (b) => b.imprintPublisher ?? "" },
  { header: "版本", value: (b) => b.editionOrCategory ?? "" },
  { header: "装帧", value: (b) => b.binding ?? "" },
  { header: "分类", value: (b) => (b.categories ?? []).join("；") },
  { header: "册数", value: (b) => String(b.volumeCount ?? 1) },
  { header: "公开说明", value: (b) => b.description ?? "" },
];

// ---------- 最小 zip（deflate）写入 ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(entries: Array<{ name: string; data: Uint8Array }>): Buffer {
  const encoder = new TextEncoder();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = Buffer.from(entry.data);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // 文件名使用 UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12); // 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, Buffer.from(nameBytes), compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, Buffer.from(nameBytes));

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, eocd]);
}

// ---------- 最小 xlsx 组装（inline string，无需 sharedStrings） ----------

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** XML 文本转义，并剔除电子表格规范不允许的控制字符。 */
function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

function columnLetter(index: number): string {
  let rest = index;
  let name = "";
  while (rest >= 0) {
    name = String.fromCharCode((rest % 26) + 65) + name;
    rest = Math.floor(rest / 26) - 1;
  }
  return name;
}

function sheetXml(rows: string[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map(
          (cell, columnIndex) =>
            `<c r="${columnLetter(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlText(cell)}</t></is></c>`,
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="公开书单" sheetId="1" r:id="rId1"/><sheet name="导出信息" sheetId="2" r:id="rId2"/></sheets></workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`;

const ENCODER = new TextEncoder();

function buildWorkbook(books: ExportedBook[], meta: { name: string; ownerName: string; exportedAt: Date }): Buffer {
  const header = COLUMNS.map((column) => column.header);
  const rows = [header, ...books.map((book) => COLUMNS.map((column) => column.value(book)))];
  const info = [
    ["收藏馆名称", meta.name],
    ["收藏者公开名称", meta.ownerName],
    ["导出时间", meta.exportedAt.toISOString().slice(0, 10)],
    ["公开书籍数量", String(books.length)],
  ];
  return zipFiles([
    { name: "[Content_Types].xml", data: ENCODER.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: ENCODER.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: ENCODER.encode(WORKBOOK_XML) },
    { name: "xl/_rels/workbook.xml.rels", data: ENCODER.encode(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: ENCODER.encode(sheetXml(rows)) },
    { name: "xl/worksheets/sheet2.xml", data: ENCODER.encode(sheetXml(info)) },
  ]);
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "").trim() || "收藏馆";
}

// ---------- PC-03：导出其他收藏馆的公开书单 ----------

export async function exportPublicBooks(opts: {
  slug: string;
  viewerId: string | null;
  format: string;
}): Promise<PublicBookExport> {
  if (opts.format !== "xlsx") {
    throw new CollectionExportError(400, "UNSUPPORTED_EXPORT_FORMAT", "当前只支持导出 xlsx 格式的书单。");
  }
  if (!opts.viewerId) {
    throw new CollectionExportError(401, "AUTH_REQUIRED", "请先登录后再导出公开书单。");
  }

  const card = await prisma.borrowingCard.findUnique({
    where: { userId: opts.viewerId },
    select: { status: true },
  });
  if (!card) {
    throw new CollectionExportError(403, "CARD_REQUIRED", "请先办理借阅证后再导出公开书单。");
  }
  if (card.status !== "ACTIVE") {
    throw new CollectionExportError(403, "CARD_INACTIVE", "当前借阅证未生效，无法导出公开书单。");
  }

  const profile = await prisma.personalCollectionProfile.findUnique({
    where: { slug: opts.slug },
    select: { slug: true, displayName: true, ownerId: true },
  });
  if (!profile) {
    throw new CollectionExportError(404, "COLLECTION_NOT_FOUND", "未找到该收藏馆。");
  }
  if (profile.ownerId === opts.viewerId) {
    throw new CollectionExportError(403, "OWN_COLLECTION_EXPORT_NOT_ALLOWED", "该入口用于导出其他收藏馆的书单。");
  }

  const ownerId = profile.ownerId;
  const hasPublicItem = await prisma.personalCollectionItem.findFirst({
    where: { ownerId, ...PUBLIC_ITEM },
    select: { id: true },
  });
  if (!hasPublicItem) {
    throw new CollectionExportError(404, "COLLECTION_NOT_FOUND", "该收藏馆尚未公开任何内容。");
  }

  const books = await prisma.personalCollectionItem.findMany({
    where: { ownerId, type: "BOOK", ...PUBLIC_ITEM },
    orderBy: { serialNumber: "asc" },
    select: {
      serialNumber: true,
      title: true,
      creator: true,
      era: true,
      eraDetail: true,
      publicationDate: true,
      imprintPublisher: true,
      editionOrCategory: true,
      binding: true,
      categories: true,
      volumeCount: true,
      description: true,
    },
  });
  if (!books.length) {
    throw new CollectionExportError(404, "NO_PUBLIC_BOOKS", "该收藏馆暂无可导出的公开书籍。");
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true } });
  const exportedAt = new Date();
  const collection = {
    slug: profile.slug,
    name: profile.displayName,
    ownerName: owner?.displayName ?? "",
  };

  return {
    fileName: `${safeFileName(collection.name)}-公开书单-${exportedAt.toISOString().slice(0, 10)}.xlsx`,
    bytes: buildWorkbook(books, { name: collection.name, ownerName: collection.ownerName, exportedAt }),
    bookCount: books.length,
    collection,
    exportedAt,
  };
}
