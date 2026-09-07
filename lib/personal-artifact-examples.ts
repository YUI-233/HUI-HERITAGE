import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPersonalItem } from "./personal-collection";
import { prisma } from "./prisma";
import { personalArtifactExamples } from "./personal-artifact-example-data";

const imageDownloads = new Map<string, Promise<Buffer>>();

function fetchExampleImage(url: string) {
  const existing = imageDownloads.get(url);
  if (existing) return existing;
  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("图片下载失败");
      return Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  })();
  imageDownloads.set(url, pending);
  return pending;
}

export async function seedPersonalArtifactExamples(ownerId: string, force = false) {
  const markerKey = `personal-artifact-examples-seeded:${ownerId}`;
  const existing = await prisma.personalCollectionItem.findMany({ where: { ownerId, type: "ARTIFACT", title: { startsWith: "示例｜" } }, select: { title: true } });
  const existingTitles = new Set(existing.map((item) => item.title));
  const missingExamples = personalArtifactExamples.filter((example) => !existingTitles.has(example.title));
  if (!missingExamples.length) return { created: 0, message: `示例素材已完整加入（${personalArtifactExamples.length} 条），可直接删除。` };
  const seededBefore = await prisma.siteSetting.findUnique({ where: { key: markerKey }, select: { key: true } });
  if (seededBefore && !force && existing.length === 0) return { created: 0, message: "示例素材已移除；如需重新加入，可使用管理页的“加载示例素材”。" };
  let created = 0;
  for (const example of missingExamples) {
    const item = await createPersonalItem(ownerId, { type: "ARTIFACT", title: example.title, creator: example.creator, era: example.era, editionOrCategory: example.category, volumeCount: 1, description: example.description });
    try {
      const bytes = await fetchExampleImage(example.url); const suffix = `${item.id}-example.jpg`; const storageKey = `private/personal/${ownerId}/${suffix}`;
      const directory = path.join(process.cwd(), "uploads", "private", "personal", ownerId); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, suffix), bytes);
      await prisma.mediaAsset.create({ data: { storageKey, mimeType: "image/jpeg", visibility: "PRIVATE", personalCollectionItemId: item.id, uploadedById: ownerId } });
    } catch { /* Keep the example record even if the remote preview image is temporarily unavailable. */ }
    created += 1;
  }
  await prisma.siteSetting.upsert({ where: { key: markerKey }, create: { key: markerKey, value: { seededAt: new Date().toISOString() } }, update: { value: { seededAt: new Date().toISOString() } } });
  return { created, message: `已加入 ${created} 条可删除的示例藏品；共 ${personalArtifactExamples.length} 条测试记录。` };
}
