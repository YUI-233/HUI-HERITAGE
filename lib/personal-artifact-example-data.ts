export type PersonalArtifactExample = {
  title: string;
  category: string;
  collection: string | null;
  creator: string;
  era: string;
  description: string;
  url: string;
  source: string;
};

const metSource = "https://www.metmuseum.org/art/collection";
const sources = [
  { image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/453024/882518/main-image", page: `${metSource}/search/453024` },
  { image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/453274/906605/main-image", page: `${metSource}/search/453274` },
  { image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/452032/881166/main-image", page: `${metSource}/search/452032` },
  { image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/449423/897322/main-image", page: `${metSource}/search/449423` },
];

type ExampleGroup = {
  category: string;
  collection: string | null;
  era: string;
  labels: string[];
  description: string;
  imageOffset: number;
};

const groups: ExampleGroup[] = [
  {
    category: "手稿", collection: "纸上遗珍", era: "1851–1852", imageOffset: 0,
    labels: ["奥斯曼古兰经手稿", "经文校勘页", "馆藏抄本卷首", "经注手稿残页", "阿拉伯文祈祷册", "经堂教育笔记", "写本目录页", "朱批抄本"],
    description: "开放馆藏手稿示例，用于测试个人藏品浏览、图文信息与方块版式。",
  },
  {
    category: "器皿", collection: "器物雅集", era: "11–13 世纪", imageOffset: 2,
    labels: ["镂空签名碗", "刻花纹饰碗", "青釉小盏", "铜制水器", "彩绘陶盘", "釉下彩瓶", "铭文香炉", "纹样盖盒"],
    description: "开放馆藏器物示例，用于测试器物图片比例、来源与说明信息。",
  },
  {
    category: "碑帖", collection: "墨迹流光", era: "1664–1665", imageOffset: 1,
    labels: ["书法页", "经文碑刻拓片", "清真寺题记", "阿拉伯文行草", "波斯文题签", "碑铭残拓", "经堂楹联拓片", "祈祷文书法"],
    description: "开放馆藏碑帖与书法示例，用于测试文字类藏品的图像墙展示。",
  },
  {
    category: "书画", collection: null, era: "近世", imageOffset: 1,
    labels: ["纹样与绘画", "花卉书画册页", "清真寺建筑图", "山水设色小品", "经文装饰画", "人物肖像习作", "金彩边饰画页", "庭院写生稿"],
    description: "开放馆藏书画示例，用于测试绘画类藏品的缩略图与说明布局。",
  },
  {
    category: "纺织品", collection: null, era: "中世纪", imageOffset: 0,
    labels: ["织锦纹样", "金线织带", "几何纹织片", "花卉纹挂毯", "刺绣边饰", "礼拜毯局部", "纹样锦片", "染织残片"],
    description: "开放馆藏纺织品示例，用于测试纵向图像与材质说明的展示效果。",
  },
  {
    category: "照片", collection: null, era: "近世", imageOffset: 3,
    labels: ["馆藏图像", "书斋旧影", "器物陈列照", "拓片工作照", "古籍装帧记录", "建筑细部照片", "藏品修复前影像", "研究现场照片"],
    description: "开放馆藏图像示例，用于测试照片类内容的瀑布式方块浏览。",
  },
];

export const personalArtifactExamples: PersonalArtifactExample[] = groups.flatMap((group) =>
  group.labels.map((label, index) => {
    const source = sources[(group.imageOffset + index) % sources.length];
    return {
      title: `示例｜${label}`,
      category: group.category,
      collection: group.collection,
      creator: "大都会艺术博物馆开放馆藏",
      era: group.era,
      description: `${group.description}（第 ${index + 1} 件）`,
      url: source.image,
      source: source.page,
    };
  }),
);

export const personalArtifactFeatureSets = [
  { title: "纸上遗珍", description: "8 件手稿与写本", collection: "纸上遗珍", image: personalArtifactExamples[0].url },
  { title: "器物雅集", description: "8 件器物与日常器用", collection: "器物雅集", image: personalArtifactExamples[8].url },
  { title: "墨迹流光", description: "8 件碑帖与书法", collection: "墨迹流光", image: personalArtifactExamples[16].url },
] as const;
