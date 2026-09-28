/**
 * Issue #3「收藏馆部分全部接口」契约验证。
 *
 * 直接验证 lib 业务层（路由层只是薄封装，返回结构一致），原因：
 *  - 本地注册接口依赖 RESEND_API_KEY（未配置时恒 503），无法走「注册 → 登录」；
 *  - 本环境 Turbopack(cpus:1) + 慢盘下单个路由首次编译可达十余分钟，HTTP 全量验证不可行。
 * 因此这里用 Prisma 建测试数据并直接调用领域函数，覆盖全部 11 条接口的业务语义与错误码。
 *
 * 用法：npm run collection-api:verify
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  getOrCreateProfile,
  updateProfile,
  listCoverOptions,
  listPublicCollections,
  getPublicCollectionBySlug,
  searchPublicCollectionItems,
} from "../lib/personal-collection-profile";
import {
  listConversations,
  getConversationDetail,
  startConversation,
  replyToConversation,
  markConversationRead,
} from "../lib/messages";

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

/** 捕获业务异常的 HTTP 状态码，便于断言错误语义。 */
async function statusOf(fn: () => Promise<unknown>): Promise<number> {
  try {
    await fn();
    return 200;
  } catch (error) {
    const status = (error as { status?: number }).status;
    return typeof status === "number" ? status : 500;
  }
}

const suffix = randomBytes(4).toString("hex");
const createdUserIds: string[] = [];

