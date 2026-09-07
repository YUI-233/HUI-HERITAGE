const message = "该功能仍依赖本地 PostgreSQL，尚未迁移到 GPT 正式站 D1。";

function unavailable(): never {
  throw new Error(message);
}

function unavailableProxy(): object {
  return new Proxy(unavailable, {
    get: () => unavailableProxy(),
    apply: () => unavailable(),
  });
}

/** Vinext-only replacement. Local Next builds continue to use the real Prisma client. */
export class PrismaClient {
  constructor() { return unavailableProxy() as PrismaClient; }
}

export const ReviewStatus = { DRAFT: "DRAFT", PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED", NEEDS_REVISION: "NEEDS_REVISION", ARCHIVED: "ARCHIVED" } as const;
export const CollectionOrigin = { DOMESTIC: "DOMESTIC", OVERSEAS: "OVERSEAS", PERSONAL: "PERSONAL" } as const;
export const WorkflowLane = { A: "A", B: "B" } as const;
export const UserRole = { MEMBER: "MEMBER", COLLECTOR: "COLLECTOR", SUPER_ADMIN: "SUPER_ADMIN" } as const;
export const PersonalItemType = { BOOK: "BOOK", ARTIFACT: "ARTIFACT" } as const;
export const Prisma = { sql: unavailable, join: unavailable, JsonNull: null, TransactionIsolationLevel: { Serializable: "Serializable" } } as const;
