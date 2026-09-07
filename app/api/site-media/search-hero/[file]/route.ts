import { readFile } from "node:fs/promises";
import path from "node:path";
import { cloudMedia, usesCloudRuntime } from "../../../../../lib/cloud-runtime";

const mimeTypes: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params; const match = /^([a-z0-9-]+)\.(jpg|jpeg|png|webp)$/i.exec(file);
  if (!match) return new Response("Not found", { status: 404 });
  if (usesCloudRuntime()) { const stored = await (await cloudMedia())!.get(`site/search-hero/${file}`); if (stored?.body) return new Response(stored.body, { headers: { "Content-Type": stored.httpMetadata?.contentType ?? mimeTypes[match[2].toLowerCase()], "Cache-Control": "public, max-age=3600" } }); }
  try { return new Response(await readFile(path.join(process.cwd(), "public", "site", "search-hero", file)), { headers: { "Content-Type": mimeTypes[match[2].toLowerCase()], "Cache-Control": "no-store" } }); } catch { return new Response("Not found", { status: 404 }); }
}
