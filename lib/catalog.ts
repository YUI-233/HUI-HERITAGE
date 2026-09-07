export type CatalogType = "manuscript" | "artifact";
export type CatalogMetadataField = { label: string; value: string };
export type CatalogDocument = { id: string; href: string; volumeNumber: number; label: string };

export type CatalogRecord = {
  id: string;
  catalogNumber?: string;
  title: string;
  type: CatalogType;
  summary: string;
  date: string;
  source: string;
  image: string;
  imageAccess: "member" | "public" | "none";
  images?: string[];
  memberImages?: string[];
  memberDocuments?: CatalogDocument[];
  metadata?: CatalogMetadataField[];
  keywords: string[];
};

export const catalogRecords: CatalogRecord[] = [
  { id: "qingzhen-shiyi", title: "《清真释疑》", type: "manuscript", summary: "以饮食、礼仪等主题阐释教义的汉文经堂文献。", date: "道光十六年（1836）", source: "成都清真寺藏版", image: "/private-media/manuscripts/qingzhen-shiyi-1836.jpg", imageAccess: "member", keywords: ["清真释疑", "道光", "成都", "经堂教育"] },
  { id: "qingzhen-shiyi-supplement", title: "《清真释疑补辑》", type: "manuscript", summary: "《清真释疑》的补辑刻本，保存有馆藏题记与版刻信息。", date: "光绪十一年", source: "成都清真寺藏版", image: "/private-media/manuscripts/qingzhen-shiyi-supplement.jpg", imageAccess: "member", keywords: ["清真释疑补辑", "光绪", "成都", "清真寺"] },
  { id: "guizhen-biyao", title: "《归真必要》", type: "manuscript", summary: "汉文伊斯兰经堂教育文献，现收录卷一第五篇页面。", date: "清代", source: "馆藏图像", image: "/private-media/manuscripts/guizhen-page.png", imageAccess: "member", keywords: ["归真必要", "经堂教育", "释遵道之实"] },
  { id: "five-duties", title: "《五功释义》", type: "manuscript", summary: "以五功为主题的汉文教义文献封面。", date: "近代", source: "馆藏封面", image: "/private-media/manuscripts/five-duties.png", imageAccess: "member", keywords: ["五功释义", "五功", "教义"] },
  { id: "arabic-manuscript", title: "阿拉伯文彩绘手抄本", type: "artifact", summary: "带有花卉装饰与经文书写的阿拉伯文手抄本页面。", date: "待考", source: "公开图像资料", image: "/collection/arabic-manuscript.png", imageAccess: "public", keywords: ["阿拉伯文", "手抄本", "经文", "彩绘"] },
  { id: "astronomy", title: "中阿天文学图册", type: "artifact", summary: "呈现中阿知识交流的天文图示与阿拉伯文说明。", date: "待考", source: "公开图像资料", image: "/collection/astronomy-open-book.png", imageAccess: "public", keywords: ["天文学", "阿拉伯文", "图册", "中阿交流"] },
];

export function searchCatalog(query = "", type?: string) {
  const terms = query
    .replace(/[《》〈〉「」『』“”"'，、；：]/g, " ")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return catalogRecords.filter((record) => {
    const matchesType = type !== "manuscript" && type !== "artifact" ? true : record.type === type;
    const haystack = [record.title, record.summary, record.date, record.source, ...record.keywords].join(" ").toLocaleLowerCase();
    return matchesType && terms.every((term) => haystack.includes(term));
  });
}
