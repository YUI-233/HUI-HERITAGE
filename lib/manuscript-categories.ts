export type ResourceCategoryNode = { name: string; note?: string; children?: ResourceCategoryNode[] };

// Source of truth: 用户提供的《资源分类.docx》三级分类表。
export const manuscriptCategoryTree: ResourceCategoryNode[] = [
  { name: "一、经训", children: [{ name: "1.1古兰学", children: [{ name: "1.1.1古兰经翻译、注解" }, { name: "1.1.2古兰经研究" }] }, { name: "1.2圣训学", children: [{ name: "1.2.1圣训翻译、注解" }, { name: "1.2.2圣训研究" }] }, { name: "1.3圣人传记", children: [{ name: "1.3.1穆圣生平" }, { name: "1.3.2赞圣诗歌" }] }] },
  { name: "二、教法", children: [{ name: "2.1教法教律", children: [{ name: "2.1.1法理学" }, { name: "2.1.2伊斯兰教法" }, { name: "2.1.3法学史及伊斯兰法研究" }] }, { name: "2.2礼制仪规（爱戴布）", children: [{ name: "2.2.1清真小学", note: "开理脉，三字经等" }, { name: "2.2.2杂学（礼制仪规）", note: "汉译杂学注解，亥听、四篇要道等" }] }] },
  { name: "三、教义", children: [{ name: "3.1逻辑学" }, { name: "3.2教义", children: [{ name: "3.2.1教义、认主学" }, { name: "3.2.2伊斯兰思想、哲学" }, { name: "3.2.3宗教对话与比较" }] }, { name: "3.3苏菲", children: [{ name: "3.3.1苏菲思想" }, { name: "3.3.2苏菲历史（道统史）" }] }, { name: "3.4劝喻警示", note: "宗教文学、修身劝诫" }] },
  { name: "四、语言", children: [{ name: "4.1阿拉伯语", children: [{ name: "4.1.1阿拉伯语法/字法/文法" }, { name: "4.1.2阿拉伯修辞" }] }, { name: "4.2波斯语" }, { name: "4.3经堂语与小儿锦", children: [{ name: "4.3.1小儿锦文献" }, { name: "4.3.2经堂语研究" }] }] },
  { name: "五、历史", children: [{ name: "5.1回教史", note: "诸如《清真教说》等，另外也含涉及到穆斯林的清史等史料" }, { name: "5.2人物传记" }, { name: "5.3回族家谱" }, { name: "5.4金石碑帖" }, { name: "5.5中西交通", note: "史地与民族及中西交通、边政关系" }] },
  { name: "六、历法医药", children: [{ name: "6.1回回历法" }, { name: "6.2回回医药" }] }, { name: "七、文献学", children: [{ name: "7.1汉文伊斯兰文献目录" }, { name: "7.2汉文伊斯兰著述研究" }] }, { name: "八、艺文", children: [{ name: "8.1文学" }, { name: "8.2艺术", note: "含书法等艺术" }, { name: "8.3音乐" }, { name: "8.4建筑" }] }, { name: "九、报刊杂志" }, { name: "十、学术研究" },
];
const selectable = (nodes: ResourceCategoryNode[]): string[] => nodes.flatMap((node) => node.children?.length ? selectable(node.children) : [node.name]);
export const manuscriptCategoryGroups = manuscriptCategoryTree.map((node) => ({ label: node.name, options: selectable(node.children?.length ? node.children : [node]) }));
export const manuscriptCategories = manuscriptCategoryGroups.flatMap((group) => group.options);
