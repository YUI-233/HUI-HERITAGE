import { prisma } from "./prisma";

/** 带 HTTP 状态的业务错误，供路由层映射。 */
export class MessageError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY = 1000;

// ---------- 发送频率限制（单实例内存实现；多实例部署需换成 Redis） ----------

const SEND_LIMIT = 10;
const SEND_WINDOW_MS = 60_000;
const sendLog = new Map<string, number[]>();

function assertSendRate(userId: string): void {
  const now = Date.now();
  const recent = (sendLog.get(userId) ?? []).filter((t) => now - t < SEND_WINDOW_MS);
  if (recent.length >= SEND_LIMIT) {
    sendLog.set(userId, recent);
    throw new MessageError(429, "消息发送过于频繁，请稍后再试。");
  }
  recent.push(now);
  sendLog.set(userId, recent);
  if (sendLog.size > 5000) {
    for (const [key, stamps] of sendLog) {
      if (!stamps.length || now - stamps[stamps.length - 1] > SEND_WINDOW_MS) sendLog.delete(key);
    }
  }
}

// ---------- 输入清洗 ----------

/** 消息为纯文本：去除控制字符与首尾空格，长度 1–1000。 */
function normalizeBody(raw: unknown): string {
  if (typeof raw !== "string") throw new MessageError(400, "消息内容格式不正确。");
  // 过滤 C0 控制字符与 DEL（保留换行与制表符），避免不可见字符成为注入载体
  // 过滤 C0 控制字符与 DEL（保留换行 10 与制表符 9），避免不可见字符成为注入载体
  const cleaned = Array.from(raw)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 10 || code === 9) return true;
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  if (!cleaned) throw new MessageError(400, "消息内容不能为空。");
  if (cleaned.length > MAX_BODY) throw new MessageError(400, `消息内容不能超过 ${MAX_BODY} 个字符。`);
  return cleaned;
}

/** 参与者按字典序存储，确保两人之间只有一条会话。 */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function otherParticipantId(
  conversation: { participantOneId: string; participantTwoId: string },
  me: string,
): string {
  return conversation.participantOneId === me ? conversation.participantTwoId : conversation.participantOneId;
}

// ---------- 视图类型 ----------

export type ParticipantView = {
  displayName: string;
  collectionSlug: string | null;
  collectionName: string;
};

export type MessageView = {
  id: string;
  body: string;
  sentAt: string;
  sender: "SELF" | "OTHER";
};

export type ConversationSummaryView = {
  id: string;
  participant: ParticipantView;
  lastMessage: MessageView | null;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationDetailView = ConversationSummaryView & { messages: MessageView[] };

type ConversationRow = {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  lastMessageAt: Date;
};

// ---------- 视图构建 ----------

/** 只暴露对方藏友名与收藏馆信息，绝不返回邮箱、真实用户 ID 或角色。 */
async function buildParticipant(otherUserId: string): Promise<ParticipantView> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: otherUserId }, select: { displayName: true } }),
    prisma.personalCollectionProfile.findUnique({
      where: { ownerId: otherUserId },
      select: { slug: true, displayName: true },
    }),
  ]);
  const collectionName = profile?.displayName ?? (user?.displayName ? `${user.displayName} 的收藏馆` : "我的收藏馆");
  return {
    displayName: user?.displayName || collectionName,
    collectionSlug: profile?.slug ?? null,
    collectionName,
  };
}

function toMessageView(
  message: { id: string; body: string; senderId: string; createdAt: Date },
  me: string,
): MessageView {
  return {
    id: message.id,
    body: message.body,
    sentAt: message.createdAt.toISOString(),
    sender: message.senderId === me ? "SELF" : "OTHER",
  };
}

function countUnread(conversationId: string, me: string): Promise<number> {
  return prisma.message.count({ where: { conversationId, senderId: { not: me }, readAt: null } });
}

async function buildDetail(conversation: ConversationRow, me: string): Promise<ConversationDetailView> {
  const otherId = otherParticipantId(conversation, me);
  const [participant, messages, unreadCount] = await Promise.all([
    buildParticipant(otherId),
    prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
    countUnread(conversation.id, me),
  ]);
  const views = messages.map((m) => toMessageView(m, me));
  return {
    id: conversation.id,
    participant,
    lastMessage: views.length ? views[views.length - 1] : null,
    unreadCount,
    updatedAt: conversation.lastMessageAt.toISOString(),
    messages: views,
  };
}

