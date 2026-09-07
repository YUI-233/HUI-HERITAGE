import { prisma } from "../lib/prisma";
import { canReadBorrowedBook, checkoutBook, getBorrowingSummary, issueBorrowingCard } from "../lib/borrowing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const marker = `borrowing-verify-${Date.now()}`;
let userId: string | null = null;
let groupId: string | null = null;

try {
  const books = await prisma.book.findMany({
    where: { status: "APPROVED", media: { some: { visibility: "MEMBER_ONLY", mimeType: "application/pdf" } } },
    select: { id: true },
    take: 2,
  });
  assert(books.length === 2, "借阅验证至少需要两本带会员 PDF 的已审核古籍。");

  const group = await prisma.userGroup.create({
    data: { name: marker, dailyBorrowLimitEnabled: true, dailyBorrowLimit: 5 },
  });
  groupId = group.id;
  const user = await prisma.user.create({
    data: { email: `${marker}@huiheritage.local`, displayName: "借阅验证用户", emailVerifiedAt: new Date(), groupId: group.id },
  });
  userId = user.id;

  const beforeCard = await checkoutBook(user.id, books[0].id);
  assert(!beforeCard.ok && beforeCard.code === "CARD_REQUIRED", "未办理借阅证时必须阻止借阅。");
  assert(!(await canReadBorrowedBook(user.id, books[0].id)), "未借阅的古籍文件不能直接访问。");

  const issued = await issueBorrowingCard(user.id);
  assert(issued.ok, "已验证用户应能一键办理借阅证。");

  const first = await checkoutBook(user.id, books[0].id);
  assert(first.ok && first.remaining === 4, "首次借阅应占用每日五本额度之一。");
  assert(await canReadBorrowedBook(user.id, books[0].id), "完成借阅后应获得当天阅读权限。");
  const duplicate = await checkoutBook(user.id, books[0].id);
  assert(duplicate.ok && duplicate.alreadyBorrowed, "当天重复打开同一本书不应重复计数。");
  await prisma.userGroup.update({ where: { id: group.id }, data: { dailyBorrowLimitEnabled: false } });
  const unlimited = await checkoutBook(user.id, books[1].id);
  assert(unlimited.ok && unlimited.limited === false, "取消用户组每日上限后应立即允许继续借阅。");
  const summary = await getBorrowingSummary(user.id);
  assert(summary?.borrowedToday === 2 && summary.limited === false, "账号中心借阅摘要应反映当天两本借阅及不限额状态。");

  console.log("借阅证验证通过：一键办理、当日去重、用户组限额、不限额与账号摘要均正常。");
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  if (groupId) await prisma.userGroup.delete({ where: { id: groupId } }).catch(() => undefined);
  await prisma.$disconnect();
}
