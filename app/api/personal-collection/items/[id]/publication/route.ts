import { getSignedInUser } from "../../../../../../lib/local-auth";
import { setPersonalItemPublic, submitPersonalItem, withdrawPersonalItem } from "../../../../../../lib/personal-collection";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSignedInUser(request); if (!user) throw new Error("请先登录。");
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { action?: unknown };
    if (body.action === "APPLY_PUBLIC") return Response.json(await submitPersonalItem(user.id, id));
    if (body.action === "WITHDRAW") return Response.json(await withdrawPersonalItem(user.id, id));
    if (body.action === "SET_PRIVATE") return Response.json(await setPersonalItemPublic(user.id, id, false));
    throw new Error("请选择申请公开或撤回操作。");
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "操作未完成。" }, { status: 400 }); }
}
