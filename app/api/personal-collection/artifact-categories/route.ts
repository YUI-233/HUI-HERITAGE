import { getSignedInUser } from "../../../../lib/local-auth";
import { addPersonalArtifactCategory, listPersonalArtifactCategories } from "../../../../lib/personal-artifact-categories";

async function userFor(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) throw new Error("请先登录。");
  return user;
}

export async function GET(request: Request) {
  try { const user = await userFor(request); return Response.json(await listPersonalArtifactCategories(user.id)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法读取藏品类别。" }, { status: 401 }); }
}

export async function POST(request: Request) {
  try { const user = await userFor(request); const body = await request.json() as { name?: unknown }; return Response.json(await addPersonalArtifactCategory(user.id, body.name)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法创建藏品类别。" }, { status: 400 }); }
}
