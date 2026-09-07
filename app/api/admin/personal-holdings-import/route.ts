import { requirePermission } from "../../../../lib/admin-access";
import { importPersonalHoldingsCsv } from "../../../../lib/personal-holdings-import";

export async function POST(request: Request) {
  const denied = await requirePermission(request, "PERSONAL_COLLECTION"); if (denied) return denied;
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024 || !/\.csv$/i.test(file.name)) return Response.json({ message: "请上传不超过 1 MB 的 CSV 文件。" }, { status: 400 });
  try { return Response.json(await importPersonalHoldingsCsv(await file.text()), { status: 201 }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "导入失败。" }, { status: 400 }); }
}
