/**
 * Issue #3 接口 HTTP 冒烟（真实路由层）。
 *
 * 前置：另开终端执行 `npm run dev:postgres`（端口 3014）。
 * 用法：npx tsx scripts/smoke-collection-api-http.ts
 *
 * 与 collection-api:verify 的分工：
 *  - verify 覆盖业务语义与错误码（58 项断言，直接调用 lib）；
 *  - 本脚本只确认路由层接线正确：方法名、动态参数、鉴权 cookie、状态码与分页结构。
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- 冒烟脚本需要读取任意结构的响应体 */
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createSessionCookie } from "../lib/local-auth";
import { getOrCreateProfile, updateProfile } from "../lib/personal-collection-profile";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3014";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 240000);

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

function cookieFor(userId: string): string {
  return createSessionCookie(userId).split(";")[0];
}

async function call(
  method: string,
  path: string,
  options: { userId?: string; body?: unknown } = {},
): Promise<{ status: number; json: any; headers: Headers; bytes: Buffer }> {
  const headers: Record<string, string> = {};
  if (options.userId) headers.cookie = cookieFor(options.userId);
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString("utf8");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json, headers: response.headers, bytes };
}

async function makeCard(userId: string, status: string, tag: string): Promise<void> {
  await prisma.borrowingCard.create({ data: { userId, cardNumber: `SM-${tag}-${suffix}`, status } });
}

const suffix = randomBytes(4).toString("hex");
const createdUserIds: string[] = [];

async function makeUser(displayName: string, tag: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `smoke-${tag}-${suffix}@huiheritage.local`,
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
  data: { type: "BOOK" | "ARTIFACT"; title: string; creator?: string; era?: string; categories?: string[]; serialNumber: string },
): Promise<string> {
  const item = await prisma.personalCollectionItem.create({
    data: {
      ownerId,
      type: data.type,
      title: data.title,
      creator: data.creator ?? null,
      era: data.era ?? null,
      categories: data.categories ?? [],
      serialNumber: data.serialNumber,
      isPublic: true,
      status: "APPROVED",
    },
    select: { id: true },
  });
  await prisma.mediaAsset.create({
    data: {
      storageKey: `smoke/${suffix}/${item.id}`,
      mimeType: "image/png",
      visibility: "PUBLIC",
      personalCollectionItemId: item.id,
      uploadedById: ownerId,
    },
  });
  return item.id;
}

async function cleanup(): Promise<void> {
  if (!createdUserIds.length) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  console.log(`\n已清理 ${createdUserIds.length} 个测试用户及其关联数据。`);
}

