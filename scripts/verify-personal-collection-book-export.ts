import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { BookExportError, exportPublicCollectionBooks } from "../lib/personal-collection-book-export";
import { parseXlsxDocument } from "../lib/xlsx";

const suffix = randomBytes(5).toString("hex");
const createdUserIds: string[] = [];

async function makeUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: "book-export-" + label + "-" + suffix + "@huiheritage.local",
      displayName: "导出验证" + label,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function expectExportError(run: () => Promise<unknown>, status: number, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof BookExportError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

async function main() {
  const ownerId = await makeUser("owner");
  const borrowerId = await makeUser("active");
  const inactiveBorrowerId = await makeUser("inactive");
  const noCardUserId = await makeUser("nocard");
  const emptyOwnerId = await makeUser("empty");
  const slug = "export-test-" + suffix;
  const emptySlug = "export-empty-" + suffix;

  await prisma.personalCollectionProfile.create({
    data: { ownerId, slug, displayName: "导出测试收藏馆", publicCollectorName: "公开藏友名" },
  });
  await prisma.personalCollectionProfile.create({
    data: { ownerId: emptyOwnerId, slug: emptySlug, displayName: "暂无公开书籍" },
  });
  await prisma.borrowingCard.create({
    data: { userId: borrowerId, cardNumber: "HH-TEST-A-" + suffix, status: "ACTIVE" },
  });
  await prisma.borrowingCard.create({
    data: { userId: inactiveBorrowerId, cardNumber: "HH-TEST-I-" + suffix, status: "SUSPENDED" },
  });

  const addItem = (input: {
    ownerId: string;
    serialNumber: string;
    title: string;
    status: "APPROVED" | "DRAFT";
    isPublic: boolean;
    price?: string;
  }) => prisma.personalCollectionItem.create({
    data: {
      ownerId: input.ownerId,
      type: "BOOK",
      serialNumber: input.serialNumber,
      title: input.title,
      creator: "测试作者",
      era: "清",
      eraDetail: "光绪二十年",
      publicationDate: "1894",
      imprintPublisher: "测试书坊",
      editionOrCategory: "木刻本",
      binding: "线装",
      categories: ["测试分类"],
      volumeCount: 2,
      description: "公开说明",
      price: input.price,
      status: input.status,
      isPublic: input.isPublic,
    },
  });

  await addItem({ ownerId, serialNumber: "EX-" + suffix + "-1", title: "公开书甲", status: "APPROVED", isPublic: true, price: "机密价格" });
  await addItem({ ownerId, serialNumber: "EX-" + suffix + "-2", title: "公开书乙", status: "APPROVED", isPublic: true });
  await addItem({ ownerId, serialNumber: "EX-" + suffix + "-3", title: "私有书", status: "APPROVED", isPublic: false });
  await addItem({ ownerId, serialNumber: "EX-" + suffix + "-4", title: "待审书", status: "DRAFT", isPublic: false });
  await addItem({ ownerId: emptyOwnerId, serialNumber: "EX-" + suffix + "-5", title: "仅私有", status: "APPROVED", isPublic: false });

  const result = await exportPublicCollectionBooks(borrowerId, slug);
  assert.equal(result.bookCount, 2);
  assert.equal(result.collectionName, "导出测试收藏馆");
  const workbook = parseXlsxDocument(result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength) as ArrayBuffer);
  assert.equal(workbook.length, 3);
  assert.equal(workbook[0][0], "编号");
  assert.equal(workbook[1][1], "公开书甲");
  assert.equal(workbook[2][1], "公开书乙");
  const exportedText = JSON.stringify(workbook);
  assert.equal(exportedText.includes("私有书"), false);
  assert.equal(exportedText.includes("待审书"), false);
  assert.equal(exportedText.includes("仅私有"), false);
  assert.equal(exportedText.includes("机密价格"), false);
  assert.equal(exportedText.includes("@huiheritage.local"), false);

  await expectExportError(() => exportPublicCollectionBooks(borrowerId, "missing-" + suffix), 404, "COLLECTION_NOT_FOUND");
  await expectExportError(() => exportPublicCollectionBooks(borrowerId, emptySlug), 404, "NO_PUBLIC_BOOKS");
  await expectExportError(() => exportPublicCollectionBooks(noCardUserId, slug), 403, "CARD_REQUIRED");
  await expectExportError(() => exportPublicCollectionBooks(inactiveBorrowerId, slug), 403, "CARD_INACTIVE");
  await expectExportError(() => exportPublicCollectionBooks(ownerId, slug), 403, "OWN_COLLECTION_EXPORT_NOT_ALLOWED");

  console.log("书单导出验证通过：XLSX 可解析、只包含公开已审核书籍、敏感字段已排除，权限拒绝场景均通过。");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
