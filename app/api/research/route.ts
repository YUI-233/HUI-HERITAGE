import { listResearchArticles } from "../../../lib/research-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const articles = await listResearchArticles({
    query: url.searchParams.get("q") ?? "",
    category: url.searchParams.get("category") ?? undefined,
  });
  return Response.json({ total: articles.length, records: articles }, { headers: { "Cache-Control": "no-store" } });
}