async function findOwnConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationRow> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, participantOneId: true, participantTwoId: true, lastMessageAt: true },
  });
  if (!conversation || (conversation.participantOneId !== userId && conversation.participantTwoId !== userId)) {
    throw new MessageError(404, "会话不存在或无权访问。");
  }
  return conversation;
}

// ---------- MSG-01：会话列表 ----------

export async function listConversations(userId: string, page: number, limit: number) {
  const where = { OR: [{ participantOneId: userId }, { participantTwoId: userId }] };
  const total = await prisma.conversation.count({ where });
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const rows = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, participantOneId: true, participantTwoId: true, lastMessageAt: true },
  });

  const items = await Promise.all(
    rows.map(async (row) => {
      const otherId = otherParticipantId(row, userId);
      const [participant, last, unreadCount] = await Promise.all([
        buildParticipant(otherId),
        prisma.message.findFirst({ where: { conversationId: row.id }, orderBy: { createdAt: "desc" } }),
        countUnread(row.id, userId),
      ]);
      return {
        id: row.id,
        participant,
        lastMessage: last ? toMessageView(last, userId) : null,
        unreadCount,
        updatedAt: row.lastMessageAt.toISOString(),
      };
    }),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

// ---------- MSG-02：会话详情 ----------

export async function getConversationDetail(userId: string, conversationId: string): Promise<ConversationDetailView> {
  const conversation = await findOwnConversation(userId, conversationId);
  return buildDetail(conversation, userId);
}

// ---------- MSG-03：从公开收藏馆发起私信 ----------

export async function startConversation(
  userId: string,
  input: { recipientCollectionSlug?: unknown; body?: unknown },
): Promise<ConversationDetailView> {
  const body = normalizeBody(input.body);

  const slug = typeof input.recipientCollectionSlug === "string" ? input.recipientCollectionSlug.trim() : "";
  if (!slug) throw new MessageError(400, "请选择要联系的收藏馆。");

  const profile = await prisma.personalCollectionProfile.findUnique({
    where: { slug },
    select: { ownerId: true },
  });
  if (!profile) throw new MessageError(404, "收藏馆不存在或尚未公开。");
  if (profile.ownerId === userId) throw new MessageError(409, "不能给自己发送私信。");

  // 接收方必须仍有已审核公开内容，否则视为不可联系。
  const hasPublic = await prisma.personalCollectionItem.findFirst({
    where: { ownerId: profile.ownerId, status: "APPROVED", isPublic: true },
    select: { id: true },
  });
  if (!hasPublic) throw new MessageError(404, "收藏馆不存在或尚未公开。");

  assertSendRate(userId);

  const [one, two] = orderedPair(userId, profile.ownerId);
  const now = new Date();
  const conversation = await prisma.conversation.upsert({
    where: { participantOneId_participantTwoId: { participantOneId: one, participantTwoId: two } },
    create: { participantOneId: one, participantTwoId: two, lastMessageAt: now },
    update: {},
    select: { id: true, participantOneId: true, participantTwoId: true, lastMessageAt: true },
  });

  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, senderId: userId, body } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);

  return buildDetail({ ...conversation, lastMessageAt: now }, userId);
}

// ---------- MSG-04：回复消息 ----------

export async function replyToConversation(
  userId: string,
  conversationId: string,
  bodyRaw: unknown,
): Promise<ConversationDetailView> {
  const body = normalizeBody(bodyRaw);
  const conversation = await findOwnConversation(userId, conversationId);
  assertSendRate(userId);

  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, senderId: userId, body } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);

  return buildDetail({ ...conversation, lastMessageAt: now }, userId);
}

// ---------- MSG-05：标记会话已读 ----------

export async function markConversationRead(
  userId: string,
  conversationId: string,
): Promise<{ unreadCount: number }> {
  const conversation = await findOwnConversation(userId, conversationId);
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
  return { unreadCount: 0 };
}
