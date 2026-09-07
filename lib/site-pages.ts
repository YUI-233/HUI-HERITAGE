import { prisma } from "./prisma";
import { readCloudSetting, writeCloudSetting } from "./cloud-settings";

export const sitePageSlugs = ["about", "support", "terms", "privacy", "site-notice", "contact"] as const;
export type SitePageSlug = typeof sitePageSlugs[number];
export type SitePage = { title: string; intro: string; body: string; backgroundImagePath: string; backgroundPositionX: number; backgroundPositionY: number; textTone: "dark" | "light"; overlayTone: "none" | "light" | "dark"; overlayOpacity: number };
export type SitePagesContent = { footerTitle: string; footerDescription: string; footerBackgroundImagePath: string; footerBackgroundPositionX: number; footerBackgroundPositionY: number; pages: Record<SitePageSlug, SitePage> };

const legacyBodies: Record<SitePageSlug, string> = {
  about: "HUI HERITAGE 是面向汉文回教古籍、文物与相关文献图像的数字整理计划。我们希望以严谨的记录、开放的协作与持续的研究，让珍贵文化遗产被看见、理解并延续。",
  support: "我们欢迎共同开展学术研究、完善全球图书馆古籍线索、协助古籍扫描，以及梳理民间馆藏。无论您拥有研究专长、馆藏信息、数字化能力或志愿服务意愿，都可以与我们联系。",
  terms: "网站内容用于学习、研究与文化交流。请在使用资料时保留来源信息，并遵守适用的版权、隐私与馆藏访问规则。",
  privacy: "我们仅在提供网站服务、回应联系请求及维护平台安全所必需的范围内处理信息，不会出售您的个人信息。",
  "site-notice": "本站记录会随着研究、整理与审核持续更新。部分图像及资料可能受馆藏机构、版权或访问权限限制，请以页面标注为准。",
  contact: "如有合作、研究、馆藏线索、古籍扫描或民间馆藏相关事宜，请发送邮件至 huiheritage@gmail.com。我们会尽快回复。",
};

const expandedBodies: Record<SitePageSlug, string> = {
  about: "HUI HERITAGE 是一个面向汉文回教古籍、文物与相关文献图像的数字整理计划。我们关注散见于公共图书馆、研究机构与民间收藏中的历史资料，希望通过持续记录、整理与研究，让这些文化遗产重新被看见。\n\n我们的工作包括建立可追溯的数字目录、补充版本与馆藏线索、推动珍贵资料数字化，并为学术研究与公众理解提供可靠基础。每一条资料都会随着新的发现和考证持续修订。\n\nHUI HERITAGE 相信文化遗产的保护离不开开放协作。我们期待与学者、收藏者、图书馆、文化机构及志愿者共同工作，让知识得到更长久、更有秩序的保存与传播。",
  support: "HUI HERITAGE 欢迎学者、研究者、图书馆、文化机构、收藏者与志愿者参与。合作可以从一条书目线索、一次版本核对或一份馆藏信息开始，也可以发展为长期的专题研究与数字化项目。\n\n当前重点工作包括汉文回教古籍的整理与释读、全球图书馆古籍线索完善、古籍扫描与图像整理，以及民间馆藏的调查和记录。我们也欢迎具备文献学、历史学、语言、摄影、数据整理与技术能力的参与者。\n\n如果您希望提供资料、发起研究合作、协助数字化，或以志愿者身份加入，请通过“联系我们”页面与我们取得联系。我们会根据资料状况、版权与公开条件共同商议合适的合作方式。",
  terms: "本网站提供的目录、文字、图片与研究内容主要用于学习、研究和文化交流。访问或使用网站，即表示您同意尊重资料来源、作者权益、馆藏机构要求及相关法律规定。\n\n未经明确授权，请勿批量下载、复制、重新发布或用于商业用途。引用本站资料时，建议注明页面名称、HUI HERITAGE、原始馆藏来源及访问日期；第三方资料仍适用其原有版权和使用条件。\n\n我们会努力保持资料准确与服务稳定，但历史记录可能随着研究进展而修订。若您发现错误、权属问题或不适宜公开的内容，请联系我们核实处理。",
  privacy: "HUI HERITAGE 重视访问者与参与者的隐私。我们只会在提供账号服务、回应联系请求、处理资料提交和维护网站安全所必需的范围内收集与使用信息。\n\n可能涉及的信息包括您主动提供的姓名、邮箱、机构、馆藏说明及提交记录。我们不会出售个人信息，也不会在未经许可的情况下公开私人联系方式；法律要求或保障平台安全的情形除外。\n\n您可以联系我们查询、更正或申请删除由您提交的个人信息。随着网站功能调整，本政策可能更新，重要变化会在本页面说明。",
  "site-notice": "HUI HERITAGE 的目录和研究资料会随着整理、审核与新发现持续更新。页面所列年代、作者、版本、馆藏机构及说明可能仍处于考证阶段，重要研究或引用请同时核对原始文献和馆藏机构记录。\n\n部分图像与全文资料受到版权、捐赠协议、馆藏规定或会员权限限制。页面能够被检索并不表示其中所有图像都可自由复制或再次发布，具体使用条件以相应资料页标注为准。\n\n本站可能收录由合作机构、研究者和公众提供的线索。若您发现资料错误、重复记录、来源遗漏或权利问题，欢迎联系我们并提供可核实的信息。",
  contact: "如需咨询学术研究、馆藏线索、古籍扫描、民间馆藏整理或机构合作，欢迎发送邮件至 huiheritage@gmail.com。请在邮件中简要说明您的姓名或机构、联系事项及相关资料。\n\n若您希望提供古籍或文物线索，可尽量附上题名、年代、收藏地点、尺寸或册数，以及能够说明情况的图片。涉及私人收藏的信息会在沟通确认后再决定是否公开。\n\n我们也欢迎志愿者来信介绍自己的研究方向、语言能力、数据整理或数字化经验。收到邮件后，我们会根据事项内容尽快回复。",
};

