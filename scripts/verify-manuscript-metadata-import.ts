import { prisma } from "../lib/prisma";

const baseUrl = process.env.MANUSCRIPT_IMPORT_VERIFY_URL ?? "http://localhost:3014";
const suffix = Date.now();
const email = `manuscript-import-check-${suffix}@example.local`;
const password = "ManuscriptImportCheck!2026";
const title = `古籍字段验收 ${suffix}`;
let userId = "";
let groupId = "";
let bookId = "";

async function request(path: string, init?: RequestInit) { return fetch(`${baseUrl}${path}`, init); }

async function main() {
  try {
    const registration = await request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, displayName: "古籍 CSV 验收账户" }) });
    if (!registration.ok) throw new Error(`Registration failed (${registration.status}).`);
    const account = await prisma.user.findUniqueOrThrow({ where: { email } }); userId = account.id;
    const group = await prisma.userGroup.create({ data: { name: `古籍 CSV 验收组 ${suffix}`, permissions: ["CATALOG_WRITE"] } }); groupId = group.id;
    await prisma.user.update({ where: { id: userId }, data: { groupId } });
    const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const cookie = login.headers.get("set-cookie")?.split(";")[0]; if (!login.ok || !cookie) throw new Error(`Login failed (${login.status}).`);

    const csv = `分类编号,分类,书名,作者,册数,年代,刊刻年份,刊刻时间,刊刻主体,版本,装帧,备注\n2.2.2,教法 / 礼制仪规 / 杂学（礼制仪规）,${title},马有林,10,清,光绪十一年,1885,京都清真寺,木刻本,线装,一函十册全\n`;
    const form = new FormData(); form.set("file", new File([csv], "manuscript-import-check.csv", { type: "text/csv" }));
    const imported = await request("/api/admin/catalog/import", { method: "POST", headers: { cookie }, body: form });
    if (!imported.ok) throw new Error(`Import failed (${imported.status}): ${JSON.stringify(await imported.json())}`);
    const result = await imported.json() as { created?: number }; if (result.created !== 1) throw new Error("Expected exactly one imported record.");
    const book = await prisma.book.findFirstOrThrow({ where: { title } }); bookId = book.id;
    if (book.status !== "DRAFT" || book.volumeCount !== 10 || book.dynasty !== "清" || book.eraDetail !== "光绪十一年" || book.publicationDate !== "1885" || book.imprintPublisher !== "京都清真寺" || book.versionType !== "木刻本" || book.binding !== "线装" || !book.categories.includes("2.2.2杂学（礼制仪规）")) throw new Error("Imported manuscript fields were not stored correctly.");
    await prisma.book.update({ where: { id: book.id }, data: { status: "APPROVED" } });
    const publicRecord = await request(`/api/catalog/${book.id}`); const publicBody = await publicRecord.json() as { record?: { metadata?: Array<{ label: string; value: string }> } };
    const metadata = publicBody.record?.metadata ?? [];
    for (const expected of ["分类", "册数", "年代", "刊刻年份", "刊刻时间", "刊刻主体", "版本类型", "装帧"]) if (!metadata.some((item) => item.label === expected)) throw new Error(`Missing public metadata: ${expected}; returned=${metadata.map((item) => item.label).join(",")}`);
    console.log("manuscript_metadata_import_ok=csv,draft,fields,public-detail");
  } finally {
    if (bookId) { await prisma.auditEvent.deleteMany({ where: { entityType: "BOOK", entityId: bookId } }); await prisma.book.deleteMany({ where: { id: bookId } }); }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (groupId) await prisma.userGroup.deleteMany({ where: { id: groupId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
