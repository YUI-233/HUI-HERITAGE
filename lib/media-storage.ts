import { cloudMedia, usesCloudRuntime } from "./cloud-runtime";

export type StoredMedia = { body: Uint8Array | ReadableStream<Uint8Array>; contentType?: string };
export type StoredMediaRange = { body: ReadableStream<Uint8Array>; size: number; start: number; end: number };

function localPath(storageKey: string) {
  // Keep each local fallback rooted in a statically known directory so Next's
  // file tracer never treats the whole project as deployable media.
  return storageKey.startsWith("private/")
    ? `${process.cwd()}/uploads/${storageKey}`
    : `${process.cwd()}/public/${storageKey}`;
}

function stagedLocalPath(storageKey: string) {
  return `${process.cwd()}/uploads/migration-staging/${storageKey}`;
}

export async function readStoredMedia(storageKey: string): Promise<StoredMedia | null> {
  if (usesCloudRuntime()) {
    const object = await (await cloudMedia())!.get(storageKey);
    return object?.body ? { body: object.body, contentType: object.httpMetadata?.contentType } : null;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    return { body: await readFile(localPath(storageKey)) };
  } catch {
    if (storageKey.startsWith("private/")) return null;
    try {
      const { readFile } = await import("node:fs/promises");
      return { body: await readFile(stagedLocalPath(storageKey)) };
    } catch { return null; }
  }
}

/**
 * Streams a local media file (or a byte range of it) without first loading the
 * entire file into the application process. PDF.js uses this for fast first-page
 * rendering and on-demand page fetching.
 */
export async function readLocalStoredMediaRange(storageKey: string, start = 0, end?: number): Promise<StoredMediaRange | null> {
  if (usesCloudRuntime()) return null;
  try {
    const [{ stat }, { createReadStream }, { Readable }] = await Promise.all([
      import("node:fs/promises"),
      import("node:fs"),
      import("node:stream"),
    ]);
    let target = localPath(storageKey);
    let info;
    try {
      info = await stat(target);
    } catch {
      if (storageKey.startsWith("private/")) return null;
      target = stagedLocalPath(storageKey);
      info = await stat(target);
    }
    if (!info.isFile() || start < 0 || start >= info.size) return null;
    const finalEnd = Math.min(end ?? info.size - 1, info.size - 1);
    if (finalEnd < start) return null;
    return { body: Readable.toWeb(createReadStream(target, { start, end: finalEnd })) as ReadableStream<Uint8Array>, size: info.size, start, end: finalEnd };
  } catch {
    return null;
  }
}

export async function writeStoredMedia(storageKey: string, bytes: ArrayBuffer | Uint8Array, contentType: string) {
  if (usesCloudRuntime()) {
    await (await cloudMedia())!.put(storageKey, bytes, { httpMetadata: { contentType } });
    return;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const target = localPath(storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(bytes));
}

export async function deleteStoredMedia(storageKey: string) {
  if (usesCloudRuntime()) { await (await cloudMedia())!.delete(storageKey); return; }
  const { unlink } = await import("node:fs/promises");
  await unlink(localPath(storageKey)).catch(() => undefined);
}
