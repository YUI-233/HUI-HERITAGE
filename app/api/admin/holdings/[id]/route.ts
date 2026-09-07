import { requirePermission } from "../../../../../lib/admin-access";
import { deleteAdminHoldingDraft } from "../../../../../lib/admin-holdings";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, "HOLDING_WRITE");
  if (denied) return denied;
  try {
    await deleteAdminHoldingDraft((await params).id);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "删除失败。" }, { status: 400 });
  }
}
