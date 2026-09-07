import { readStoredMedia } from "../../../../lib/media-storage";

const fileName = /^[0-9a-f-]{36}\.(?:jpg|png|webp|gif)$/i;
const mimeTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!fileName.test(file)) return new Response("Not found", { status: 404 });
  const stored = await readStoredMedia(`research/images/${file}`);
  if (!stored) return new Response("Not found", { status: 404 });
  const extension = file.split(".").pop()!.toLowerCase();
  return new Response(stored.body as unknown as BodyInit, { headers: { "Content-Type": stored.contentType ?? mimeTypes[extension], "Cache-Control": "public, max-age=31536000, immutable" } });
}
