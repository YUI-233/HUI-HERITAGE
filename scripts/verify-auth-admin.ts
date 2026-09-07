import assert from "node:assert/strict";
import { POST as login } from "../app/api/auth/login/route";
import { POST as register } from "../app/api/auth/register/route";
import { GET, POST as manageUsers } from "../app/api/admin/users/route";
import { GET as getCatalog } from "../app/api/admin/catalog/route";
import { GET as getHoldings } from "../app/api/admin/holdings/route";
import { GET as getResearch } from "../app/api/admin/research/route";
import { prisma } from "../lib/prisma";

process.env.ADMIN_LOCAL_TOKEN = "auth-verification-admin-token";
process.env.SUPER_ADMIN_EMAIL = "system-admin-auth-verification@huiheritage.local";
const email = "auth-verification@huiheritage.local";
const systemAdminEmail = process.env.SUPER_ADMIN_EMAIL;
const groupName = "账号体系验收组";
const headers = { "content-type": "application/json", "x-admin-local-token": process.env.ADMIN_LOCAL_TOKEN };

async function main() {
  const existingAdminBefore = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.userGroup.deleteMany({ where: { name: groupName } });
  try {
    const groupResponse = await manageUsers(new Request("http://localhost/api/admin/users", { method: "POST", headers, body: JSON.stringify({ action: "createGroup", name: groupName, permissions: ["CATALOG_WRITE"] }) }));
    assert.equal(groupResponse.status, 201);
    const group = await groupResponse.json() as { id: string };
    const userResponse = await register(new Request("http://localhost/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, displayName: "账号验收用户", password: "verification-password" }) }));
    assert.equal(userResponse.status, 201);
    const createdUser = await userResponse.json() as { id: string };
    const assignmentResponse = await manageUsers(new Request("http://localhost/api/admin/users", { method: "POST", headers, body: JSON.stringify({ action: "assignGroupByEmail", email, groupId: group.id }) }));
    assert.equal(assignmentResponse.status, 200);

    const invalidLogin = await login(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "incorrect" }) }));
    assert.equal(invalidLogin.status, 401);
    const loginResponse = await login(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "verification-password" }) }));
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie");
    assert.ok(cookie?.includes("HttpOnly"));
    const accountHeaders = { cookie: cookie!.split(";")[0] };
    const permittedCatalog = await getCatalog(new Request("http://localhost/api/admin/catalog", { headers: accountHeaders }));
    assert.equal(permittedCatalog.status, 200);
    const deniedHoldings = await getHoldings(new Request("http://localhost/api/admin/holdings", { headers: accountHeaders }));
    assert.equal(deniedHoldings.status, 403);
    const deniedResearch = await getResearch(new Request("http://localhost/api/admin/research", { headers: accountHeaders }));
    assert.equal(deniedResearch.status, 403);
    const anonymousCatalog = await getCatalog(new Request("http://localhost/api/admin/catalog"));
    assert.equal(anonymousCatalog.status, 403);
    const rejectedList = await GET(new Request("http://localhost/api/admin/users", { headers: { cookie: cookie!.split(";")[0] } }));
    assert.equal(rejectedList.status, 401);
    const listResponse = await GET(new Request("http://localhost/api/admin/users", { headers: { "x-admin-local-token": process.env.ADMIN_LOCAL_TOKEN! } }));
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json() as { groups: Array<{ id: string }> };
    assert.ok(listed.groups.some((item) => item.id === group.id));
    const assigned = await prisma.user.findUnique({ where: { id: createdUser.id }, select: { groupId: true } });
    assert.equal(assigned?.groupId, group.id);
    if (!existingAdminBefore) {
      const systemAdmin = await prisma.user.findUnique({ where: { email: systemAdminEmail } });
      assert.equal(systemAdmin?.role, "SUPER_ADMIN");
    }
    console.log("系统 Admin 自动创建、用户自行注册、用户组分配及后台权限拦截均已验证。");
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    if (!existingAdminBefore) await prisma.user.deleteMany({ where: { email: systemAdminEmail } });
    await prisma.userGroup.deleteMany({ where: { name: groupName } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
