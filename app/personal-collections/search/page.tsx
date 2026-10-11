import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyPublicCollectionSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const current = await searchParams;
  const params = new URLSearchParams();
  const q = current.q?.trim().slice(0, 100);
  if (q) params.set("q", q);
  if (current.type === "BOOK" || current.type === "ARTIFACT") params.set("type", current.type);
  const itemPage = Number.parseInt(current.page ?? "1", 10);
  if (Number.isFinite(itemPage) && itemPage > 1) params.set("itemPage", String(itemPage));
  const query = params.toString();
  redirect(`/personal-collections${query ? `?${query}` : ""}#public-items`);
}
