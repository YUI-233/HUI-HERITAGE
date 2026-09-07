import assert from "node:assert/strict";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DELETE, GET } from "../app/api/admin/catalog-media/route";
import { prisma } from "../lib/prisma";

async function main() {
  const token = process.env.ADMIN_LOCAL_TOKEN;
  if (!token) throw new Error("ADMIN_LOCAL_TOKEN is required for this verification.");

  const artifact = await prisma.artifact.create({
    data: {
      title: `图片管理验收 ${Date.now()}`,
      category: "验收临时资料",
      status: "DRAFT",
    },
  });
  const filename = `verification-${artifact.id}.png`;
  const storageKey = `collection/${filename}`;
  const filePath = path.join(process.cwd(), "public", storageKey);
  let mediaId: string | undefined;

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from("HUI HERITAGE media verification"));
    const media = await prisma.mediaAsset.create({
      data: {
        storageKey,
        mimeType: "image/png",
        visibility: "PUBLIC",
        artifactId: artifact.id,
      },
    });
    mediaId = media.id;

    const listResponse = await GET(new Request(`http://localhost/api/admin/catalog-media?recordId=${artifact.id}`, {
      headers: { "x-admin-local-token": token },
    }));
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json() as Array<{ id: string; storageKey: string }>;
    assert.ok(listed.some((item) => item.id === media.id && item.storageKey === storageKey));

    const deleteResponse = await DELETE(new Request("http://localhost/api/admin/catalog-media", {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-admin-local-token": token },
      body: JSON.stringify({ id: media.id, recordId: artifact.id }),
    }));
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(await deleteResponse.json(), { deleted: true });
    assert.equal(await prisma.mediaAsset.findUnique({ where: { id: media.id } }), null);
    await assert.rejects(access(filePath));
    mediaId = undefined;
  } finally {
    if (mediaId) await prisma.mediaAsset.delete({ where: { id: mediaId } }).catch(() => undefined);
    await rm(filePath, { force: true });
    await prisma.artifact.delete({ where: { id: artifact.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
  console.log("后台图片管理：读取、删除与本地文件清理均已验证。");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
