import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { prisma } from "../lib/prisma";

const librarySearchSources = new Set(["馆藏记录最新模板导入", "海外藏馆 CSV 审核导入"]);
const outputPath = process.env.HUI_CLOUD_EXPORT_PATH
  ? path.resolve(process.env.HUI_CLOUD_EXPORT_PATH)
  : path.resolve("work", "cloud-public-data.json");

const asJson = (value: unknown) => JSON.stringify(value ?? []);
const stamp = (value: Date) => value.toISOString();

async function main() {
  const [books, artifacts, holdings, researchArticles, settings] = await Promise.all([
    prisma.book.findMany({
      where: { status: "APPROVED", OR: [{ source: null }, { source: { notIn: [...librarySearchSources] } }] },
      include: { media: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.artifact.findMany({ where: { status: "APPROVED" }, include: { media: { orderBy: { createdAt: "asc" } } } }),
    prisma.holding.findMany({ where: { status: "APPROVED" }, include: { book: true, artifact: true } }),
    prisma.researchArticle.findMany({ where: { status: "APPROVED" } }),
    prisma.siteSetting.findMany(),
  ]);

  const catalogRecords = [
    ...books.map((book) => ({
      id: book.id,
      type: "manuscript",
      catalogNumber: book.catalogNumber,
      title: book.title,
      language: book.language,
      author: book.author,
      era: book.publicationDate ?? book.eraDetail ?? book.dynasty,
      category: asJson(book.categories),
      material: null,
      description: book.description,
      source: book.source,
      status: book.status,
      keywordsJson: asJson(book.keywords),
      metadataJson: asJson([
        ["分类", book.categories.join("；")], ["语言", book.language], ["作者", book.author], ["年代", book.dynasty],
        ["刊刻年份", book.eraDetail], ["刊刻时间", book.publicationDate], ["刊刻主体", book.imprintPublisher],
        ["版本类型", book.versionType], ["装帧", book.binding], ["册数", String(book.volumeCount)],
      ].filter(([, value]) => Boolean(value)).map(([label, value]) => ({ label, value }))),
      createdAt: stamp(book.createdAt),
      updatedAt: stamp(book.updatedAt),
    })),
    ...artifacts.map((artifact) => ({
      id: artifact.id,
      type: "artifact",
      catalogNumber: artifact.catalogNumber,
      title: artifact.title,
      language: null,
      author: null,
      era: artifact.era,
      category: artifact.category,
      material: artifact.material,
      description: artifact.description,
      source: artifact.source,
      status: artifact.status,
      keywordsJson: asJson(artifact.keywords),
      metadataJson: asJson([["类别", artifact.category], ["年代", artifact.era], ["材质", artifact.material]]
        .filter(([, value]) => Boolean(value)).map(([label, value]) => ({ label, value }))),
      createdAt: stamp(artifact.createdAt),
      updatedAt: stamp(artifact.updatedAt),
    })),
  ];

  const mediaAssets = [...books, ...artifacts].flatMap((record) => record.media.map((media, sortOrder) => {
    const normalSourcePath = media.storageKey.startsWith("private/") ? path.join("uploads", media.storageKey) : path.join("public", media.storageKey);
    const stagedSourcePath = path.join("uploads", "migration-staging", media.storageKey);
    return ({
    id: media.id,
    recordId: record.id,
    storageKey: media.storageKey,
    mimeType: media.mimeType,
    visibility: media.visibility,
    sortOrder,
    createdAt: stamp(media.createdAt),
    sourcePath: existsSync(normalSourcePath) ? normalSourcePath : stagedSourcePath,
  }); }));

  const payload = {
    generatedAt: new Date().toISOString(),
    catalogRecords,
    holdings: holdings.filter((holding) => holding.book || holding.artifact).map((holding) => ({
      id: holding.id,
      recordId: holding.bookId ?? holding.artifactId!,
      recordType: holding.bookId ? "manuscript" : "artifact",
      recordJson: JSON.stringify(holding.book ? {
        title: holding.book.title,
        author: holding.book.author,
        era: holding.book.dynasty,
        eraDetail: holding.book.eraDetail,
        publicationDate: holding.book.publicationDate,
        imprintPublisher: holding.book.imprintPublisher,
        versionType: holding.book.versionType,
        binding: holding.book.binding,
        volumeCount: holding.book.volumeCount,
        category: holding.book.categories[0] ?? null,
      } : {
        title: holding.artifact!.title,
        era: holding.artifact!.era,
        versionType: holding.artifact!.material,
        category: holding.artifact!.category,
      }),
      institution: holding.institution,
      region: holding.region,
      origin: holding.origin,
      callNumber: holding.callNumber,
      catalogUrl: holding.catalogUrl,
      description: holding.description,
      status: holding.status,
      createdAt: stamp(holding.createdAt),
      updatedAt: stamp(holding.updatedAt),
    })),
    researchArticles: researchArticles.map((article) => ({
      id: article.id,
      title: article.title,
      author: article.author,
      affiliation: article.affiliation,
      publication: article.publication,
      publishedYear: article.publishedYear,
      volumeIssue: article.volumeIssue,
      pages: article.pages,
      identifier: article.identifier,
      summary: article.summary,
      contentHtml: article.contentHtml,
      category: article.category,
      status: article.status,
      keywordsJson: asJson(article.keywords),
      relatedRecordIdsJson: asJson(article.relatedRecordIds),
      createdAt: stamp(article.createdAt),
      updatedAt: stamp(article.updatedAt),
    })),
    mediaAssets,
    siteSettings: settings.map((setting) => ({ key: setting.key, valueJson: JSON.stringify(setting.value), updatedAt: stamp(setting.updatedAt) })),
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Exported ${catalogRecords.length} catalogue records, ${holdings.length} holdings and ${mediaAssets.length} media manifests to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
