import { prisma } from "./prisma";
import { usesCloudRuntime } from "./cloud-runtime";

type NotificationInput = { kind: string; title: string; message: string; href?: string };

export async function notifyUsers(userIds: string[], notification: NotificationInput) {
  const recipients = [...new Set(userIds.filter(Boolean))];
  if (!recipients.length) return { count: 0 };
  return prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, ...notification })),
  });
}

export async function publicationReviewers() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPER_ADMIN" },
        { group: { permissions: { has: "CATALOG_REVIEW" } } },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function holdingReviewers(excludeUserId?: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPER_ADMIN" },
        { group: { permissions: { has: "HOLDING_REVIEW" } } },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id).filter((id) => id !== excludeUserId);
}

export async function researchReviewers(excludeUserId?: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { group: { permissions: { has: "RESEARCH_REVIEW" } } }] },
    select: { id: true },
  });
  return users.map((user) => user.id).filter((id) => id !== excludeUserId);
}

export async function listNotifications(userId: string) {
  if (usesCloudRuntime()) return { notifications: [], unreadCount: 0 };
  const notifications = await prisma.notification.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 30,
    select: { id: true, kind: true, title: true, message: true, href: true, isRead: true, createdAt: true },
  });
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
  return { notifications, unreadCount };
}

export async function markNotificationsRead(userId: string) {
  if (usesCloudRuntime()) return;
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
