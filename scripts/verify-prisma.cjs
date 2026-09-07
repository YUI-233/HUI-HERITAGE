const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [books, artifacts, media, holdings, researchArticles, domesticHolding] = await Promise.all([
    prisma.book.count(),
    prisma.artifact.count(),
    prisma.mediaAsset.count(),
    prisma.holding.count({ where: { status: "APPROVED" } }),
    prisma.researchArticle.count({ where: { status: "APPROVED" } }),
    prisma.holding.findFirst({
      where: { origin: "DOMESTIC", status: "APPROVED" },
      include: { book: { select: { title: true } }, artifact: { select: { title: true } } },
    }),
  ]);
  if (!domesticHolding || (!domesticHolding.book && !domesticHolding.artifact)) {
    throw new Error("An approved holding must resolve to a catalogue record.");
  }
  console.log(`prisma_counts=books:${books},artifacts:${artifacts},media:${media},approved_holdings:${holdings},approved_research:${researchArticles}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
