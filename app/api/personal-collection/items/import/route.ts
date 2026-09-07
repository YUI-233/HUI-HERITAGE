import { getSignedInUser } from "../../../../../lib/local-auth";
import { createPersonalItem, parsePersonalCollectionCsv, parsePersonalCollectionRows } from "../../../../../lib/personal-collection";
import { parseXlsxDocument } from "../../../../../lib/xlsx";

async function readCsvRows(file: File, requestedType: "BOOK" | "ARTIFACT") {
  const bytes = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  try {
    return parsePersonalCollectionCsv(utf8, requestedType);
  } catch (utf8Error) {
    // Excel exported CSV files on Chinese Windows are frequently GBK/GB18030.
    // Retry with the wider encoding before returning the useful validation error.
    try {
      return parsePersonalCollectionCsv(new TextDecoder("gb18030").decode(bytes), requestedType);
    } catch {
      throw utf8Error;
    }
  }
}

async function readImportRows(file: File, requestedType: "BOOK" | "ARTIFACT") {
  if (/\.xlsx$/i.test(file.name)) return parsePersonalCollectionRows(parseXlsxDocument(await file.arrayBuffer()), requestedType);
  return readCsvRows(file, requestedType);
}

export async function POST(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file"); const requestedType = form.get("type") === "ARTIFACT" ? "ARTIFACT" : "BOOK";
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ message: "请上传不超过 5 MB 的 Excel 或 CSV 文件。" }, { status: 400 });
  try {
    const rows = await readImportRows(file, requestedType);
    if (!rows.length) return Response.json({ message: "文件中没有可导入的记录，请至少保留一行数据。" }, { status: 400 });
    const created = [];
    for (const row of rows) created.push(await createPersonalItem(user.id, row));
    return Response.json({ created: created.length }, { status: 201 });
  }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "批量导入失败。" }, { status: 400 }); }
}