async function main(): Promise<void> {
  console.log(`Issue #3 接口 HTTP 冒烟 -> ${BASE}\n`);

  const ownerA = await makeUser("冒烟藏友甲", "a");
  const visitorB = await makeUser("冒烟藏友乙", "b");
  const outsider = await makeUser("冒烟路人丙", "c");

  await makeItem(ownerA, {
    type: "BOOK",
    title: "清真指南",
    creator: "马注",
    era: "清",
    categories: ["伊斯兰思想、哲学"],
    serialNumber: `SM-${suffix}-0001`,
  });

  const profileA = await getOrCreateProfile(ownerA);
  await updateProfile(ownerA, { displayName: "岩境書舍", description: "清代汉文回教古籍。" });
  const slugA = profileA.slug;

  // ---------- PS-01 ----------
  console.log("PS-01 跨馆检索");
  const search = await call("GET", `/api/personal-collections/items?q=${encodeURIComponent("清真指南")}`);
  check("PS-01 无需登录即可检索 -> 200", search.status === 200, search.status);
  check("PS-01 命中公开条目", Array.isArray(search.json?.items) && search.json.items.length >= 1, search.json?.items?.length);
  check(
    "PS-01 返回 collection.ownerName",
    typeof search.json?.items?.[0]?.collection?.ownerName === "string",
    search.json?.items?.[0]?.collection,
  );
  check(
    "PS-01 分页结构完整",
    search.json?.pagination && typeof search.json.pagination.total === "number" && typeof search.json.pagination.totalPages === "number",
    search.json?.pagination,
  );
  const badType = await call("GET", "/api/personal-collections/items?type=NOVEL");
  check("PS-01 非法 type -> 400", badType.status === 400, badType.status);

  // ---------- MSG 鉴权 ----------
  console.log("MSG 鉴权");
  const anonymous = await call("GET", "/api/messages/conversations");
  check("MSG-01 未登录 -> 401", anonymous.status === 401, anonymous.status);

  // ---------- MSG-03 发起 ----------
  console.log("MSG-03 发起会话");
  const started = await call("POST", "/api/messages/conversations", {
    userId: visitorB,
    body: { recipientCollectionSlug: slugA, body: "想请教这册书的版本信息。" },
  });
  check("MSG-03 发起会话 -> 200", started.status === 200, { status: started.status, body: started.json });
  const conversationId: string = started.json?.id ?? "";
  check("MSG-03 返回会话 id", conversationId.length > 0, conversationId);
  check(
    "MSG-03 参与者为对方馆",
    started.json?.participant?.collectionSlug === slugA,
    started.json?.participant,
  );

  // ---------- MSG-01 列表 ----------
  console.log("MSG-01 会话列表");
  const listB = await call("GET", "/api/messages/conversations", { userId: visitorB });
  check("MSG-01 列表 -> 200", listB.status === 200, listB.status);
  check("MSG-01 含刚发起的会话", listB.json?.items?.length === 1, listB.json?.items?.length);
  check("MSG-01 默认 limit=50", listB.json?.pagination?.limit === 50, listB.json?.pagination);
  check("MSG-01 最后消息 sender=SELF", listB.json?.items?.[0]?.lastMessage?.sender === "SELF", listB.json?.items?.[0]?.lastMessage);

  // ---------- MSG-02 详情 ----------
  console.log("MSG-02 会话详情");
  const detailA = await call("GET", `/api/messages/conversations/${conversationId}`, { userId: ownerA });
  check("MSG-02 参与者可读 -> 200", detailA.status === 200, detailA.status);
  check("MSG-02 消息列表 1 条", detailA.json?.messages?.length === 1, detailA.json?.messages?.length);
  check("MSG-02 对方消息 sender=OTHER", detailA.json?.messages?.[0]?.sender === "OTHER", detailA.json?.messages?.[0]);
  const detailOutsider = await call("GET", `/api/messages/conversations/${conversationId}`, { userId: outsider });
  check("MSG-02 非参与者 -> 404", detailOutsider.status === 404, detailOutsider.status);

  // ---------- MSG-05 已读 ----------
  console.log("MSG-05 标记已读");
  const readA = await call("PATCH", `/api/messages/conversations/${conversationId}/read`, { userId: ownerA });
  check("MSG-05 PATCH -> 200", readA.status === 200, { status: readA.status, body: readA.json });
  check("MSG-05 返回 unreadCount 0", readA.json?.unreadCount === 0, readA.json);

  // ---------- MSG-04 回复 ----------
  console.log("MSG-04 回复消息");
  const replyA = await call("POST", `/api/messages/conversations/${conversationId}/messages`, {
    userId: ownerA,
    body: { body: "谢谢您的关注。" },
  });
  check("MSG-04 回复 -> 200", replyA.status === 200, { status: replyA.status, body: replyA.json });
  check("MSG-04 消息累加为 2 条", replyA.json?.messages?.length === 2, replyA.json?.messages?.length);
  check("MSG-04 己方消息 sender=SELF", replyA.json?.messages?.[1]?.sender === "SELF", replyA.json?.messages?.[1]);
  const replyOutsider = await call("POST", `/api/messages/conversations/${conversationId}/messages`, {
    userId: outsider,
    body: { body: "不应成功。" },
  });
  check("MSG-04 非参与者回复 -> 404", replyOutsider.status === 404, replyOutsider.status);

  // ---------- MSG-01 未读回显 ----------
  const listAAfter = await call("GET", "/api/messages/conversations", { userId: visitorB });
  check("MSG-01 B 侧出现未读 1", listAAfter.json?.items?.[0]?.unreadCount === 1, listAAfter.json?.items?.[0]);

  // ---------- PC-03 书单导出 ----------
  console.log("PC-03 公开书单导出");
  await makeCard(visitorB, "ACTIVE", "b");
  await makeCard(ownerA, "ACTIVE", "a");

  const exportPath = `/api/personal-collections/${slugA}/books/export?format=xlsx`;
  const anonymousExport = await call("GET", exportPath);
  check("PC-03 未登录 -> 401 AUTH_REQUIRED", anonymousExport.status === 401 && anonymousExport.json?.code === "AUTH_REQUIRED", anonymousExport.json);

  const okExport = await call("GET", exportPath, { userId: visitorB });
  check("PC-03 有效借阅证 -> 200", okExport.status === 200, okExport.status);
  check(
    "PC-03 响应为 xlsx",
    (okExport.headers.get("content-type") ?? "").includes("spreadsheetml.sheet"),
    okExport.headers.get("content-type"),
  );
  check(
    "PC-03 Content-Disposition 使用 UTF-8 文件名",
    (okExport.headers.get("content-disposition") ?? "").includes("filename*=UTF-8''"),
    okExport.headers.get("content-disposition"),
  );
  check("PC-03 文件体为 zip（PK 开头）", okExport.bytes[0] === 0x50 && okExport.bytes[1] === 0x4b, okExport.bytes.length);

  const badFormat = await call("GET", `/api/personal-collections/${slugA}/books/export?format=csv`, { userId: visitorB });
  check(
    "PC-03 非 xlsx 格式 -> 400 UNSUPPORTED_EXPORT_FORMAT",
    badFormat.status === 400 && badFormat.json?.code === "UNSUPPORTED_EXPORT_FORMAT",
    badFormat.json,
  );
  const ownExport = await call("GET", exportPath, { userId: ownerA });
  check(
    "PC-03 导出自己的馆 -> 403 OWN_COLLECTION_EXPORT_NOT_ALLOWED",
    ownExport.status === 403 && ownExport.json?.code === "OWN_COLLECTION_EXPORT_NOT_ALLOWED",
    ownExport.json,
  );
  const missingExport = await call("GET", `/api/personal-collections/no-such-${suffix}/books/export`, { userId: visitorB });
  check(
    "PC-03 收藏馆不存在 -> 404 COLLECTION_NOT_FOUND",
    missingExport.status === 404 && missingExport.json?.code === "COLLECTION_NOT_FOUND",
    missingExport.json,
  );

  console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
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