const defaults: SitePagesContent = {
  footerTitle: "守护文化记忆，促进理解与共生。",
  footerDescription: "HUI HERITAGE 致力于汉文回教文化遗产的数字化保护、研究与传播，让历史资源转化为当代知识与未来的可能。",
  footerBackgroundImagePath: "/site/footer-mountains.png",
  footerBackgroundPositionX: 50,
  footerBackgroundPositionY: 0,
  pages: {
    about: { title: "关于我们", intro: "了解 HUI HERITAGE 的使命、工作方法与长期愿景。", body: expandedBodies.about, backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
    support: { title: "合作和支持", intro: "欢迎学者、机构、馆藏单位、收藏者与志愿者共同参与。", body: expandedBodies.support, backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
    terms: { title: "使用条款", intro: "使用本网站及相关资料前，请阅读以下基本约定。", body: expandedBodies.terms, backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
    privacy: { title: "隐私政策", intro: "我们重视您的个人信息，并以必要、谨慎的方式进行处理。", body: expandedBodies.privacy, backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
    "site-notice": { title: "网站说明", intro: "关于资料准确性、图像访问与内容更新范围的说明。", body: expandedBodies["site-notice"], backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
    contact: { title: "联系我们", intro: "欢迎就研究、合作、馆藏线索与志愿参与和我们联系。", body: expandedBodies.contact, backgroundImagePath: "/site/page-header-building.png", backgroundPositionX: 50, backgroundPositionY: 50, textTone: "dark", overlayTone: "none", overlayOpacity: 0 },
  },
};

const text = (value: unknown, fallback: string, max = 4000) => typeof value === "string" ? value.trim().slice(0, max) || fallback : fallback;
const imagePath = (value: unknown, fallback: string) => typeof value === "string" && /^\/[a-zA-Z0-9/_\-.]+$/.test(value) ? value : fallback;
const percentage = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
const textTone = (value: unknown, fallback: SitePage["textTone"]): SitePage["textTone"] => value === "light" || value === "dark" ? value : fallback;
const overlayTone = (value: unknown, fallback: SitePage["overlayTone"]): SitePage["overlayTone"] => value === "none" || value === "light" || value === "dark" ? value : fallback;

function read(value: unknown): SitePagesContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const source = value as Record<string, unknown>;
  const sourcePages = source.pages && typeof source.pages === "object" ? source.pages as Record<string, unknown> : {};
  return {
    footerTitle: text(source.footerTitle, defaults.footerTitle, 120),
    footerDescription: text(source.footerDescription, defaults.footerDescription, 500),
    footerBackgroundImagePath: imagePath(source.footerBackgroundImagePath, defaults.footerBackgroundImagePath),
    footerBackgroundPositionX: percentage(source.footerBackgroundPositionX, defaults.footerBackgroundPositionX),
    footerBackgroundPositionY: percentage(source.footerBackgroundPositionY, defaults.footerBackgroundPositionY),
    pages: Object.fromEntries(sitePageSlugs.map((slug) => {
      const item = sourcePages[slug] && typeof sourcePages[slug] === "object" ? sourcePages[slug] as Record<string, unknown> : {};
      const base = defaults.pages[slug];
      const savedBody = text(item.body, base.body);
      return [slug, {
        title: text(item.title, base.title, 80),
        intro: text(item.intro, base.intro, 300),
        body: savedBody === legacyBodies[slug] ? expandedBodies[slug] : savedBody,
        backgroundImagePath: imagePath(item.backgroundImagePath, base.backgroundImagePath),
        backgroundPositionX: percentage(item.backgroundPositionX, base.backgroundPositionX),
        backgroundPositionY: percentage(item.backgroundPositionY, base.backgroundPositionY),
        textTone: textTone(item.textTone, base.textTone),
        overlayTone: overlayTone(item.overlayTone, base.overlayTone),
        overlayOpacity: percentage(item.overlayOpacity, base.overlayOpacity),
      }];
    })) as Record<SitePageSlug, SitePage>,
  };
}

export async function getSitePagesContent() {
  const cloud = await readCloudSetting<unknown>("site_pages");
  if (cloud !== undefined) return cloud ? read(cloud) : defaults;
  const setting = await prisma.siteSetting.findUnique({ where: { key: "site_pages" } });
  return setting ? read(setting.value) : defaults;
}

export async function saveSitePagesContent(value: unknown) {
  const content = read(value);
  if (await writeCloudSetting("site_pages", content)) return content;
  await prisma.siteSetting.upsert({ where: { key: "site_pages" }, create: { key: "site_pages", value: content }, update: { value: content } });
  return content;
}
