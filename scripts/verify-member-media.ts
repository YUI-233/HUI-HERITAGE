import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { POST as login } from "../app/api/auth/login/route";
import { GET as memberMedia } from "../app/api/catalog/[id]/member-media/[mediaId]/route";
import { hashPassword } from "../lib/local-auth";
import { prisma } from "../lib/prisma";

const stamp = Date.now();
const email = `member-media-${stamp}@huiheritage.local`;
const title = `会员图片验收 ${stamp}`;

async function main() {
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword("verification-password") } });
  const book = await prisma.book.create({ data: { title, status: "APPROVED" } });
  const filename = `member-media-${book.id}.png`;
  const storageKey = `private/manuscripts/${filename}`;
  const filePath = path.join(process.cwd(), "uploads", storageKey);
  let assetId: string | undefined;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from("member-only-image"));
    const asset = await prisma.mediaAsset.create({ data: { storageKey, mimeType: "image/png", visibility: "MEMBER_ONLY", bookId: book.id } });
    assetId = asset.id;
    const params = { params: Promise.resolve({ id: book.id, mediaId: asset.id }) };
    const anonymous = await memberMedia(new Request("http://localhost/api/catalog/member-media"), params);
    assert.equal(anonymous.status, 401);
    const loginResponse = await login(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "verification-password" }) }));
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
    assert.equal(loginResponse.status, 200);
    assert.ok(cookie);
    const allowed = await memberMedia(new Request("http://localhost/api/catalog/member-media", { headers: { cookie } }), params);
    assert.equal(allowed.status, 200);
    assert.equal(await allowed.text(), "member-only-image");
    assert.equal(allowed.headers.get("cache-control"), "private, no-store");
    console.log("游客不能读取古籍原图，登录会员可读取受限图片，均已验证。");
  } finally {
    if (assetId) await prisma.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    await rm(filePath, { force: true });
    await prisma.book.delete({ where: { id: book.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
