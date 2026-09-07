/**
 * Vinext resolves this native module in Cloudflare Workers. The local Next.js
 * build never executes the cloud branch, but needs a declaration to type-check
 * the lazy import.
 */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
