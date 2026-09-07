import { writeStoredMedia } from "./media-storage";

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const researchImageMaximumSize = 12 * 1024 * 1024;

export function researchImageExtension(contentType: string) {
  return imageExtensions[contentType.toLowerCase()];
}

export async function storeResearchImage(bytes: ArrayBuffer | Uint8Array, contentType: string) {
  const extension = researchImageExtension(contentType);
  if (!extension) throw new Error("研究资料图片仅支持 JPG、PNG、WebP 或 GIF 格式。");
  const fileName = `${crypto.randomUUID()}.${extension}`;
  await writeStoredMedia(`research/images/${fileName}`, bytes, contentType);
  return { fileName, url: `/api/research-media/${fileName}` };
}
