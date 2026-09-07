import { hasLocalAdminAccess, localAdminIsConfigured } from "../../../../lib/admin-local";
import { getSignedInUser } from "../../../../lib/local-auth";
import { assignRegisteredUserToGroup, createUserGroup, listUserGroups, saveUser, updateUserGroup } from "../../../../lib/user-admin";

async function permitted(request: Request) {
  const user = await getSignedInUser(request);
  return hasLocalAdminAccess(request) || user?.role === "SUPER_ADMIN";
}

export async function GET(request: Request) {
  if (!localAdminIsConfigured() && !(await permitted(request))) return Response.json({ message: "请先完成本地管理员设置。" }, { status: 503 });
  if (!(await permitted(request))) return Response.json({ message: "仅官方 Admin 可管理账号、用户组与权限。" }, { status: 401 });
  return Response.json({ groups: await listUserGroups() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await permitted(request))) return Response.json({ message: "仅官方 Admin 可管理账号、用户组与权限。" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return Response.json({ message: "请求内容不完整。" }, { status: 400 });
  try {
    if (body.action === "createGroup") {
      const group = await createUserGroup({ name: String(body.name ?? ""), description: typeof body.description === "string" ? body.description : undefined, permissions: Array.isArray(body.permissions) ? body.permissions.filter((item): item is string => typeof item === "string") : [], dailyBorrowLimitEnabled: body.dailyBorrowLimitEnabled !== false });
      return Response.json(group, { status: 201 });
    }
    if (body.action === "updateGroup") {
      if (typeof body.id !== "string") return Response.json({ message: "缺少用户组编号。" }, { status: 400 });
      const group = await updateUserGroup({ id: body.id, name: String(body.name ?? ""), description: typeof body.description === "string" ? body.description : undefined, permissions: Array.isArray(body.permissions) ? body.permissions.filter((item): item is string => typeof item === "string") : [], dailyBorrowLimitEnabled: body.dailyBorrowLimitEnabled !== false });
      return Response.json(group);
    }
    if (body.action === "assignGroupByEmail") {
      const result = await assignRegisteredUserToGroup({ email: String(body.email ?? ""), groupId: typeof body.groupId === "string" && body.groupId ? body.groupId : null });
      return Response.json(result);
    }
    if (body.action === "saveUser") {
      if (typeof body.id !== "string") return Response.json({ message: "普通账号请从前台注册；此处仅用于审核、分组与授权。" }, { status: 400 });
      const user = await saveUser({
        id: body.id,
        email: String(body.email ?? ""),
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        password: typeof body.password === "string" ? body.password : undefined,
        role: body.role === "MEMBER" || body.role === "COLLECTOR" || body.role === "SUPER_ADMIN" ? body.role : undefined,
        groupId: typeof body.groupId === "string" && body.groupId ? body.groupId : null,
        isActive: body.isActive !== false,
      });
      return Response.json({ id: user.id }, { status: body.id ? 200 : 201 });
    }
    return Response.json({ message: "不支持的账号管理操作。" }, { status: 400 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "保存失败。" }, { status: 400 });
  }
}
