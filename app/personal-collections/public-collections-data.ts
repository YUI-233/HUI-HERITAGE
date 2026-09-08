export type PublicCollectionCover = {
  itemId: string;
  mediaId: string;
  url: string;
} | null;

export type PublicCollectionSummary = {
  slug: string;
  name: string;
  ownerName: string;
  description: string;
  cover: PublicCollectionCover;
  bookCount: number;
  artifactCount: number;
  totalCount: number;
  updatedAt: string;
};

export type PublicCollectionItem = {
  id: string;
  type: "BOOK" | "ARTIFACT";
  title: string;
  creator: string | null;
  era: string | null;
  category: string | null;
  editionOrCategory: string | null;
  serialNumber: string;
  cover: PublicCollectionCover;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicCollectionsResponse = {
  items: PublicCollectionSummary[];
  pagination: Pagination;
};

export type PublicCollectionResponse = {
  collection: PublicCollectionSummary;
  items: PublicCollectionItem[];
  pagination: Pagination;
};

const mockCollections: PublicCollectionSummary[] = [{
  slug: "yan-jing-shu-she",
  name: "岩境書舍",
  ownerName: "岩境書舍",
  description: "收藏清代至民国时期的汉文回教古籍，涵盖经训、法理、思想与语言等方向。",
  cover: {
    itemId: "efd272ed-eaa7-46cc-93c0-5fb34a5f08dc",
    mediaId: "cmrot47id00u5688g9mmlydwx",
    url: "/api/personal-collection/public/efd272ed-eaa7-46cc-93c0-5fb34a5f08dc/media/cmrot47id00u5688g9mmlydwx",
  },
  bookCount: 15,
  artifactCount: 0,
  totalCount: 15,
  updatedAt: "2026-09-07T10:00:00.000Z",
}];

const mockItemsByCollection: Record<string, PublicCollectionItem[]> = {
  "yan-jing-shu-she": [
    {
      id: "efd272ed-eaa7-46cc-93c0-5fb34a5f08dc", type: "BOOK", title: "古兰经译解", creator: "王静斋", era: "民国",
      category: "古兰经翻译、注解", editionOrCategory: "永祥印书馆", serialNumber: "PC-0069",
      cover: { itemId: "efd272ed-eaa7-46cc-93c0-5fb34a5f08dc", mediaId: "cmrot47id00u5688g9mmlydwx", url: "/api/personal-collection/public/efd272ed-eaa7-46cc-93c0-5fb34a5f08dc/media/cmrot47id00u5688g9mmlydwx" },
    },
    {
      id: "bf1269ff-7909-4e75-8a76-e749e891ca87", type: "BOOK", title: "圣谕详解", creator: "李廷相", era: "民国",
      category: "圣训翻译、注解", editionOrCategory: "天津光明书社", serialNumber: "PC-0071",
      cover: { itemId: "bf1269ff-7909-4e75-8a76-e749e891ca87", mediaId: "cmrotciwn00uh688gdmwjn39s", url: "/api/personal-collection/public/bf1269ff-7909-4e75-8a76-e749e891ca87/media/cmrotciwn00uh688gdmwjn39s" },
    },
    {
      id: "102b13d6-1c14-407f-b01c-5ff745d800a9", type: "BOOK", title: "大化总归", creator: "马德新、马开科", era: "清",
      category: "法理学", editionOrCategory: "木刻本", serialNumber: "PC-0014",
      cover: { itemId: "102b13d6-1c14-407f-b01c-5ff745d800a9", mediaId: "cmroqfrwy00se688gyf6rs86v", url: "/api/personal-collection/public/102b13d6-1c14-407f-b01c-5ff745d800a9/media/cmroqfrwy00se688gyf6rs86v" },
    },
    {
      id: "ced10ec1-db24-49f0-a2ac-1f0b78821b05", type: "BOOK", title: "天方字母解义", creator: "刘智", era: "清",
      category: "阿拉伯语法／字法／文法", editionOrCategory: "木刻本", serialNumber: "PC-0017",
      cover: { itemId: "ced10ec1-db24-49f0-a2ac-1f0b78821b05", mediaId: "cmrln3a370009681sfcuy75bl", url: "/api/personal-collection/public/ced10ec1-db24-49f0-a2ac-1f0b78821b05/media/cmrln3a370009681sfcuy75bl" },
    },
    { id: "2db38015-8a78-44df-9b17-4ed191834b52", type: "BOOK", title: "教款捷要", creator: "马伯良", era: "清", category: "伊斯兰教法", editionOrCategory: "木刻本", serialNumber: "PC-0013", cover: null },
    { id: "e8ab73d0-9f51-462c-9e8d-c46429141683", type: "BOOK", title: "汉译道行究竟", creator: "马德新", era: "清", category: "法理学", editionOrCategory: "木刻本", serialNumber: "PC-0015", cover: null },
    { id: "967b2f5f-2422-4765-93c9-8ca74875f528", type: "BOOK", title: "清真指南", creator: "马注", era: "清", category: "伊斯兰思想、哲学", editionOrCategory: "木刻本", serialNumber: "PC-0005", cover: null },
    { id: "c9b1ba40-ea69-4430-b5c8-3f04d5ce1735", type: "BOOK", title: "清真释疑补辑", creator: "金天柱", era: "清", category: "宗教对话与比较", editionOrCategory: "刻本", serialNumber: "PC-0009", cover: null },
  ],
};

export async function getPublicCollections({ q = "", page = 1, limit = 12 }: { q?: string; page?: number; limit?: number } = {}): Promise<PublicCollectionsResponse> {
  // TODO(api): replace the in-memory source with GET /api/personal-collections once the backend endpoint is available.
  const term = q.trim().toLocaleLowerCase();
  const filtered = mockCollections.filter((collection) =>
    !term || `${collection.name} ${collection.ownerName}`.toLocaleLowerCase().includes(term),
  );
  const safeLimit = Math.max(1, Math.min(24, limit));
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * safeLimit;
  return {
    items: filtered.slice(start, start + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: filtered.length, totalPages },
  };
}

export async function getPublicCollection(slug: string, { type, q = "", page = 1, limit = 24 }: { type?: "BOOK" | "ARTIFACT"; q?: string; page?: number; limit?: number } = {}): Promise<PublicCollectionResponse | null> {
  // TODO(api): replace the in-memory source with GET /api/personal-collections/:slug once the backend endpoint is available.
  const collection = mockCollections.find((item) => item.slug === slug);
  if (!collection) return null;
  const term = q.trim().toLocaleLowerCase();
  const filtered = (mockItemsByCollection[slug] ?? []).filter((item) => {
    const searchable = [item.title, item.creator, item.era, item.category, item.editionOrCategory, item.serialNumber].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!type || item.type === type) && (!term || searchable.includes(term));
  });
  const safeLimit = Math.max(1, Math.min(48, limit));
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * safeLimit;
  return {
    collection,
    items: filtered.slice(start, start + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: filtered.length, totalPages },
  };
}
