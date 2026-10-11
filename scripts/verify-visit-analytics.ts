import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { prisma } from "../lib/prisma";
import { createSessionCookie } from "../lib/local-auth";
import { analyticsDay, analyticsFilter, getVisitAnalytics } from "../lib/visit-analytics";

nextEnv.loadEnvConfig(process.cwd());
const base = "http://localhost:3014";
const marker = `analytics-check-${randomUUID()}`;
const eventIds: string[] = [];
const fixtureIds: { user?: string; book?: string; article?: string } = {};
async function visit(path: string, cookie = "", sessionId: string = randomUUID(), id: string = randomUUID()) {
  eventIds.push(id);
  return fetch(`${base}/api/analytics/visit`, { method: "POST", headers: { "content-type": "application/json", origin: base, cookie }, body: JSON.stringify({ id, sessionId, path, title: marker, referrer: "https://example.org/private?token=do-not-store" }) });
}
async function main() {
  try {
    assert.equal(analyticsDay(new Date("2026-10-10T16:00:00Z")), "2026-10-11");
    assert.throws(() => analyticsFilter(new URLSearchParams({ from: "2026-02-30" })));
    const user = await prisma.user.create({ data: { email: `${marker}@example.invalid`, displayName: marker, role: "MEMBER" } }); fixtureIds.user = user.id;
    const book = await prisma.book.create({ data: { title: `${marker} 古籍`, status: "APPROVED" } }); fixtureIds.book = book.id;
    const article = await prisma.researchArticle.create({ data: { title: `${marker} 文章`, summary: marker, category: marker, status: "APPROVED" } }); fixtureIds.article = article.id;
    const session = randomUUID();
    const response = await visit(`/catalog/${book.id}`, "", session);
    assert.equal(response.status, 204);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    assert.ok(cookie.startsWith("hui_visitor="));
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
    const eventId = eventIds[0];
    assert.equal((await visit(`/catalog/${book.id}`, cookie, session, eventId)).status, 204);
    const loginCookie = `${cookie}; ${createSessionCookie(user.id).split(";")[0]}`;
    assert.equal((await visit(`/catalog/${book.id}`, loginCookie, session)).status, 204);
    assert.equal((await visit(`/research/${article.id}`, cookie, session)).status, 204);
    const filter = analyticsFilter(new URLSearchParams({ from: analyticsDay(), to: analyticsDay(), q: marker }));
    const stats = await getVisitAnalytics(filter);
    assert.equal(stats.current.views, 3, "Repeated event identifiers must not double count");
    assert.equal(stats.current.visitors, 2, "Guest and member identities must remain separate");
    assert.equal(stats.current.sessions, 2, "Login starts a separate identity's session");
    assert.equal(stats.current.reads, 3);
    assert.equal(stats.current.registeredViews, 1);
    assert.equal(stats.current.guestViews, 2);
    assert.equal(stats.ranking.find(row => row.contentType === "BOOK")?.reads, 2);
    assert.equal(stats.ranking.find(row => row.contentType === "ARTICLE")?.reads, 1);
    assert.equal(stats.details[0].source, "example.org", "Referrers must not retain queries or private paths");
    const guestOnly = await getVisitAnalytics({ ...filter, userType: "GUEST", contentType: "BOOK" });
    assert.equal(guestOnly.current.views, 1);
    assert.equal(guestOnly.ranking.length, 1);
    const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true } });
    assert.ok(admin, "Local system Admin must exist");
    const adminCookie = createSessionCookie(admin.id).split(";")[0];
    const adminHeaders = { cookie: adminCookie };
    const anon = await fetch(`${base}/api/admin/analytics`);
    assert.equal(anon.status, 403);
    assert.equal((await fetch(`${base}/api/admin/analytics`, { headers: { cookie: loginCookie } })).status, 403);
    const adminStats = await fetch(`${base}/api/admin/analytics?from=${filter.from}&to=${filter.to}&q=${marker}`, { headers: adminHeaders });
    assert.equal(adminStats.status, 200);
    assert.equal((await adminStats.json()).current.views, 3);
    const csv = await fetch(`${base}/api/admin/analytics?from=${filter.from}&to=${filter.to}&q=${marker}&export=csv`, { headers: adminHeaders });
    assert.equal(csv.status, 200); assert.match(csv.headers.get("content-type")!, /text\/csv/);
    assert.match(await csv.text(), /游客/);
    const adminPage = await fetch(`${base}/admin/analytics`, { headers: adminHeaders });
    assert.equal(adminPage.status, 200); assert.match(await adminPage.text(), /访问数据/);
    const adminAccount = await fetch(`${base}/account`, { headers: adminHeaders });
    assert.equal(adminAccount.status, 200); assert.match(await adminAccount.text(), /href="\/admin\/analytics"/);
    const memberAccount = await fetch(`${base}/account`, { headers: { cookie: loginCookie } });
    assert.equal(memberAccount.status, 200); assert.doesNotMatch(await memberAccount.text(), /href="\/admin\/analytics"/);
    const anonymousPage = await fetch(`${base}/admin/analytics`, { redirect: "manual" });
    assert.equal(anonymousPage.status, 307); assert.equal(anonymousPage.headers.get("location"), "/login");
    const before = await prisma.visitEvent.count({ where: { id: { in: eventIds } } });
    assert.equal((await visit(`/catalog/${book.id}`, adminCookie)).status, 204);
    assert.equal(await prisma.visitEvent.count({ where: { id: { in: eventIds } } }), before, "Admin traffic is excluded");
    assert.equal((await visit("/admin/users", cookie)).status, 400);
    assert.equal((await fetch(`${base}/api/admin/analytics?from=invalid`, { headers: adminHeaders })).status, 400);
    // Each category gets its own top twenty, even when books dominate the combined count.
    const seeds = Array.from({ length: 21 }, (_, i) => ({ id: randomUUID(), visitorKey: `guest:${marker}`, sessionKey: marker, userType: "GUEST", path: "/", title: marker, contentType: "BOOK", contentId: `${marker}-${i}` }));
    eventIds.push(...seeds.map(row => row.id));
    await prisma.visitEvent.createMany({ data: seeds });
    const ranked = await getVisitAnalytics(filter);
    assert.equal(ranked.ranking.filter(row => row.contentType === "BOOK").length, 20);
    assert.equal(ranked.ranking.filter(row => row.contentType === "ARTICLE").length, 1);
    console.log("PASS: HTTP visit capture, duplicate suppression, guest/member separation, ranking, filters, CSV, Admin page/API permissions, and traffic exclusions.");
  } finally {
    await prisma.visitEvent.deleteMany({ where: { id: { in: eventIds } } });
    if (fixtureIds.book) await prisma.book.delete({ where: { id: fixtureIds.book } });
    if (fixtureIds.article) await prisma.researchArticle.delete({ where: { id: fixtureIds.article } });
    if (fixtureIds.user) await prisma.user.delete({ where: { id: fixtureIds.user } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
