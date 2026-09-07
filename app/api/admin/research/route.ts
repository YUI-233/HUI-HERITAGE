import { requirePermission } from "../../../../lib/admin-access";
import { listApprovedResearchForEditing } from "../../../../lib/admin-research";

export async function GET(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_WRITE"); if (denied) return denied;
  return Response.json(await listApprovedResearchForEditing(), { headers: { "Cache-Control": "no-store" } });
}

/** Compatibility response for older clients; research changes now use review requests. */
export async function POST(_request: Request) {
  return Response.json({ message: "研究资料现已改为先保存草稿并提交审核，请使用研究资料编辑页面。" }, { status: 410 });
}
