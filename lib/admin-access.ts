import { hasLocalAdminAccess, localAdminIsConfigured } from "./admin-local";
import { hasUserPermission, isSignedInSystemAdmin, type UserPermission } from "./local-auth";
import { cloudHasPermission, cloudIsSystemAdmin } from "./cloud-identity";
import { usesCloudRuntime } from "./cloud-runtime";

/**
 * The local token remains a bootstrap fallback. Normal staff access is always
 * resolved from the signed-in account and its user group on the server.
 */
export async function requirePermission(request: Request, permission: UserPermission) {
  if (usesCloudRuntime()) return await cloudHasPermission(request, permission) ? null : Response.json({ error: "FORBIDDEN", message: "当前 GPT 正式站账号没有执行此操作的权限。" }, { status: 403 });
  if (hasLocalAdminAccess(request) || await hasUserPermission(request, permission)) return null;
  if (!localAdminIsConfigured()) return Response.json({ error: "ADMIN_SETUP_REQUIRED", message: "请先完成系统 Admin 的本地初始化。" }, { status: 503 });
  return Response.json({ error: "FORBIDDEN", message: "当前账号没有执行此操作的权限。请由 Admin 分配用户组和相应权限。" }, { status: 403 });
}

export async function requireAnyPermission(request: Request, permissions: UserPermission[]) {
  if (usesCloudRuntime()) { for (const permission of permissions) if (await cloudHasPermission(request, permission)) return null; return Response.json({ error: "FORBIDDEN", message: "当前 GPT 正式站账号没有查看此管理内容的权限。" }, { status: 403 }); }
  if (hasLocalAdminAccess(request)) return null;
  for (const permission of permissions) if (await hasUserPermission(request, permission)) return null;
  if (!localAdminIsConfigured()) return Response.json({ error: "ADMIN_SETUP_REQUIRED", message: "请先完成系统 Admin 的本地初始化。" }, { status: 503 });
  return Response.json({ error: "FORBIDDEN", message: "当前账号没有查看此管理内容的权限。请由 Admin 分配用户组和相应权限。" }, { status: 403 });
}

export async function requireSystemAdmin(request: Request) {
  if (usesCloudRuntime()) return await cloudIsSystemAdmin(request) ? null : Response.json({ error: "FORBIDDEN", message: "此操作仅限 GPT 正式站系统 Admin。" }, { status: 403 });
  if (hasLocalAdminAccess(request) || await isSignedInSystemAdmin(request)) return null;
  if (!localAdminIsConfigured()) return Response.json({ error: "ADMIN_SETUP_REQUIRED", message: "请先完成系统 Admin 的本地初始化。" }, { status: 503 });
  return Response.json({ error: "FORBIDDEN", message: "此操作仅限系统 Admin。" }, { status: 403 });
}
