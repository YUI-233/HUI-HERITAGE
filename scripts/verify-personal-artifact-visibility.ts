import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPublicCollection } from "../app/personal-collections/public-collections-data";
import { getCollectionProfile } from "../lib/personal-collection-profile";
import { reviewPersonalItem, setPersonalItemPublic, submitPersonalItem, withdrawPersonalItem } from "../lib/personal-collection";
import { prisma } from "../lib/prisma";

const token = randomUUID();
const owner = await prisma.user.create({
  data: { email: `artifact-visibility-${token}@example.invalid`, displayName: "文物公开测试", emailVerifiedAt: new Date() },
  select: { id: true, email: true, displayName: true },
});
const reviewer = await prisma.user.create({
  data: { email: `artifact-reviewer-${token}@example.invalid`, displayName: "文物审核测试", emailVerifiedAt: new Date() },
  select: { id: true },
});
const noImageTitle = `无图测试文物-${token}`;
const noImageBookTitle = `无图测试书籍-${token}`;

try {
  const profile = await getCollectionProfile(owner);
  const publicItem = await prisma.personalCollectionItem.create({
    data: { ownerId: owner.id, type: "ARTIFACT", title: "公开测试文物", serialNumber: "PC-VIS-1", status: "APPROVED", isPublic: true },
  });
  const privateItem = await prisma.personalCollectionItem.create({
    data: { ownerId: owner.id, type: "ARTIFACT", title: noImageTitle, serialNumber: "PC-VIS-2" },
  });
  const privateBook = await prisma.personalCollectionItem.create({
    data: { ownerId: owner.id, type: "BOOK", title: noImageBookTitle, serialNumber: "PC-VIS-3" },
  });
  const media = await prisma.mediaAsset.create({
    data: { storageKey: `private/personal/${owner.id}/${token}.jpg`, mimeType: "image/jpeg", visibility: "PUBLIC", personalCollectionItemId: publicItem.id, uploadedById: owner.id },
  });

  const visible = await getPublicCollection(profile.slug, { type: "ARTIFACT" });
  assert.deepEqual(visible?.items.map((item) => item.id), [publicItem.id], "只有已审核公开的文物可见");
  assert.equal(visible.collection.artifactCount, 1);

  assert.equal((await submitPersonalItem(owner.id, privateBook.id)).status, "PENDING", "没有图片的书籍也可提交公开审核");
  assert.equal((await withdrawPersonalItem(owner.id, privateBook.id)).status, "DRAFT");

  const submitted = await submitPersonalItem(owner.id, privateItem.id);
  assert.equal(submitted.status, "PENDING", "没有图片也可以提交公开审核");
  assert.deepEqual((await getPublicCollection(profile.slug, { type: "ARTIFACT" }))?.items.map((item) => item.id), [publicItem.id], "审核中不能公开");
  const withdrawn = await withdrawPersonalItem(owner.id, privateItem.id);
  assert.equal(withdrawn.status, "DRAFT");
  await submitPersonalItem(owner.id, privateItem.id);
  const approved = await reviewPersonalItem(reviewer.id, privateItem.id, "APPROVED");
  assert.equal(approved.isPublic, true);
  const withNoImage = await getPublicCollection(profile.slug, { type: "ARTIFACT" });
  assert.equal(withNoImage?.items.find((item) => item.id === privateItem.id)?.cover, null);

  await assert.rejects(setPersonalItemPublic("another-owner", publicItem.id, false), /未找到可调整/);
  const hidden = await setPersonalItemPublic(owner.id, publicItem.id, false);
  assert.equal(hidden.isPublic, false);
  assert.equal(hidden.status, "DRAFT", "重新公开前须再次申请审核");
  assert.equal((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: media.id } })).visibility, "PRIVATE");
  assert.deepEqual((await getPublicCollection(profile.slug))?.items.map((item) => item.id), [privateItem.id], "隐藏一件文物不影响另一件");
  await setPersonalItemPublic(owner.id, privateItem.id, false);
  assert.equal(await getPublicCollection(profile.slug), null, "隐藏最后一件文物后收藏馆不应出现在公开目录");
  console.log("Personal artifact visibility verified: per-item privacy, public listing, owner check and withdrawal.");
} finally {
  await prisma.notification.deleteMany({ where: { kind: "PERSONAL_PUBLICATION_REQUEST", OR: [{ message: { contains: noImageTitle } }, { message: { contains: noImageBookTitle } }] } });
  await prisma.user.delete({ where: { id: owner.id } });
  await prisma.user.delete({ where: { id: reviewer.id } });
  await prisma.$disconnect();
}
