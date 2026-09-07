import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const defaultDailyLimit = 5;
const chinaUtcOffset = 8 * 60 * 60 * 1000;
const accessCache = new Map<string, number>();

function borrowingDay(now = new Date()) {
  const shifted = new Date(now.getTime() + chinaUtcOffset);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function policyFor(user: { role: string; group: { dailyBorrowLimitEnabled: boolean } | null }) {
  if (user.role === "SUPER_ADMIN") return { limited: false, limit: null as number | null };
  if (!user.group) return { limited: true, limit: defaultDailyLimit };
  return user.group.dailyBorrowLimitEnabled ? { limited: true, limit: defaultDailyLimit } : { limited: false, limit: null };
}

function cardNumber() {
  return `HH-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function getBorrowingSummary(userId: string) {
  const day = borrowingDay();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      displayName: true,
      emailVerifiedAt: true,
      group: { select: { dailyBorrowLimitEnabled: true } },
      borrowingCard: true,
    },
  });
  if (!user) return null;
  const policy = policyFor(user);
  const records = await prisma.borrowingRecord.findMany({ where: { userId, borrowedOn: day }, include: { book: { select: { id: true, title: true } } }, orderBy: { borrowedAt: "asc" } });
  return {
    card: user.borrowingCard,
    holderName: user.displayName || "HUI HERITAGE 用户",
    emailVerified: Boolean(user.emailVerifiedAt),
    exempt: user.role === "SUPER_ADMIN",
    limited: policy.limited,
    limit: policy.limit,
    borrowedToday: records.length,
    remaining: policy.limit === null ? null : Math.max(0, policy.limit - records.length),
    records: records.map((record) => ({ id: record.id, bookId: record.book.id, title: record.book.title, borrowedAt: record.borrowedAt })),
  };
}

export async function issueBorrowingCard(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, displayName: true, emailVerifiedAt: true, group: { select: { dailyBorrowLimitEnabled: true } }, borrowingCard: true } });
  if (!user) return { ok: false as const, code: "USER_NOT_FOUND", message: "未找到当前账号。" };
  if (!user.emailVerifiedAt) return { ok: false as const, code: "VERIFY_REQUIRED", message: "请先完成邮箱验证后办理借阅证。" };
  const card = user.borrowingCard ?? await prisma.borrowingCard.create({ data: { userId, cardNumber: cardNumber() } });
  const policy = policyFor(user);
  return { ok: true as const, card, holderName: user.displayName || "HUI HERITAGE 用户", limited: policy.limited, limit: policy.limit };
}

export async function checkoutBook(userId: string, bookId: string) {
  const day = borrowingDay();
  const [user, book] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, emailVerifiedAt: true, group: { select: { dailyBorrowLimitEnabled: true } }, borrowingCard: { select: { id: true, status: true } } } }),
    prisma.book.findFirst({ where: { id: bookId, status: "APPROVED", media: { some: { visibility: "MEMBER_ONLY", mimeType: "application/pdf" } } }, select: { id: true, title: true } }),
  ]);
  if (!user) return { ok: false as const, code: "USER_NOT_FOUND", message: "未找到当前账号。" };
  if (!book) return { ok: false as const, code: "BOOK_NOT_FOUND", message: "未找到可借阅的古籍文件。" };
  if (user.role === "SUPER_ADMIN") return { ok: true as const, alreadyBorrowed: true, limited: false, limit: null, remaining: null };
  if (!user.emailVerifiedAt) return { ok: false as const, code: "VERIFY_REQUIRED", message: "请先完成邮箱验证后借阅古籍。" };
  if (!user.borrowingCard || user.borrowingCard.status !== "ACTIVE") return { ok: false as const, code: "CARD_REQUIRED", message: "请先一键办理借阅证。" };
  const existing = await prisma.borrowingRecord.findUnique({ where: { userId_bookId_borrowedOn: { userId, bookId, borrowedOn: day } } });
  const policy = policyFor(user);
  if (existing) {
    accessCache.set(`${userId}:${bookId}:${day.toISOString()}`, Date.now() + 5 * 60 * 1000);
    const count = policy.limit === null ? 0 : await prisma.borrowingRecord.count({ where: { userId, borrowedOn: day } });
    return { ok: true as const, alreadyBorrowed: true, limited: policy.limited, limit: policy.limit, remaining: policy.limit === null ? null : Math.max(0, policy.limit - count) };
  }
  const count = await prisma.borrowingRecord.count({ where: { userId, borrowedOn: day } });
  if (policy.limit !== null && count >= policy.limit) return { ok: false as const, code: "LIMIT_REACHED", message: `今日借阅额度已用完（每日${policy.limit}本），明日将自动恢复。`, limit: policy.limit, remaining: 0 };
  await prisma.borrowingRecord.create({ data: { userId, bookId, borrowedOn: day } });
  accessCache.set(`${userId}:${bookId}:${day.toISOString()}`, Date.now() + 5 * 60 * 1000);
  return { ok: true as const, alreadyBorrowed: false, limited: policy.limited, limit: policy.limit, remaining: policy.limit === null ? null : Math.max(0, policy.limit - count - 1) };
}

export async function canReadBorrowedBook(userId: string, bookId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "SUPER_ADMIN") return true;
  const day = borrowingDay();
  const key = `${userId}:${bookId}:${day.toISOString()}`;
  const cachedUntil = accessCache.get(key) ?? 0;
  if (cachedUntil > Date.now()) return true;
  const record = await prisma.borrowingRecord.findUnique({ where: { userId_bookId_borrowedOn: { userId, bookId, borrowedOn: day } }, select: { id: true } });
  if (record) accessCache.set(key, Date.now() + 5 * 60 * 1000);
  return Boolean(record);
}
