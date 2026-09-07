import { UserRole } from "@prisma/client";
import { hashPassword, permissionCatalog, validatePassword } from "./local-auth";
import { notifyUsers } from "./notifications";
import { prisma } from "./prisma";

export const roles: UserRole[] = ["MEMBER", "COLLECTOR", "SUPER_ADMIN"];

export async function ensureSystemAdmin() {
  const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (existing) return existing;
  const password = process.env.ADMIN_LOCAL_TOKEN;
  if (!password) throw new Error("系统尚未设置本地管理员口令，暂不能创建 Admin 账号。");
  const email = (process.env.SUPER_ADMIN_EMAIL || "admin@huiheritage.local").trim().toLocaleLowerCase();
  return prisma.user.create({ data: { email, displayName: "系统 Admin", passwordHash: await hashPassword(password), role: "SUPER_ADMIN", isActive: true, emailVerifiedAt: new Date() } });
}

export async function registerPublicUser(input: { email: string; displayName?: string; password: string }) {
  return saveUser({ email: input.email, displayName: input.displayName, password: input.password, role: "MEMBER", isActive: false });
}

export async function listUsersAndGroups() {
  const [groups, users] = await Promise.all([
    prisma.userGroup.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({ include: { group: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return { groups, users: users.map(({ passwordHash: _passwordHash, ...user }) => user) };
}

export async function listUserGroups() {
  return prisma.userGroup.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
}

type UserGroupInput = {
  name: string;
  description?: string;
  permissions?: string[];
  dailyBorrowLimitEnabled?: boolean;
};

function borrowingLimitData(input: UserGroupInput) {
  return {
    dailyBorrowLimitEnabled: input.dailyBorrowLimitEnabled !== false,
    dailyBorrowLimit: 5,
  };
}

export async function createUserGroup(input: UserGroupInput) {
  const name = input.name.trim();
  if (!name) throw new Error("用户组名称不能为空。");
  return prisma.userGroup.create({ data: { name, description: input.description?.trim() || null, permissions: [...new Set(input.permissions ?? [])], ...borrowingLimitData(input) } });
}

export async function updateUserGroup(input: UserGroupInput & { id: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("用户组名称不能为空。");
  const group = await prisma.userGroup.findUnique({ where: { id: input.id }, select: { id: true, isSystem: true } });
  if (!group) throw new Error("未找到该用户组。");
  // 系统 Admin 仍天然具备全权限；这里允许维护系统用户组，供其他成员继承权限。
  return prisma.userGroup.update({ where: { id: input.id }, data: { name, description: input.description?.trim() || null, permissions: [...new Set(input.permissions ?? [])], ...borrowingLimitData(input) } });
}

export async function assignRegisteredUserToGroup(input: { email: string; groupId?: string | null }) {
  const email = input.email.trim().toLocaleLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("请输入已注册账号的有效邮箱地址。");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, displayName: true, email: true, groupId: true } });
  if (!user) throw new Error("未找到该邮箱对应的已注册账号，请确认邮箱或先完成注册。");
  if (user.role === "SUPER_ADMIN") throw new Error("系统 Admin 已具备全部权限，无需分配用户组。");
  let group: { id: string; name: string; permissions: string[] } | null = null;
  if (input.groupId) {
    group = await prisma.userGroup.findUnique({ where: { id: input.groupId }, select: { id: true, name: true, permissions: true } });
    if (!group) throw new Error("所选用户组不存在，请刷新后重试。");
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { groupId: input.groupId || null }, include: { group: true } });
  if (user.groupId !== (input.groupId || null)) {
    const names = new Map(permissionCatalog);
    const permissionText = group?.permissions.map((permission) => names.get(permission as typeof permissionCatalog[number][0]) ?? permission).join("、") || "暂未授予功能权限";
    await notifyUsers([updated.id], {
      kind: "ACCOUNT_AUTHORIZATION",
      title: group ? "账号授权已生效" : "用户组授权已撤销",
      message: group ? `你已加入“${group.name}”用户组；可使用：${permissionText}。` : "你的用户组授权已被取消，如有疑问请联系系统 Admin。",
      href: "/account",
    });
  }
  return { email: updated.email, displayName: updated.displayName, groupName: updated.group?.name ?? null };
}

export async function saveUser(input: { id?: string; email: string; displayName?: string; password?: string; role?: UserRole; groupId?: string | null; isActive?: boolean }) {
  const email = input.email.trim().toLocaleLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("请输入有效的邮箱地址。");
  if (input.password !== undefined && input.password.length > 0) {
    const passwordError = validatePassword(input.password, email);
    if (passwordError) throw new Error(passwordError);
  }
  if (!input.id && !input.password) throw new Error("新建账号时必须设置登录密码。");
  const role = roles.includes(input.role ?? "MEMBER") ? input.role ?? "MEMBER" : "MEMBER" as UserRole;
  if (role === "SUPER_ADMIN") {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", ...(input.id ? { id: { not: input.id } } : {}) }, select: { id: true } });
    if (existingAdmin) throw new Error("系统仅允许一个官方 Admin 账号。");
  }
  if (input.id) {
    const current = await prisma.user.findUnique({ where: { id: input.id }, select: { role: true } });
    if (current?.role === "SUPER_ADMIN" && input.isActive === false) throw new Error("官方 Admin 账号不能被停用。");
  }
  const data = {
    email,
    displayName: input.displayName?.trim() || null,
    role,
    groupId: input.groupId || null,
    isActive: input.isActive ?? true,
    ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
  };
  return input.id ? prisma.user.update({ where: { id: input.id }, data }) : prisma.user.create({ data });
}
