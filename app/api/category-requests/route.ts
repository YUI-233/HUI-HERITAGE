import { requireAnyPermission } from "../../../lib/admin-access";
import { createCategoryRequest, listMyCategoryRequests } from "../../../lib/category-requests";
import { getSignedInUser } from "../../../lib/local-auth";

export async function POST(request: Request) {
  const denied = await requireAnyPermission(request, ["CATALOG_WRITE", "HOLDING_WRITE", "RESEARCH_WRITE"]); if (denied) return denied;
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  try { return Response.json(await createCategoryRequest(await request.json(), user.id), { status: 201 }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "提交失败。" }, { status: 400 }); }
}

export async function GET(request: Request) {
  const denied = await requireAnyPermission(request, ["CATALOG_WRITE", "HOLDING_WRITE", "RESEARCH_WRITE"]); if (denied) return denied;
  const user = await getSignedInUser(request); if (!user) return Response.json({ message: "请先登录。" }, { status: 401 });
  return Response.json(await listMyCategoryRequests(user.id, new URL(request.url).searchParams.get("scope") ?? undefined));
}
