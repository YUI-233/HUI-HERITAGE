import { requireAnyPermission, requirePermission } from "../../../../lib/admin-access";
import { listAdminCatalog, listMyAdminCatalogDrafts, notifyCatalogSubmission, parseAdminCatalogInput, saveAdminCatalog } from "../../../../lib/admin-catalog";
import { signedInCatalogWorkflowActor } from "../../../../lib/local-auth";

const guard = (request: Request) => requirePermission(request, "CATALOG_WRITE");

export async function GET(request: Request) {
  const denied = await requireAnyPermission(request, ["CATALOG_WRITE", "CATALOG_REVIEW"]); if (denied) return denied;
  const url = new URL(request.url);
  if (url.searchParams.get("drafts") === "1") {
    const actor = await signedInCatalogWorkflowActor(request, "CATALOG_WRITE");
    if (!actor) return Response.json({ message: "请使用拥有录入权限的登录账号查看草稿箱。" }, { status: 403 });
    return Response.json(await listMyAdminCatalogDrafts(actor.userId), { headers: { "Cache-Control": "no-store" } });
  }
  const type = url.searchParams.get("type");
  return Response.json(await listAdminCatalog(type === "manuscript" || type === "artifact" ? type : undefined, url.searchParams.get("withMedia") === "1"), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await guard(request); if (denied) return denied;
  const input = parseAdminCatalogInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "INVALID_RECORD", message: "请填写资料类型与题名。" }, { status: 400 });
  try {
    const submitter = await signedInCatalogWorkflowActor(request, "CATALOG_WRITE");
    if (!submitter) return Response.json({ error: "SIGNED_IN_SUBMISSION_REQUIRED", message: "保存草稿或提交审核必须使用拥有录入权限的登录账号。" }, { status: 403 });
    if (input.status && !["DRAFT", "PENDING"].includes(input.status)) return Response.json({ error: "REVIEW_REQUIRED", message: "录入账号只能保存草稿或提交审核；公开、退回与补充状态须由其他审核用户处理。" }, { status: 403 });
    const saved = await saveAdminCatalog(input, submitter);
    if (saved.submittedForReview) await notifyCatalogSubmission(saved, submitter.userId);
    return Response.json(saved, { status: input.id ? 200 : 201 });
  } catch (error) { return Response.json({ error: "CATALOG_SUBMISSION_FAILED", message: error instanceof Error ? error.message : "提交资料失败。" }, { status: 400 }); }
}
