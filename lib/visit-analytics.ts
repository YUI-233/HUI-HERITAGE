import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const DAY = 86400000;
export function analyticsDay(date = new Date()) { return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function analyticsFilter(params: URLSearchParams) {
  const today = analyticsDay();
  const from = params.get("from") || analyticsDay(new Date(Date.now() - 29 * DAY));
  const to = params.get("to") || today;
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) throw new Error("请选择有效日期。");
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + DAY);
  if (start >= end || end.getTime() - start.getTime() > 366 * DAY || to > today) throw new Error("日期范围最多 366 天，结束日期不能晚于今天，开始日期不能晚于结束日期。");
  const userType = params.get("userType") || "ALL";
  const contentType = params.get("contentType") || "ALL";
  if (!["ALL", "REGISTERED", "GUEST"].includes(userType) || !["ALL", "PAGE", "BOOK", "ARTICLE"].includes(contentType)) throw new Error("筛选条件无效。");
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error("页码无效。");
  return { from, to, start, end, userType, contentType, keyword: (params.get("q") || "").trim().slice(0, 100), page, sort: params.get("sort") === "readers" ? "readers" : "reads" };
}
export type AnalyticsFilter = ReturnType<typeof analyticsFilter>;
function where(f: AnalyticsFilter, start = f.start, end = f.end) {
  const terms = [Prisma.sql`created_at >= ${start} AND created_at < ${end}`];
  if (f.userType !== "ALL") terms.push(Prisma.sql`user_type = ${f.userType}`);
  if (f.contentType !== "ALL") terms.push(Prisma.sql`content_type = ${f.contentType}`);
  if (f.keyword) terms.push(Prisma.sql`(position(lower(${f.keyword}) in lower(title)) > 0 OR position(lower(${f.keyword}) in lower(path)) > 0)`);
  return Prisma.join(terms, " AND ");
}
type Metrics = { visitors: number; sessions: number; views: number; reads: number; registeredViews: number; guestViews: number; registeredVisitors: number; guestVisitors: number };
async function metrics(condition: Prisma.Sql) {
  const [row] = await prisma.$queryRaw<Metrics[]>(Prisma.sql`SELECT COUNT(DISTINCT visitor_key)::int AS visitors, COUNT(DISTINCT session_key)::int AS sessions, COUNT(*)::int AS views, COUNT(*) FILTER (WHERE content_type IN ('BOOK','ARTICLE'))::int AS reads, COUNT(*) FILTER (WHERE user_type='REGISTERED')::int AS "registeredViews", COUNT(*) FILTER (WHERE user_type='GUEST')::int AS "guestViews", COUNT(DISTINCT visitor_key) FILTER (WHERE user_type='REGISTERED')::int AS "registeredVisitors", COUNT(DISTINCT visitor_key) FILTER (WHERE user_type='GUEST')::int AS "guestVisitors" FROM visit_events WHERE ${condition}`);
  return { ...row, averageReads: row.visitors ? Math.round(row.reads / row.visitors * 100) / 100 : 0 };
}
export type VisitDetail = { id: string; createdAt: Date; title: string; path: string; userType: string; contentType: string; source: string | null };
export async function visitDetails(f: AnalyticsFilter, limit = 30, offset = (f.page - 1) * 30) {
  return prisma.$queryRaw<VisitDetail[]>(Prisma.sql`SELECT id, created_at AS "createdAt", title, path, user_type AS "userType", content_type AS "contentType", source FROM visit_events WHERE ${where(f)} ORDER BY created_at DESC, id LIMIT ${limit} OFFSET ${offset}`);
}
export async function getVisitAnalytics(f: AnalyticsFilter) {
  const duration = f.end.getTime() - f.start.getTime();
  const [current, previous, daily, ranking, details, first, contentTotals] = await Promise.all([
    metrics(where(f)), metrics(where(f, new Date(f.start.getTime() - duration), f.start)),
    prisma.$queryRaw<Array<Metrics & { date: string; userType: string }>>(Prisma.sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date, user_type AS "userType", COUNT(DISTINCT visitor_key)::int AS visitors, COUNT(DISTINCT session_key)::int AS sessions, COUNT(*)::int AS views, COUNT(*) FILTER (WHERE content_type IN ('BOOK','ARTICLE'))::int AS reads FROM visit_events WHERE ${where(f)} GROUP BY 1,2 ORDER BY 1,2`),
    prisma.$queryRaw<Array<{ contentId: string; contentType: string; title: string; reads: number; readers: number; registered: number; guests: number; lastRead: Date }>>(Prisma.sql`WITH ranked AS (SELECT content_id AS "contentId", content_type AS "contentType", (array_agg(title ORDER BY created_at DESC))[1] AS title, COUNT(*)::int AS reads, COUNT(DISTINCT visitor_key)::int AS readers, COUNT(*) FILTER (WHERE user_type='REGISTERED')::int AS registered, COUNT(*) FILTER (WHERE user_type='GUEST')::int AS guests, MAX(created_at) AS "lastRead", ROW_NUMBER() OVER (PARTITION BY content_type ORDER BY ${f.sort === "readers" ? Prisma.sql`COUNT(DISTINCT visitor_key)` : Prisma.sql`COUNT(*)`} DESC, MAX(created_at) DESC, content_id) AS position FROM visit_events WHERE ${where(f)} AND content_type IN ('BOOK','ARTICLE') GROUP BY content_id,content_type) SELECT "contentId", "contentType", title, reads, readers, registered, guests, "lastRead" FROM ranked WHERE position <= 20 ORDER BY "contentType", position`),
    visitDetails(f), prisma.visitEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.$queryRaw<Array<{ contentType: string; reads: number; readers: number }>>(Prisma.sql`SELECT content_type AS "contentType", COUNT(*)::int AS reads, COUNT(DISTINCT visitor_key)::int AS readers FROM visit_events WHERE ${where(f)} AND content_type IN ('BOOK','ARTICLE') GROUP BY content_type`),
  ]);
  return { current, previous, daily, ranking, details, contentTotals, total: current.views, page: f.page, firstRecordAt: first?.createdAt ?? null, from: f.from, to: f.to };
}
export type VisitAnalytics = Awaited<ReturnType<typeof getVisitAnalytics>>;
