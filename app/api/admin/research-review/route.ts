import { requirePermission } from "../../../../lib/admin-access";
import { listResearchRequestsForReview, reviewResearchRequest } from "../../../../lib/admin-research";
import { getSignedInUser } from "../../../../lib/local-auth";

export async function GET(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_REVIEW"); if (denied) return denied;
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  return Response.json(await listResearchRequestsForReview(user.id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_REVIEW"); if (denied) return denied;
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; decision?: unknown; comment?: unknown } | null;
  if (!body || typeof body.id !== "string" || (body.decision !== "APPROVED" && body.decision !== "REJECTED" && body.decision !== "NEEDS_REVISION")) return Response.json({ message: "请提供申请编号与审核结论。" }, { status: 400 });
  try { return Response.json(await reviewResearchRequest(body.id, body.decision, typeof body.comment === "string" ? body.comment : undefined, user.id)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "审核失败。" }, { status: 400 }); }
}
