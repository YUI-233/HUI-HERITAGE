import { prisma } from "./prisma";

export const defaultPersonalArtifactCategories = ["碑帖", "器皿", "书画", "纺织品", "照片", "手稿"] as const;

const settingKey = (ownerId: string) => `personal-artifact-categories:${ownerId}`;

function normalize(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 30)
    : [];
}

export async function listPersonalArtifactCategories(ownerId: string) {
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey(ownerId) }, select: { value: true } });
  return [...new Set([...defaultPersonalArtifactCategories, ...normalize(setting?.value)])];
}

export async function addPersonalArtifactCategory(ownerId: string, value: unknown) {
  const category = typeof value === "string" ? value.trim().slice(0, 40) : "";
  if (!category) throw new Error("请填写类别名称。");
  const existing = await listPersonalArtifactCategories(ownerId);
  if (existing.includes(category)) return existing;
  const custom = existing.filter((item) => !defaultPersonalArtifactCategories.includes(item as typeof defaultPersonalArtifactCategories[number]));
  await prisma.siteSetting.upsert({ where: { key: settingKey(ownerId) }, create: { key: settingKey(ownerId), value: [...custom, category] }, update: { value: [...custom, category] } });
  return [...existing, category];
}
