import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "./prisma";
import { getCloudIdentity } from "./cloud-identity";
import { usesCloudRuntime } from "./cloud-runtime";

const scrypt = promisify(scryptCallback);
const sessionCookie = "huiheritage_session";
const sessionLifetimeSeconds = 60 * 60 * 12;
export const passwordPolicy = { minimumLength: 12, maximumLength: 128 } as const;
const commonPasswords = new Set([
  "123456789012", "1234567890", "password", "password123", "password1234", "qwertyuiop", "qwerty123", "letmein", "welcome", "admin", "iloveyou", "abc123456", "changeme",
]);

type SessionPayload = { userId: string; issuedAt: number; expiresAt: number };

function secret() {
  const value = process.env.AUTH_SESSION_SECRET ?? process.env.ADMIN_LOCAL_TOKEN;
  if (!value) throw new Error("缺少本地登录会话密钥。");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

/** Length-first password policy. Character classes are deliberately optional. */
export function validatePassword(password: string, email?: string) {
  if (password.length < passwordPolicy.minimumLength) return `登录密码至少需要 ${passwordPolicy.minimumLength} 个字符。`;
  if (password.length > passwordPolicy.maximumLength) return `登录密码不能超过 ${passwordPolicy.maximumLength} 个字符。`;
  const normalized = password.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  if (commonPasswords.has(normalized)) return "该密码过于常见，请使用更长且独特的密码。";
  const emailLocalPart = email?.split("@")[0]?.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "huiheritage" || (emailLocalPart && normalized === emailLocalPart)) return "密码不能直接使用网站名称或邮箱名称。";
  return null;
}

export async function verifyPassword(password: string, stored: string) {
  const [method, salt, encoded] = stored.split("$");
  if (method !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const derived = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createSessionCookie(userId: string) {
  const issuedAt = Date.now();
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt, expiresAt: issuedAt + sessionLifetimeSeconds * 1000 } satisfies SessionPayload)).toString("base64url");
  return `${sessionCookie}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}`;
}

export function clearSessionCookie() {
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string) {
  const found = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return found?.slice(name.length + 1);
}

export async function getSignedInUser(request: Request) {
  if (usesCloudRuntime()) {
    let cloudRequest = request;
    if (!request.headers.get("oai-authenticated-user-id")) {
      const { headers } = await import("next/headers");
      cloudRequest = new Request(request.url, { headers: new Headers(await headers()) });
    }
    const user = await getCloudIdentity(cloudRequest);
    return user ? { ...user, isActive: true as const, group: { name: "GPT 正式站授权", permissions: user.permissions } } : null;
  }
  const value = readCookie(request, sessionCookie);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || signature.length !== sign(payload).length || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  let parsed: SessionPayload;
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!parsed.userId || !parsed.issuedAt || parsed.expiresAt < Date.now()) return null;
  return prisma.user.findUnique({ where: { id: parsed.userId }, include: { group: true } }).then((user) => user?.isActive && (!user.passwordChangedAt || user.passwordChangedAt.getTime() <= parsed.issuedAt) ? user : null);
}

export const permissionCatalog = [
  ["RESEARCH_WRITE", "编辑研究资料"],
  ["RESEARCH_REVIEW", "审核研究资料"],
  ["CATEGORY_MANAGE", "管理分类与审核申请"],
  ["CATALOG_WRITE", "录入古籍／文物"],
  ["CATALOG_REVIEW", "审核古籍／文物"],
  ["HOLDING_WRITE", "录入馆藏信息"],
  ["HOLDING_REVIEW", "审核馆藏信息"],
  ["PERSONAL_COLLECTION", "开通及管理个人收藏馆"],
  ["USER_MANAGE", "管理用户与用户组"],
] as const;

export type UserPermission = (typeof permissionCatalog)[number][0];

export function userPermissions(user: Awaited<ReturnType<typeof getSignedInUser>>) {
  if (!user) return [];
  if (user.role === "SUPER_ADMIN") return permissionCatalog.map(([code]) => code);
  return user.group?.permissions ?? [];
}

/** Server-side authorization for a signed-in user group. */
export async function hasUserPermission(request: Request, permission: UserPermission) {
  const user = await getSignedInUser(request);
  return Boolean(user && userPermissions(user).includes(permission));
}

export async function isSignedInSystemAdmin(request: Request) {
  const user = await getSignedInUser(request);
  return user?.role === "SUPER_ADMIN";
}

export async function canManageUsers(request: Request) {
  const user = await getSignedInUser(request);
  return Boolean(user && userPermissions(user).includes("USER_MANAGE"));
}

export async function signedInWorkflowActor(request: Request, permission: "HOLDING_WRITE" | "HOLDING_REVIEW") {
  const user = await getSignedInUser(request);
  if (!user) return null;
  if (!userPermissions(user).includes(permission)) throw new Error(permission === "HOLDING_WRITE" ? "当前账号没有提交机构／海外馆藏资料的权限。" : "当前账号没有审核机构／海外馆藏资料的权限。");
  return { userId: user.id };
}

export async function signedInCatalogWorkflowActor(request: Request, permission: "CATALOG_WRITE" | "CATALOG_REVIEW") {
  const user = await getSignedInUser(request);
  if (!user) return null;
  if (!userPermissions(user).includes(permission)) throw new Error(permission === "CATALOG_WRITE" ? "当前账号没有提交古籍／文物资料的权限。" : "当前账号没有审核古籍／文物资料的权限。");
  return { userId: user.id };
}

export async function canViewWorkflow(request: Request) {
  const user = await getSignedInUser(request);
  if (!user) return false;
  const permissions = userPermissions(user);
  return permissions.includes("HOLDING_WRITE") || permissions.includes("HOLDING_REVIEW");
}
