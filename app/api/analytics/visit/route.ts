import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSignedInUser } from "../../../../lib/local-auth";
import { getCatalogRecord } from "../../../../lib/catalog-repository";
import { canReadBorrowedBook } from "../../../../lib/borrowing";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4096) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 4096) return new Response(null, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!body || !uuid.test(body.id || "") || !uuid.test(body.sessionId || "") || typeof body.path !== "string" || body.path.length > 500 || !/^\/(?!\/)[^?#\s\\]*$/.test(body.path) || /^\/(admin|api)(\/|$)/.test(body.path)) return new Response(null, { status: 400 });
  try {
    const user = await getSignedInUser(request);
    if (user?.role === "SUPER_ADMIN") return new Response(null, { status: 204 });
    const cookie = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("hui_visitor="))?.slice(12);
    const visitor = cookie && uuid.test(cookie) ? cookie : randomUUID();
    const visitorKey = user ? `user:${user.id}` : `guest:${visitor}`;
    let title = typeof body.title === "string" ? body.title.slice(0, 200) : body.path;
    let contentType = "PAGE";
    let contentId: string | null = null;
    const catalog = body.path.match(/^\/catalog\/([^/]+)(\/reader)?\/?$/);
    const article = body.path.match(/^\/research\/([^/]+)\/?$/);
    if (catalog) {
      const record = await getCatalogRecord(decodeURIComponent(catalog[1]));
      if (!record) return new Response(null, { status: 204 });
      if (catalog[2] && record.type === "manuscript" && (!user || !(await canReadBorrowedBook(user.id, record.id)))) return new Response(null, { status: 204 });
      title = record.title;
      if (record.type === "manuscript") { contentType = "BOOK"; contentId = record.id; }
    } else if (article) {
      const record = await prisma.researchArticle.findFirst({ where: { id: decodeURIComponent(article[1]), status: "APPROVED" }, select: { id: true, title: true } });
      if (!record) return new Response(null, { status: 204 });
      title = record.title; contentType = "ARTICLE"; contentId = record.id;
    }
    let source: string | null = null;
    try { const ref = new URL(body.referrer); source = ref.origin === new URL(request.url).origin ? "站内访问" : ref.hostname.slice(0, 200); } catch { /* Direct visit. */ }
    await prisma.visitEvent.upsert({ where: { id: body.id }, update: {}, create: { id: body.id, visitorKey, sessionKey: `${visitorKey}:${body.sessionId}`, userType: user ? "REGISTERED" : "GUEST", path: body.path, title, contentType, contentId, source } });
    const response = new NextResponse(null, { status: 204 });
    if (!cookie || !uuid.test(cookie)) response.cookies.set("hui_visitor", visitor, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 365 * 86400 });
    return response;
  } catch (error) {
    console.error("Visit recording failed", error instanceof Error ? error.message : "unknown error");
    return new Response(null, { status: 503 });
  }
}
