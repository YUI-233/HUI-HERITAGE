import { hashPassword } from "../lib/local-auth";
import { prisma } from "../lib/prisma";

const password = "cdn20070407!";
const now = new Date();

async function main() {
  const passwordHash = await hashPassword(password);
  const existingAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!existingAdmin) throw new Error("数据库中没有 SUPER_ADMIN，无法确定唯一的管理员测试账号。");

  await prisma.user.update({
    where: { id: existingAdmin.id },
    data: { passwordHash, isActive: true, emailVerifiedAt: now, passwordChangedAt: now },
  });

  const accounts = [
    { email: "test-member@huiheritage.local", displayName: "测试普通会员", role: "MEMBER" as const },
    { email: "test-collector@huiheritage.local", displayName: "测试收藏者", role: "COLLECTOR" as const },
  ];
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: { displayName: account.displayName, role: account.role, groupId: null, passwordHash, isActive: true, emailVerifiedAt: now, passwordChangedAt: now },
      create: { ...account, passwordHash, isActive: true, emailVerifiedAt: now },
    });
  }

  console.log(JSON.stringify({
    password,
    accounts: [
      { email: existingAdmin.email, role: existingAdmin.role },
      ...accounts,
    ],
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
