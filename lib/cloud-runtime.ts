/**
 * Cloud-only bindings are loaded lazily so the existing Next/PostgreSQL app
 * can continue to run locally. Sites sets HUI_RUNTIME=cloud when a route is
 * ready to use the D1/R2-backed implementation.
 */
export type CloudD1 = {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> };
  };
};

export type CloudMediaBucket = {
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> | null; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

type CloudBindings = { HUI_DB?: CloudD1; HUI_MEDIA?: CloudMediaBucket };

export function usesCloudRuntime() {
  return process.env.HUI_RUNTIME === "cloud";
}

async function bindings(): Promise<CloudBindings | null> {
  if (!usesCloudRuntime()) return null;

  // Keep `cloudflare:workers` out of the local Next runtime. Vinext resolves
  // this native module in the worker only after the cloud branch is selected.
  // Webpack must not attempt to resolve Cloudflare's worker-only URI while
  // compiling the local Next.js/PostgreSQL server. The import is reached only
  // when the hosted runtime explicitly sets HUI_RUNTIME=cloud.
  const workerModule = await import(/* webpackIgnore: true */ "cloudflare:workers") as { env: CloudBindings };
  return workerModule.env;
}

export async function cloudD1(): Promise<CloudD1 | null> {
  const value = await bindings();
  if (!value) return null;
  if (!value.HUI_DB) throw new Error("正式环境缺少 HUI_DB 数据库绑定。");
  return value.HUI_DB;
}

export async function cloudMedia(): Promise<CloudMediaBucket | null> {
  const value = await bindings();
  if (!value) return null;
  if (!value.HUI_MEDIA) throw new Error("正式环境缺少 HUI_MEDIA 媒体存储绑定。");
  return value.HUI_MEDIA;
}
