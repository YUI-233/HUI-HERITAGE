import { requirePermission } from "../../../../lib/admin-access";
import { parseResearchInput, requestResearchDeletion, saveResearchDraft, submitResearchDraft } from "../../../../lib/admin-research";
import { getSignedInUser } from "../../../../lib/local-auth";

export async function POST(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_WRITE"); if (denied) return denied;
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ message: "请求无效。" }, { status: 400 });
  try {
    if (body.action === "SUBMIT") {
      if (typeof body.requestId !== "string" || typeof body.requestReason !== "string" || !body.requestReason.trim()) throw new Error("提交审核前请填写说明。");
      return Response.json(await submitResearchDraft(body.requestId, user.id, body.requestReason.trim()));
    }
    if (body.action === "DELETE") {
      if (typeof body.articleId !== "string" || typeof body.reason !== "string" || !body.reason.trim()) throw new Error("请填写删除理由。");
      return Response.json(await requestResearchDeletion(body.articleId, body.reason.trim(), user.id), { status: 201 });
    }
    const input = parseResearchInput(body); if (!input) throw new Error("请完整填写题名、研究分类和摘要。");
    return Response.json(await saveResearchDraft(input, user.id), { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "保存失败。" }, { status: 400 }); }
}
