import { prisma } from "../lib/prisma";

/** Returns the project-wide PostgreSQL client for server-side database work. */
export function getDb() {
  return prisma;
}
