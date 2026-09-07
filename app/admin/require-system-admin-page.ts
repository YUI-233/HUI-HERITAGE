import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "../../lib/local-auth";

export async function requireSystemAdminPage() {
  const requestHeaders = await headers();
  const viewer = await getSignedInUser(new Request("http://localhost", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
  if (!viewer) redirect("/login");
  if (viewer.role !== "SUPER_ADMIN") redirect("/account");
}