async function makeUser(displayName: string, tag: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `verify-${tag}-${suffix}@huiheritage.local`,
      displayName,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function makeItem(
  ownerId: string,
  data: {
    type: "BOOK" | "ARTIFACT";
    title: string;
    creator?: string;
    era?: string;
    categories?: string[];
    editionOrCategory?: string;
    serialNumber: string;
    isPublic: boolean;
    status: "APPROVED" | "DRAFT";
    mediaVisibility?: "PUBLIC" | "PRIVATE";
  },
): Promise<string> {
  const item = await prisma.personalCollectionItem.create({
    data: {
      ownerId,
      type: data.type,
      title: data.title,
      creator: data.creator ?? null,
      era: data.era ?? null,
      categories: data.categories ?? [],
      editionOrCategory: data.editionOrCategory ?? null,
      serialNumber: data.serialNumber,
      isPublic: data.isPublic,
      status: data.status,
    },
    select: { id: true },
  });
  if (data.mediaVisibility) {
    await prisma.mediaAsset.create({
      data: {
        storageKey: `verify/${suffix}/${item.id}`,
        mimeType: "image/png",
        visibility: data.mediaVisibility,
        personalCollectionItemId: item.id,
        uploadedById: ownerId,
      },
    });
  }
  return item.id;
}

async function cleanup(): Promise<void> {
  if (!createdUserIds.length) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  console.log(`\n已清理 ${createdUserIds.length} 个测试用户及其关联数据。`);
}

async function main(): Promise<void> {
  console.log("Issue #3 收藏馆接口契约验证（lib 业务层）\n");

  const ownerA = await makeUser("藏友甲", "a");
  const ownerB = await makeUser("藏友乙", "b");
  const outsider = await makeUser("路人丙", "c");

  // A：2 本公开书 + 1 件公开文物 + 1 件私有草稿
  const bookPublic = await makeItem(ownerA, {
    type: "BOOK",
    title: "清真指南",
    creator: "马注",
    era: "清",
    categories: ["伊斯兰思想、哲学"],
    editionOrCategory: "木刻本",
    serialNumber: `PC-${suffix}-0001`,
    isPublic: true,
    status: "APPROVED",
    mediaVisibility: "PUBLIC",
  });
  await makeItem(ownerA, {
    type: "BOOK",
    title: "天方典礼",
    creator: "刘智",
    era: "清",
    categories: ["伊斯兰教法"],
    serialNumber: `PC-${suffix}-0002`,
    isPublic: true,
    status: "APPROVED",
    mediaVisibility: "PUBLIC",
  });
  await makeItem(ownerA, {
    type: "ARTIFACT",
    title: "青花阿拉伯文碗",
    era: "明",
    categories: ["陶瓷"],
    serialNumber: `PC-${suffix}-0003`,
    isPublic: true,
    status: "APPROVED",
    mediaVisibility: "PUBLIC",
  });
  await makeItem(ownerA, {
    type: "BOOK",
    title: "私密手稿",
    creator: "佚名",
    serialNumber: `PC-${suffix}-0004`,
    isPublic: false,
    status: "DRAFT",
    mediaVisibility: "PRIVATE",
  });
  // B：1 件公开文物（使其可被联系）
  await makeItem(ownerB, {
    type: "ARTIFACT",
    title: "铜香炉",
    era: "清",
    categories: ["金属器"],
    serialNumber: `PC-${suffix}-0005`,
    isPublic: true,
    status: "APPROVED",
    mediaVisibility: "PUBLIC",
  });

  // ---------- PP-01 / PP-02 / PP-03 ----------
  console.log("PP 收藏馆资料设置");
  const profileA = await getOrCreateProfile(ownerA);
  const slugA = profileA.slug;
  check("PP-01 返回资料与 slug", slugA.length > 0, slugA);
  check("PP-01 slug 避开保留字 items", slugA !== "items", slugA);

  const coverOptions = await listCoverOptions(ownerA);
  check("PP-02 返回可选封面", coverOptions.length >= 1, coverOptions.length);
  check(
    "PP-02 封面 URL 指向公开图片接口",
    coverOptions.every((o) => o.url.startsWith("/api/personal-collection/public/")),
    coverOptions[0]?.url,
  );
  const coverMediaId = coverOptions[0]?.mediaId ?? "";

  const updated = await updateProfile(ownerA, {
    displayName: "岩境書舍",
    description: "收藏清代至民国时期的汉文回教古籍。",
    coverMediaId,
  });
  check("PP-03 保存名称与简介", updated.displayName === "岩境書舍" && updated.description?.startsWith("收藏清代") === true, updated);
  check("PP-03 封面已生效", updated.cover?.mediaId === coverMediaId, updated.cover);
  check("PP-03 slug 保持不变", updated.slug === slugA, updated.slug);

  check("PP-03 名称过短 -> 400", (await statusOf(() => updateProfile(ownerA, { displayName: "短" }))) === 400);
  check(
    "PP-03 简介超长 -> 400",
    (await statusOf(() => updateProfile(ownerA, { displayName: "岩境書舍", description: "x".repeat(301) }))) === 400,
  );
  check(
    "PP-03 使用他人图片 -> 403/409",
    [403, 409].includes(await statusOf(() => updateProfile(ownerA, { displayName: "岩境書舍", coverMediaId: "not-a-real-media" }))),
  );

  const profileB = await getOrCreateProfile(ownerB);
  const slugB = profileB.slug;

  // ---------- PC-01 / PC-02 ----------
  console.log("\nPC 公开收藏馆目录与馆页");
  const directory = await listPublicCollections({ q: "", page: 1, limit: 12 });
  check("PC-01 目录含 A 的收藏馆", directory.items.some((c) => c.name === "岩境書舍"), directory.items.map((c) => c.name));
  check("PC-01 分页字段完整", ["page", "limit", "total", "totalPages"].every((k) => k in directory.pagination), directory.pagination);
  check("PC-01 无公开内容者不进目录", !directory.items.some((c) => c.ownerName === "路人丙"), directory.items.map((c) => c.ownerName));

  const collection = await getPublicCollectionBySlug(slugA, { q: "", page: 1, limit: 24 });
  check("PC-02 馆页返回资料", collection?.collection.name === "岩境書舍", collection?.collection);
  check("PC-02 collection 含 cover", collection ? "cover" in collection.collection : false, collection?.collection);
  check("PC-02 仅返回公开内容（3 件）", collection?.items.length === 3, collection?.items.length);
  check(
    "PC-02 items 封面含 itemId/mediaId/url",
    (collection?.items ?? []).every((it) => it.cover && it.cover.itemId && it.cover.mediaId && it.cover.url),
    collection?.items[0]?.cover,
  );
  check("PC-02 不存在的 slug -> null（路由 404）", (await getPublicCollectionBySlug("no-such-collection-xyz", { q: "", page: 1, limit: 24 })) === null);

  // ---------- PS-01 跨馆检索 ----------
  console.log("\nPS-01 跨收藏馆公开检索");
  const all = await searchPublicCollectionItems({ q: "", page: 1, limit: 48 });
  check("PS-01 不含私有/草稿内容", !all.items.some((i) => i.title === "私密手稿"), all.items.map((i) => i.title));
  check(
    "PS-01 跨馆命中 A 与 B 的内容",
    all.items.some((i) => i.title === "清真指南") && all.items.some((i) => i.title === "铜香炉"),
    all.items.length,
  );
  check(
    "PS-01 每条含 collection 摘要",
    all.items.every((i) => i.collection.slug && i.collection.name && "ownerName" in i.collection),
    all.items[0]?.collection,
  );
  check("PS-01 按题名检索", (await searchPublicCollectionItems({ q: "清真", page: 1, limit: 48 })).items.length === 1);
  check(
    "PS-01 按分类检索（数组字段）",
    (await searchPublicCollectionItems({ q: "伊斯兰思想", page: 1, limit: 48 })).items.length >= 1,
  );
  check("PS-01 按版本检索", (await searchPublicCollectionItems({ q: "木刻本", page: 1, limit: 48 })).items.length === 1);
  check("PS-01 按收藏编号检索", (await searchPublicCollectionItems({ q: `PC-${suffix}-0001`, page: 1, limit: 48 })).items.length === 1);
  check("PS-01 按收藏馆名检索", (await searchPublicCollectionItems({ q: "岩境書舍", page: 1, limit: 48 })).items.length === 3);
  check("PS-01 按藏友名检索", (await searchPublicCollectionItems({ q: "藏友乙", page: 1, limit: 48 })).items.length === 1);

  const artifacts = await searchPublicCollectionItems({ q: "", type: "ARTIFACT", page: 1, limit: 48 });
  check("PS-01 按类型筛选", artifacts.items.length === 2 && artifacts.items.every((i) => i.type === "ARTIFACT"), artifacts.items.map((i) => i.type));

  const empty = await searchPublicCollectionItems({ q: "不存在的关键词zzz", page: 1, limit: 48 });
  check("PS-01 空结果 total=0", empty.pagination.total === 0, empty.pagination);
  check("PS-01 空结果 totalPages=0", empty.pagination.totalPages === 0, empty.pagination);
  check("PS-01 分页 limit 生效", (await searchPublicCollectionItems({ q: "", page: 1, limit: 2 })).items.length === 2);

  // ---------- MSG-01 ~ MSG-05 ----------
  console.log("\nMSG 藏友私信");
  check(
    "MSG-03 给自己发信 -> 409",
    (await statusOf(() => startConversation(ownerA, { recipientCollectionSlug: slugA, body: "给自己" }))) === 409,
  );
  check(
    "MSG-03 空消息 -> 400",
    (await statusOf(() => startConversation(ownerA, { recipientCollectionSlug: slugB, body: "   " }))) === 400,
  );
  check(
    "MSG-03 超长消息 -> 400",
    (await statusOf(() => startConversation(ownerA, { recipientCollectionSlug: slugB, body: "x".repeat(1001) }))) === 400,
  );
  check(
    "MSG-03 收藏馆不存在 -> 404",
    (await statusOf(() => startConversation(ownerA, { recipientCollectionSlug: "no-such-collection-xyz", body: "你好" }))) === 404,
  );

  const started = await startConversation(ownerA, { recipientCollectionSlug: slugB, body: "想请教这册书的版本信息。" });
  check("MSG-03 发起私信返回会话详情", started.messages.length === 1, started.messages);
  check("MSG-03 participant 含收藏馆 slug", started.participant.collectionSlug === slugB, started.participant);
  check("MSG-03 不泄漏对方用户 ID", !JSON.stringify(started).includes(ownerB), "响应含真实用户 ID");
  check("MSG-03 不泄漏邮箱", !JSON.stringify(started).includes("@"), "响应含邮箱");
  const conversationId = started.id;

  const listB = await listConversations(ownerB, 1, 50);
  check("MSG-01 B 的会话列表出现会话", listB.items.length === 1, listB.items.length);
  check("MSG-01 未读数为 1", listB.items[0]?.unreadCount === 1, listB.items[0]);
  check("MSG-01 lastMessage.sender = OTHER", listB.items[0]?.lastMessage?.sender === "OTHER", listB.items[0]?.lastMessage);

  check(
    "MSG-02 非参与者读取 -> 404",
    (await statusOf(() => getConversationDetail(outsider, conversationId))) === 404,
  );

  const detailB = await getConversationDetail(ownerB, conversationId);
  check("MSG-02 参与者可读取详情", detailB.messages.length === 1, detailB.messages.length);
  check("MSG-02 消息 sender 相对 B 为 OTHER", detailB.messages[0]?.sender === "OTHER", detailB.messages[0]);

  const readResult = await markConversationRead(ownerB, conversationId);
  check("MSG-05 标记已读返回 unreadCount 0", readResult.unreadCount === 0, readResult);
  const listBAfterRead = await listConversations(ownerB, 1, 50);
  check("MSG-05 已读后未读数清零", listBAfterRead.items[0]?.unreadCount === 0, listBAfterRead.items[0]);

  const replied = await replyToConversation(ownerB, conversationId, "谢谢您的关注。");
  check("MSG-04 回复后消息数为 2", replied.messages.length === 2, replied.messages.length);
  check("MSG-04 己方消息 sender = SELF", replied.messages[1]?.sender === "SELF", replied.messages[1]);
  check(
    "MSG-04 非参与者回复 -> 404",
    (await statusOf(() => replyToConversation(outsider, conversationId, "越权"))) === 404,
  );

  const listA = await listConversations(ownerA, 1, 50);
  check("MSG-01 A 侧未读数为 1", listA.items[0]?.unreadCount === 1, listA.items[0]);
  check("MSG-01 A 侧最后消息 sender = OTHER", listA.items[0]?.lastMessage?.sender === "OTHER", listA.items[0]?.lastMessage);

  const startedAgain = await startConversation(ownerA, { recipientCollectionSlug: slugB, body: "再确认一次。" });
  check("MSG-03 重复发起复用同一会话", startedAgain.id === conversationId, startedAgain.id);
  check("MSG-03 复用后消息累加", startedAgain.messages.length === 3, startedAgain.messages.length);
  const listCount = await listConversations(ownerB, 1, 50);
  check("MSG-01 会话数仍为 1（未重复创建）", listCount.items.length === 1, listCount.items.length);

  check(
    "MSG-05 非参与者标记已读 -> 404",
    (await statusOf(() => markConversationRead(outsider, conversationId))) === 404,
  );

  // ---------- 封面失效回退 ----------
  console.log("\n封面失效清理");
  const before = await getPublicCollectionBySlug(slugA, { q: "", page: 1, limit: 24 });
  check("撤回前馆页有封面", Boolean(before?.collection.cover?.mediaId), before?.collection.cover);

  await prisma.personalCollectionItem.update({ where: { id: bookPublic }, data: { isPublic: false } });
  const after = await getPublicCollectionBySlug(slugA, { q: "", page: 1, limit: 24 });
  const afterCover = after?.collection.cover ?? null;
  check(
    "撤回封面所属内容后封面回退",
    afterCover === null || afterCover.mediaId !== coverMediaId,
    afterCover,
  );

  console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
  if (failures.length) {
    console.log("失败项：");
    for (const item of failures) console.log(`  - ${item}`);
  }
}

main()
  .catch((error) => {
    console.error("验证过程异常：", error);
    failures.push(String(error));
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failures.length ? 1 : 0);
  });
