import { requirePermission } from "../../../../../lib/admin-access";
import { parseManuscriptCsv } from "../../../../../lib/catalog-csv-import";
import { saveAdminCatalog } from "../../../../../lib/admin-catalog";
import { signedInCatalogWorkflowActor } from "../../../../../lib/local-auth";

async function parseUpload(file: File) {
  const bytes = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  try { return parseManuscriptCsv(utf8); }
  catch (utf8Error) {
    try { return parseManuscriptCsv(new TextDecoder("gb18030").decode(bytes)); }
    catch { throw utf8Error; }
  }
}

export async function POST(request: Request) {
  const denied = await requirePermission(request, "CATALOG_WRITE"); if (denied) return denied;
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !/\.csv$/i.test(file.name) || file.size === 0 || file.size > 2 * 1024 * 1024) return Response.json({ message: "请上传不超过 2 MB 的 CSV 文件。" }, { status: 400 });
  try {
    const actor = await signedInCatalogWorkflowActor(request, "CATALOG_WRITE");
    if (!actor) return Response.json({ message: "请使用已登录的录入账号导入古籍。" }, { status: 403 });
    const rows = await parseUpload(file);
    const created = [];
    for (const row of rows) created.push(await saveAdminCatalog(row, actor));
    return Response.json({ created: created.length, status: "DRAFT" }, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "古籍 CSV 导入失败。" }, { status: 400 }); }
}
