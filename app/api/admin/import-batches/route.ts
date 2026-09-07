import { hasLocalAdminAccess, localAdminIsConfigured } from "../../../../lib/admin-local";
import { canViewWorkflow, signedInWorkflowActor } from "../../../../lib/local-auth";
import { createImportBatch, listImportBatches } from "../../../../lib/import-review-workflow";
import { isOfficialImportFile, readOfficialImportFile } from "../../../../lib/official-import-file";

const guard = (request: Request) => !localAdminIsConfigured() ? Response.json({ message: "请先设置 ADMIN_LOCAL_TOKEN。" }, { status: 503 }) : !hasLocalAdminAccess(request) ? Response.json({ message: "本地管理员口令无效。" }, { status: 401 }) : null;
export async function GET(request: Request) { if (!(await canViewWorkflow(request))) { const denied = guard(request); if (denied) return denied; } return Response.json(await listImportBatches(), { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) { const form = await request.formData(); const file = form.get("file"); if (!isOfficialImportFile(file)) return Response.json({ message: "请上传不超过 5 MB 的 Excel 或 CSV 文件。" }, { status: 400 }); try { const actor = await signedInWorkflowActor(request, "HOLDING_WRITE"); const denied = actor ? null : guard(request); if (denied) return denied; return Response.json(await createImportBatch(undefined, await readOfficialImportFile(file), actor?.userId), { status: 201 }); } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "提交审核失败。" }, { status: 400 }); } }
