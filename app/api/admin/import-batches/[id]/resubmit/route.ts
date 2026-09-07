import { hasLocalAdminAccess, localAdminIsConfigured } from "../../../../../../lib/admin-local";
import { signedInWorkflowActor } from "../../../../../../lib/local-auth";
import { resubmitImportBatch } from "../../../../../../lib/import-review-workflow";
import { isOfficialImportFile, readOfficialImportFile } from "../../../../../../lib/official-import-file";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const form = await request.formData(); const file = form.get("file");
  if (!isOfficialImportFile(file)) return Response.json({ message: "请上传不超过 5 MB 的 Excel 或 CSV 文件。" }, { status: 400 });
  try { const actor = await signedInWorkflowActor(request, "HOLDING_WRITE"); if (!actor && !localAdminIsConfigured()) return Response.json({ message: "请先设置 ADMIN_LOCAL_TOKEN。" }, { status: 503 }); if (!actor && !hasLocalAdminAccess(request)) return Response.json({ message: "本地管理员口令无效。" }, { status: 401 }); return Response.json(await resubmitImportBatch((await params).id, undefined, await readOfficialImportFile(file), actor?.userId)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "重新提交失败。" }, { status: 400 }); }
}
