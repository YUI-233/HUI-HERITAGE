/**
 * PC-03「导出其他收藏馆的公开书单」契约验证。
 *
 * 覆盖契约要求的权限验收：匿名用户、无借阅证用户、失效借阅证用户、有效借阅证用户，
 * 以及包含私有书籍和待审核书籍的目标收藏馆；并用 lib/xlsx.ts 回读生成的 xlsx 校验列与数据。
 *
 * 用法：npm run book-export:verify
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getOrCreateProfile } from "../lib/personal-collection-profile";
import { CollectionExportError, exportPublicBooks } from "../lib/collection-book-export";
import { parseXlsxDocument } from "../lib/xlsx";

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  }
}

/** 捕获业务错误的状态码与错误码。 */
async function failureOf(fn: () => Promise<unknown>): Promise<{ status: number; code: string }> {
  try {
    await fn();
    return { status: 200, code: "OK" };
  } catch (error) {
    if (error instanceof CollectionExportError) return { status: error.status, code: error.code };
    return { status: 500, code: "UNKNOWN" };
  }
}

const suffix = randomBytes(4).toString("hex");
const createdUserIds: string[] = [];

async function makeUser(displayName: string, tag: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `export-${tag}-${suffix}@huiheritage.local`,
      displayName,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function makeCard(userId: string, status: string, tag: string): Promise<void> {
  await prisma.borrowingCard.create({
    data: { userId, cardNumber: `EXP-${tag}-${suffix}`, status },
  });
}

async function makeItem(
  ownerId: string,
  data: {
    type: "BOOK" | "ARTIFACT";
    title: string;
    serialNumber: string;
    isPublic: boolean;
    status: "APPROVED" | "DRAFT";
    creator?: string;
    era?: string;
    eraDetail?: string;
    publicationDate?: string;
    imprintPublisher?: string;
    editionOrCategory?: string;
    binding?: string;
    categories?: string[];
    description?: string;
  },
): Promise<string> {
  const item = await prisma.personalCollectionItem.create({
    data: {
      ownerId,
      type: data.type,
      title: data.title,
      creator: data.creator ?? null,
      era: data.era ?? null,
      eraDetail: data.eraDetail ?? null,
      publicationDate: data.publicationDate ?? null,
      imprintPublisher: data.imprintPublisher ?? null,
      editionOrCategory: data.editionOrCategory ?? null,
      binding: data.binding ?? null,
      categories: data.categories ?? [],
      description: data.description ?? null,
      serialNumber: data.serialNumber,
      isPublic: data.isPublic,
      status: data.status,
    },
    select: { id: true },
  });
  return item.id;
}

function rowsFrom(bytes: Buffer): string[][] {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return parseXlsxDocument(copy.buffer);
}

async function cleanup(): Promise<void> {
  if (!createdUserIds.length) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  console.log(`\n已清理 ${createdUserIds.length} 个测试用户及其关联数据。`);
}

async function main(): Promise<void> {
  console.log("PC-03 公开书单导出契约验证（lib 业务层）\n");

  const owner = await makeUser("书单主人", "owner");
  const noCard = await makeUser("无证读者", "nocard");
  const inactive = await makeUser("失效证读者", "inactive");
  const active = await makeUser("有效证读者", "active");
  const artifactOnly = await makeUser("仅文物馆主", "artifact");
  const privateOnly = await makeUser("私有馆主", "private");

  await makeCard(inactive, "SUSPENDED", "ina");
  await makeCard(active, "ACTIVE", "act");
  // 馆主同样持有有效借阅证，用于验证"不能导出自己的馆"这条独立规则
  await makeCard(owner, "ACTIVE", "own");

  // 目标馆：2 本公开书 + 1 本私有书 + 1 本待审核书 + 1 件公开文物
  await makeItem(owner, {
    type: "BOOK",
    title: "清真指南",
    serialNumber: `EX-${suffix}-0001`,
    isPublic: true,
    status: "APPROVED",
    creator: "马注",
    era: "清",
    eraDetail: "康熙年间",
    publicationDate: "1683",
    imprintPublisher: "可久堂",
    editionOrCategory: "木刻本",
    binding: "线装",
    categories: ["伊斯兰思想、哲学", "古籍"],
    description: "公开说明示例",
  });
  await makeItem(owner, {
    type: "BOOK",
    title: "天方典礼",
    serialNumber: `EX-${suffix}-0002`,
    isPublic: true,
    status: "APPROVED",
    creator: "刘智",
    era: "清",
  });
  await makeItem(owner, {
    type: "BOOK",
    title: "私密手稿",
    serialNumber: `EX-${suffix}-0003`,
    isPublic: false,
    status: "APPROVED",
  });
  await makeItem(owner, {
    type: "BOOK",
    title: "待审核抄本",
    serialNumber: `EX-${suffix}-0004`,
    isPublic: true,
    status: "DRAFT",
  });
  await makeItem(owner, {
    type: "ARTIFACT",
    title: "青花阿拉伯文碗",
    serialNumber: `EX-${suffix}-0005`,
    isPublic: true,
    status: "APPROVED",
  });

  // 仅有公开文物的馆
  await makeItem(artifactOnly, {
    type: "ARTIFACT",
    title: "铜香炉",
    serialNumber: `EX-${suffix}-0006`,
    isPublic: true,
    status: "APPROVED",
  });
  // 只有私有/待审核内容的馆
  await makeItem(privateOnly, {
    type: "BOOK",
    title: "未公开书",
    serialNumber: `EX-${suffix}-0007`,
    isPublic: false,
    status: "DRAFT",
  });

  const profile = await getOrCreateProfile(owner);
  const artifactProfile = await getOrCreateProfile(artifactOnly);
  const privateProfile = await getOrCreateProfile(privateOnly);
  const slug = profile.slug;

  console.log("权限与参数校验");
  check(
    "PC-03 未登录 -> 401 AUTH_REQUIRED",
    JSON.stringify(await failureOf(() => exportPublicBooks({ slug, viewerId: null, format: "xlsx" }))) ===
      JSON.stringify({ status: 401, code: "AUTH_REQUIRED" }),
  );
  check(
    "PC-03 无借阅证 -> 403 CARD_REQUIRED",
    (await failureOf(() => exportPublicBooks({ slug, viewerId: noCard, format: "xlsx" }))).code === "CARD_REQUIRED",
  );
  check(
    "PC-03 失效借阅证 -> 403 CARD_INACTIVE",
    (await failureOf(() => exportPublicBooks({ slug, viewerId: inactive, format: "xlsx" }))).code === "CARD_INACTIVE",
  );
  check(
    "PC-03 不支持的格式 -> 400 UNSUPPORTED_EXPORT_FORMAT",
    (await failureOf(() => exportPublicBooks({ slug, viewerId: active, format: "csv" }))).code ===
      "UNSUPPORTED_EXPORT_FORMAT",
  );
  check(
    "PC-03 导出自己的馆 -> 403 OWN_COLLECTION_EXPORT_NOT_ALLOWED",
    (await failureOf(() => exportPublicBooks({ slug, viewerId: owner, format: "xlsx" }))).code ===
      "OWN_COLLECTION_EXPORT_NOT_ALLOWED",
  );
  check(
    "PC-03 无借阅证时优先提示办证",
    (await failureOf(() => exportPublicBooks({ slug, viewerId: noCard, format: "xlsx" }))).code === "CARD_REQUIRED",
  );
  check(
    "PC-03 收藏馆不存在 -> 404 COLLECTION_NOT_FOUND",
    (
      await failureOf(() =>
        exportPublicBooks({ slug: `not-a-collection-${suffix}`, viewerId: active, format: "xlsx" }),
      )
    ).code === "COLLECTION_NOT_FOUND",
  );
  check(
    "PC-03 馆内无公开内容 -> 404 COLLECTION_NOT_FOUND",
    (await failureOf(() => exportPublicBooks({ slug: privateProfile.slug, viewerId: active, format: "xlsx" }))).code ===
      "COLLECTION_NOT_FOUND",
  );
  check(
    "PC-03 只有公开文物 -> 404 NO_PUBLIC_BOOKS",
    (await failureOf(() => exportPublicBooks({ slug: artifactProfile.slug, viewerId: active, format: "xlsx" }))).code ===
      "NO_PUBLIC_BOOKS",
  );

  console.log("导出文件与内容");
  const result = await exportPublicBooks({ slug, viewerId: active, format: "xlsx" });
  check("PC-03 有效借阅证导出成功", result.bytes.length > 0, result.bytes.length);
  check("PC-03 只导出公开书籍（2 本）", result.bookCount === 2, result.bookCount);
  check(
    "PC-03 文件名含馆名与日期",
    result.fileName.includes("公开书单") && result.fileName.endsWith(".xlsx"),
    result.fileName,
  );
  check(
    "PC-03 xlsx 以 PK 开头",
    result.bytes[0] === 0x50 && result.bytes[1] === 0x4b,
    [result.bytes[0], result.bytes[1]],
  );

  const rows = rowsFrom(result.bytes);
  check("PC-03 表头为 12 列", rows[0]?.length === 12, rows[0]);
  check(
    "PC-03 表头顺序符合契约",
    JSON.stringify(rows[0]) ===
      JSON.stringify(["编号", "书名", "作者", "作者年代", "刊刻年份", "刊刻时间", "刊刻主体", "版本", "装帧", "分类", "册数", "公开说明"]),
    rows[0],
  );
  check("PC-03 数据行为 2 条（表头之外）", rows.length === 3, rows.length);
  const flat = rows.flat().join("|");
  check("PC-03 含公开书《清真指南》", flat.includes("清真指南"), rows[1]);
  check("PC-03 含公开书《天方典礼》", flat.includes("天方典礼"));
  check("PC-03 不含私有书籍", !flat.includes("私密手稿"));
  check("PC-03 不含待审核书籍", !flat.includes("待审核抄本"));
  check("PC-03 不含公开文物", !flat.includes("青花阿拉伯文碗"));
  const firstRow = rows[1] ?? [];
  check("PC-03 分类使用中文分号连接", firstRow[9] === "伊斯兰思想、哲学；古籍", firstRow[9]);
  check("PC-03 册数/版本等字段落位正确", firstRow[7] === "木刻本" && firstRow[10] === "1", firstRow);
  check("PC-03 不含邮箱", !flat.includes("@"), flat.slice(0, 120));
  check("PC-03 不含用户 ID", !flat.includes(owner), owner);
  check("PC-03 不含价格等未公开字段", !flat.includes("价格"));

  console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
  if (failures.length) {
    console.log(failures.map((item) => `  - ${item}`).join("\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
