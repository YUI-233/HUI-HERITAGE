import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser, userPermissions, type UserPermission } from "../../lib/local-auth";

export async function requirePermissionPage(permission: UserPermission) {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  if (!userPermissions(viewer).includes(permission)) redirect("/account");
}

export async function requireSystemAdminPage() {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  if (viewer.role !== "SUPER_ADMIN") redirect("/account");
}
