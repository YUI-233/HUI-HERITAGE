import { createHash, randomBytes } from "node:crypto";
import { hashPassword, validatePassword } from "./local-auth";
import { prisma } from "./prisma";

export const emailPurposes = {
  verification: "EMAIL_VERIFICATION",
  passwordReset: "PASSWORD_RESET",
} as const;

type EmailPurpose = (typeof emailPurposes)[keyof typeof emailPurposes];

const actionLifetimeMs: Record<EmailPurpose, number> = {
  [emailPurposes.verification]: 1000 * 60 * 60 * 24,
  [emailPurposes.passwordReset]: 1000 * 60 * 30,
};
const maxRequestsPerWindow = 3;
const requestWindowMs = 1000 * 60 * 15;

function emailFrom() {
  return process.env.EMAIL_FROM?.trim() || "";
}

function applicationUrl() {
  const value = process.env.APP_BASE_URL?.trim() || "http://localhost:3014";
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("APP_BASE_URL 必须是完整的网站地址。");
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && emailFrom());
}

async function sendEmail(input: { to: string; subject: string; text: string; actionUrl: string; actionLabel: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !emailFrom()) throw new Error("邮件服务尚未配置，请联系系统管理员。");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom(), to: [input.to], subject: input.subject, text: input.text,
      html: `<main style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,'Noto Serif SC',serif;color:#2c2925"><h1 style="font-size:24px">HUI HERITAGE</h1><p>${escapeHtml(input.text.split("\n\n")[0])}</p><p><a href="${input.actionUrl}" style="display:inline-block;padding:12px 20px;background:#b3332e;color:#fff;text-decoration:none">${escapeHtml(input.actionLabel)}</a></p><p style="color:#6d6258;font-size:13px;word-break:break-all">如无法点击按钮，请复制此链接：${escapeHtml(input.actionUrl)}</p></main>`,
    }),
  });
  if (!response.ok) throw new Error("验证邮件暂时无法发送，请稍后重试。");
}

async function issueToken(userId: string, purpose: EmailPurpose) {
  const since = new Date(Date.now() - requestWindowMs);
  const recentCount = await prisma.emailActionToken.count({ where: { userId, purpose, createdAt: { gte: since } } });
  if (recentCount >= maxRequestsPerWindow) throw new Error("请求过于频繁，请 15 分钟后再试。");
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.emailActionToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.emailActionToken.create({ data: { userId, purpose, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + actionLifetimeMs[purpose]) } }),
  ]);
  return token;
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, emailPurposes.verification);
  const actionUrl = `${applicationUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, subject: "请验证你的 HUI HERITAGE 邮箱", actionUrl, actionLabel: "验证邮箱", text: `请点击下方链接验证邮箱。链接将在 24 小时后失效。\n\n${actionUrl}` });
}

export async function verifyEmailToken(token: string) {
  const record = await prisma.emailActionToken.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!record || record.purpose !== emailPurposes.verification || record.expiresAt < new Date()) throw new Error("验证链接无效或已过期，请重新发送验证邮件。");
  if (record.usedAt && record.user.emailVerifiedAt) return { email: record.user.email, alreadyVerified: true };
  if (record.usedAt) throw new Error("验证链接已使用，请重新发送验证邮件。");
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { isActive: true, emailVerifiedAt: new Date() } }),
    prisma.emailActionToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.emailActionToken.deleteMany({ where: { userId: record.userId, purpose: emailPurposes.verification, id: { not: record.id } } }),
  ]);
  return { email: record.user.email, alreadyVerified: false };
}

export async function sendPasswordResetEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, emailVerifiedAt: true } });
  if (!user?.isActive || !user.emailVerifiedAt) return;
  const token = await issueToken(user.id, emailPurposes.passwordReset);
  const actionUrl = `${applicationUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, subject: "重置你的 HUI HERITAGE 密码", actionUrl, actionLabel: "重置密码", text: `我们收到重置密码的请求。请点击下方链接设置新密码；链接将在 30 分钟后失效。若不是你本人操作，请忽略此邮件。\n\n${actionUrl}` });
}

export async function resetPasswordWithToken(token: string, password: string) {
  const record = await prisma.emailActionToken.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: { select: { email: true } } } });
  if (!record || record.purpose !== emailPurposes.passwordReset || record.usedAt || record.expiresAt < new Date()) throw new Error("重置链接无效或已过期，请重新申请。 ");
  const passwordError = validatePassword(password, record.user.email);
  if (passwordError) throw new Error(passwordError);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } }),
    prisma.emailActionToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.emailActionToken.deleteMany({ where: { userId: record.userId, purpose: emailPurposes.passwordReset, id: { not: record.id } } }),
  ]);
}
