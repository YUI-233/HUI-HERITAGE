import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getCollectionProfile, listCollectionCoverOptions, updateCollectionProfile } from "../lib/personal-collection-profile";
import { prisma } from "../lib/prisma";

const token = randomUUID();
const user = await prisma.user.create({
  data: { email: `profile-${token}@example.invalid`, displayName: "验证收藏馆", emailVerifiedAt: new Date() },
  select: { id: true, email: true, displayName: true },
});

try {
  const initial = await getCollectionProfile(user);
  assert.equal(initial.displayName, "验证收藏馆");
  assert.match(initial.slug, /^collection-/);

  const item = await prisma.personalCollectionItem.create({
    data: {
      ownerId: user.id, type: "BOOK", title: "验证藏书", serialNumber: "PC-VERIFY",
      status: "APPROVED", isPublic: true,
    },
  });
  const media = await prisma.mediaAsset.create({
    data: {
      storageKey: `private/personal/${user.id}/${token}.jpg`, mimeType: "image/jpeg", visibility: "PUBLIC",
      personalCollectionItemId: item.id, uploadedById: user.id,
    },
  });

  const updated = await updateCollectionProfile(user, {
    displayName: "验证后的收藏馆", description: "验证简介", publicCollectorName: "验证收藏者",
    themes: ["经学", "地方文献"], primaryEras: ["清代"], primaryRegion: "西北地区",
    collectingSinceYear: 2012, originStory: "验证收藏缘起。",
    collaborationInterests: ["学术研究", "数字化合作"], acceptsMessages: false, coverMediaId: media.id,
  });
  assert.equal(updated.slug, initial.slug, "修改名称后 slug 必须保持稳定");
  assert.equal(updated.publicCollectorName, "验证收藏者");
  assert.deepEqual(updated.themes, ["经学", "地方文献"]);
  assert.equal(updated.acceptsMessages, false);
  assert.equal(updated.cover?.mediaId, media.id);

  const options = await listCollectionCoverOptions(user.id);
  assert.equal(options.length, 1);
  assert.equal(options[0].mediaId, media.id);
  console.log("Personal collection profile backend verified.");
} finally {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
