import { getSignedInUser } from "../../../../lib/local-auth";
import { seedPersonalArtifactExamples } from "../../../../lib/personal-artifact-examples";

export async function POST(request: Request) {
  try { const user = await getSignedInUser(request); if (!user) throw new Error("请先登录。"); const body = await request.json().catch(() => ({})) as { force?: boolean }; return Response.json(await seedPersonalArtifactExamples(user.id, body.force === true)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法加入示例素材。" }, { status: 400 }); }
}
