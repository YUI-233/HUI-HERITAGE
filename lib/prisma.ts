import { PrismaClient } from "@prisma/client";

/**
 * Bump this value whenever a Prisma model is added to a running local server.
 * It prevents Next's development-module cache from reusing a client generated
 * before the new delegate existed (for example, ImportBatchRecord).
 */
const clientSchemaVersion = "2026-10-visit-events-v1";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

if (!globalForPrisma.prisma || globalForPrisma.prismaSchemaVersion !== clientSchemaVersion) {
  globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = new PrismaClient();
  globalForPrisma.prismaSchemaVersion = clientSchemaVersion;
}

export const prisma = globalForPrisma.prisma;
