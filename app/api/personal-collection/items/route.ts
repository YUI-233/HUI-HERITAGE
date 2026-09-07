import { getSignedInUser } from "../../../../lib/local-auth";
import { createPersonalItem, deletePersonalItem, listPersonalItems, readPersonalItemInput, updatePersonalItem } from "../../../../lib/personal-collection";

async function viewer(request: Request) { const user = await getSignedInUser(request); if (!user) throw new Error("请先登录。"); return user; }

export async function GET(request: Request) {
  try { const user = await viewer(request); return Response.json(await listPersonalItems(user.id), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "无法读取个人收藏。" }, { status: 401 }); }
}

export async function POST(request: Request) {
  const isFormSubmission = request.headers.get("content-type")?.includes("multipart/form-data") || request.headers.get("content-type")?.includes("application/x-www-form-urlencoded");
  try {
    const user = await viewer(request);
    const input = isFormSubmission ? Object.fromEntries((await request.formData()).entries()) : await request.json();
    const item = await createPersonalItem(user.id, readPersonalItemInput(input));
    if (isFormSubmission) return new Response(null, { status: 303, headers: { Location: `/personal-collection?section=${item.type === "BOOK" ? "books" : "artifacts"}` } });
    return Response.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法新增个人收藏。";
    if (isFormSubmission) return new Response(null, { status: 303, headers: { Location: `/personal-collection?section=books&view=create&error=${encodeURIComponent(message)}` } });
    return Response.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await viewer(request);
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("请选择需要保存的书目记录。");
    return Response.json(await updatePersonalItem(user.id, id, readPersonalItemInput(body)));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "无法保存个人收藏。" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await viewer(request);
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const type = body.type === "ARTIFACT" ? "ARTIFACT" : body.type === "BOOK" ? "BOOK" : null;
    if (!id || !type) throw new Error("请选择需要删除的个人收藏记录。");
    return Response.json(await deletePersonalItem(user.id, id, type));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "无法删除个人收藏。" }, { status: 400 });
  }
}
