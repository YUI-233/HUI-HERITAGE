import { requirePermission } from "../../../../../../lib/admin-access";
import { canViewWorkflow } from "../../../../../../lib/local-auth";
import { getImportBatchAuditReport } from "../../../../../../lib/import-review-workflow";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canViewWorkflow(request))) { const denied = await requirePermission(request, "HOLDING_WRITE"); if (denied) return denied; }
  try { const id = (await params).id; return new Response(await getImportBatchAuditReport(id), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="import-batch-${id}-audit.csv"`, "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "导出失败。" }, { status: 404 }); }
}
