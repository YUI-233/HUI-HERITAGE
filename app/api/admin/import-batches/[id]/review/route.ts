import { hasLocalAdminAccess, localAdminIsConfigured } from "../../../../../../lib/admin-local";
import { signedInWorkflowActor } from "../../../../../../lib/local-auth";
import { reviewImportBatch, reviewImportBatchRecord } from "../../../../../../lib/import-review-workflow";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null) as { rowIndex?: unknown; decision?: unknown; comment?: unknown } | null;
  try {
    const actor = await signedInWorkflowActor(request, "HOLDING_REVIEW");
    if (!actor && !localAdminIsConfigured()) return Response.json({ message: "请先设置 ADMIN_LOCAL_TOKEN。" }, { status: 503 });
    if (!actor && !hasLocalAdminAccess(request)) return Response.json({ message: "本地管理员口令无效。" }, { status: 401 });
    const id = (await params).id;
    if (body?.rowIndex === undefined || body?.rowIndex === null) return Response.json(await reviewImportBatch(id, null, body?.decision, body?.comment, actor?.userId));
    return Response.json(await reviewImportBatchRecord(id, body?.rowIndex, body?.decision, body?.comment, actor?.userId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "审核失败。" }, { status: 400 });
  }
}
