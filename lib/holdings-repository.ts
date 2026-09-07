import { prisma } from "./prisma";
import { readCloudHoldings } from "./cloud-holdings-reader";
import type { Prisma } from "@prisma/client";

export type HoldingOrigin = "DOMESTIC" | "OVERSEAS" | "PERSONAL";

export type HoldingRecord = {
  id: string;
  institution: string;
  region: string;
  origin: HoldingOrigin;
  callNumber: string | null;
  catalogUrl: string | null;
  description: string | null;
  record: {
    id: string;
    title: string;
    type: "manuscript" | "artifact" | "personal-book" | "personal-artifact";
    author?: string | null;
    era?: string | null;
    eraDetail?: string | null;
    publicationDate?: string | null;
    imprintPublisher?: string | null;
    versionType?: string | null;
    binding?: string | null;
    volumeCount?: number | null;
    category?: string | null;
  };
};

export type HoldingQuery = { query?: string; origin?: string; region?: string };

type HoldingWithRecord = Prisma.HoldingGetPayload<{
  include: {
    book: { select: { id: true; title: true; author: true; dynasty: true; eraDetail: true; publicationDate: true; imprintPublisher: true; versionType: true; binding: true; volumeCount: true } };
    artifact: { select: { id: true; title: true; category: true; era: true; material: true } };
  };
}>;

type PersonalPublicItem = Prisma.PersonalCollectionItemGetPayload<{
  include: { owner: { select: { displayName: true; email: true } } };
}>;

function normalizeHolding(holding: HoldingWithRecord): HoldingRecord {
  const record = holding.book
    ? {
        id: holding.book.id,
        title: holding.book.title,
        type: "manuscript" as const,
        author: holding.book.author,
        era: holding.book.dynasty,
        eraDetail: holding.book.eraDetail,
        publicationDate: holding.book.publicationDate,
        imprintPublisher: holding.book.imprintPublisher,
        versionType: holding.book.versionType,
        binding: holding.book.binding,
        volumeCount: holding.book.volumeCount,
      }
    : {
        id: holding.artifact!.id,
        title: holding.artifact!.title,
        type: "artifact" as const,
        era: holding.artifact!.era,
        versionType: holding.artifact!.material,
        category: holding.artifact!.category,
      };
  return {
    id: holding.id,
    institution: holding.institution,
    region: holding.region,
    origin: holding.origin,
    callNumber: holding.callNumber,
    catalogUrl: holding.catalogUrl,
    description: holding.description,
    record,
  };
}

function normalizePersonalHolding(item: PersonalPublicItem): HoldingRecord {
  const collector = item.owner.displayName?.trim() || item.owner.email;
  return {
    id: `personal-${item.id}`,
    institution: `个人收藏 · ${collector}`,
    region: "个人收藏",
    origin: "PERSONAL",
    callNumber: item.serialNumber,
    catalogUrl: null,
    description: item.description,
    record: {
      id: item.id,
      title: item.title,
      type: item.type === "BOOK" ? "personal-book" : "personal-artifact",
      author: item.creator,
      era: item.era,
      eraDetail: item.eraDetail,
      publicationDate: item.publicationDate,
      imprintPublisher: item.imprintPublisher,
      versionType: item.editionOrCategory,
      binding: item.binding,
      volumeCount: item.volumeCount,
      category: item.type === "ARTIFACT" ? item.editionOrCategory : item.categories[0],
    },
  };
}

export async function listHoldings({ query = "", origin, region }: HoldingQuery = {}): Promise<HoldingRecord[]> {
  const cloudHoldings = await readCloudHoldings();
  if (cloudHoldings) {
    const term = query.trim().toLocaleLowerCase();
    return cloudHoldings.filter((holding) => (!origin || holding.origin === origin) && (!region || holding.region === region) && (!term || [holding.institution, holding.region, holding.callNumber, holding.description, holding.record.title, holding.record.author, holding.record.era].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)));
  }
  const [holdings, personalItems] = await Promise.all([
    prisma.holding.findMany({
      where: { status: "APPROVED" },
      include: {
        book: { select: { id: true, title: true, author: true, dynasty: true, eraDetail: true, publicationDate: true, imprintPublisher: true, versionType: true, binding: true, volumeCount: true } },
        artifact: { select: { id: true, title: true, category: true, era: true, material: true } },
      },
      orderBy: [{ institution: "asc" }, { id: "asc" }],
    }),
    prisma.personalCollectionItem.findMany({
      where: { status: "APPROVED", isPublic: true },
      include: { owner: { select: { displayName: true, email: true } } },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }),
  ]);
  const term = query.trim().toLocaleLowerCase();
  return [...holdings.map(normalizeHolding), ...personalItems.map(normalizePersonalHolding)].filter((holding) => {
    const searchable = [holding.institution, holding.region, holding.callNumber, holding.description, holding.record.title, holding.record.author, holding.record.era, holding.record.eraDetail, holding.record.publicationDate, holding.record.imprintPublisher, holding.record.versionType].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!origin || holding.origin === origin) && (!region || holding.region === region) && (!term || searchable.includes(term));
  });
}

export async function listHoldingsForCatalogRecord(recordId: string): Promise<HoldingRecord[]> {
  const cloudHoldings = await readCloudHoldings();
  if (cloudHoldings) return cloudHoldings.filter((holding) => holding.record.id === recordId);
  const holdings = await prisma.holding.findMany({
    where: { status: "APPROVED", OR: [{ bookId: recordId }, { artifactId: recordId }] },
    include: {
      book: { select: { id: true, title: true, author: true, dynasty: true, eraDetail: true, publicationDate: true, imprintPublisher: true, versionType: true, binding: true, volumeCount: true } },
      artifact: { select: { id: true, title: true, category: true, era: true, material: true } },
    },
    orderBy: [{ institution: "asc" }, { id: "asc" }],
  });
  return holdings.map(normalizeHolding);
}

export async function getHoldingById(id: string): Promise<HoldingRecord | null> {
  const cloudHoldings = await readCloudHoldings();
  if (cloudHoldings) return cloudHoldings.find((holding) => holding.id === id) ?? null;
  const holding = await prisma.holding.findFirst({
    where: { id, status: "APPROVED" },
    include: {
      book: { select: { id: true, title: true, author: true, dynasty: true, eraDetail: true, publicationDate: true, imprintPublisher: true, versionType: true, binding: true, volumeCount: true } },
      artifact: { select: { id: true, title: true, category: true, era: true, material: true } },
    },
  });
  return holding ? normalizeHolding(holding) : null;
}

export function isHoldingOrigin(value: string | undefined): value is HoldingOrigin {
  return value === "DOMESTIC" || value === "OVERSEAS" || value === "PERSONAL";
}
