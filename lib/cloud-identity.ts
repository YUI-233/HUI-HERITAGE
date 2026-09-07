import { cloudD1, usesCloudRuntime } from "./cloud-runtime";

export type CloudRole = "MEMBER" | "COLLECTOR" | "SUPER_ADMIN";
export type CloudIdentity = { id: string; email: string; displayName: string | null; role: CloudRole; permissions: string[] };

type UserRow = { id: string; email: string; display_name: string | null; role: CloudRole };

function trustedDisplayName(request: Request) {
  const value = request.headers.get("oai-authenticated-user-full-name");
  if (!value) return null;
  if (request.headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return value;
  try { return decodeURIComponent(value); } catch { return null; }
}

/**
 * Resolves identity only from dispatcher-provided GPT Sites headers. Membership
 * and authorization still come from the server-side D1 allowlist tables.
 */
export async function getCloudIdentity(request: Request): Promise<CloudIdentity | null> {
  if (!usesCloudRuntime()) return null;
  const siteUserId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase();
  if (!siteUserId || !email) return null;

  const db = await cloudD1();
  let users = await db!.prepare("SELECT id, email, display_name, role FROM cloud_users WHERE id = ? AND email = ? AND is_active = 1").bind(siteUserId, email).all<UserRow>();
  if (!(users.results?.length) && process.env.HUI_CLOUD_ADMIN_EMAIL?.trim().toLocaleLowerCase() === email) {
    const existing = await db!.prepare("SELECT id FROM cloud_users LIMIT 1").bind().all<{ id: string }>();
    if (!(existing.results?.length)) {
      const displayName = trustedDisplayName(request);
      const now = new Date().toISOString();
      await db!.prepare("INSERT INTO cloud_users (id, email, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, 'SUPER_ADMIN', 1, ?, ?)").bind(siteUserId, email, displayName, now, now).run();
      users = await db!.prepare("SELECT id, email, display_name, role FROM cloud_users WHERE id = ? AND is_active = 1").bind(siteUserId).all<UserRow>();
    }
  }
  const user = users.results?.[0];
  if (!user) return null;
  const permissions = await db!.prepare("SELECT permission FROM cloud_user_permissions WHERE user_id = ? ORDER BY permission ASC").bind(user.id).all<{ permission: string }>();
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role, permissions: permissions.results?.map((row) => row.permission) ?? [] };
}

export async function cloudHasPermission(request: Request, permission: string) {
  const user = await getCloudIdentity(request);
  return Boolean(user && (user.role === "SUPER_ADMIN" || user.permissions.includes(permission)));
}

export async function cloudIsSystemAdmin(request: Request) {
  return (await getCloudIdentity(request))?.role === "SUPER_ADMIN";
}
