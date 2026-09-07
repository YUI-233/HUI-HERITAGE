import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";

export type ResearchInvitationCard = { title: string; description: string };
export type ResearchInvitationContent = { backgroundImagePath: string | null; eyebrow: string; title: string; introduction: string; cards: ResearchInvitationCard[]; buttonLabel: string };
const settingKey = "home_research_invitation";
export const defaultResearchInvitationContent: ResearchInvitationContent = {
  backgroundImagePath: null,
  eyebrow: "ACADEMIC RESEARCH INVITATION",
  title: "学术研究邀请",
  introduction: "我们诚挚欢迎学者、研究者与志愿者加入，共同让汉文回教古籍与相关文化遗产获得更完整、准确且可持续的记录。",
  cards: [
    { title: "参与学术研究", description: "协作开展文献整理、释读、考证与专题研究。" },
    { title: "完善全球图书馆古籍线索", description: "补充书目、版本、收藏机构与流传信息。" },
    { title: "支持古籍扫描与民间馆藏完善", description: "协助发现、数字化和梳理珍贵的民间收藏。" },
  ],
  buttonLabel: "了解更多",
};

function text(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function readContent(value: unknown): ResearchInvitationContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultResearchInvitationContent;
  const item = value as Record<string, unknown>; const path = item.backgroundImagePath;
  const rawCards = Array.isArray(item.cards) ? item.cards : [];
  return {
    backgroundImagePath: typeof path === "string" && /^\/site\/research-invitation\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(path) ? path : null,
    eyebrow: text(item.eyebrow, defaultResearchInvitationContent.eyebrow, 80), title: text(item.title, defaultResearchInvitationContent.title, 60), introduction: text(item.introduction, defaultResearchInvitationContent.introduction, 320),
    cards: defaultResearchInvitationContent.cards.map((fallback, index) => { const card = rawCards[index]; return card && typeof card === "object" && !Array.isArray(card) ? { title: text((card as Record<string, unknown>).title, fallback.title, 80), description: text((card as Record<string, unknown>).description, fallback.description, 180) } : fallback; }),
    buttonLabel: text(item.buttonLabel, defaultResearchInvitationContent.buttonLabel, 24),
  };
}

export async function getResearchInvitationContent(): Promise<ResearchInvitationContent> {
  const cloud = await readCloudSetting<unknown>(settingKey);
  if (cloud !== undefined) return cloud ? readContent(cloud) : defaultResearchInvitationContent;
  const setting = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
  return setting ? readContent(setting.value) : defaultResearchInvitationContent;
}

export async function saveResearchInvitationContent(value: unknown): Promise<ResearchInvitationContent> {
  const content = readContent(value);
  if (await writeCloudSetting(settingKey, content)) return content;
  await prisma.siteSetting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: content }, update: { value: content } });
  return content;
}
