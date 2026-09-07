import * as mammoth from "mammoth";
import { requirePermission } from "../../../../lib/admin-access";
import { storeResearchImage } from "../../../../lib/research-images";

const maximumSize = 25 * 1024 * 1024;
const wordMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const headingStyleMap = [
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h3:fresh",
  "p[style-name='Heading 3'] => h4:fresh",
];

/** Mammoth recognises Word footnotes/endnotes, but editors may discard list markers.
 * Store the sequence as text as well, so the scholarly note number always survives. */
function preserveWordNoteNumbers(html: string) {
  return html.replace(/<ol>([\s\S]*?)<\/ol>/gi, (list, items: string) => {
    if (!/href="#(?:doc-[^"]*-(?:footnote|endnote)-ref|footnote-ref-\d+)"/i.test(items)) return list;
      let number = 0;
      const numberedItems = items.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (_item: string, attributes: string, content: string) => {
        number += 1;
        const withoutBackLink = content.replace(/\s*<a\b[^>]*href="#(?:doc-[^"]*-(?:footnote|endnote)-ref|footnote-ref)[^"]*"[^>]*>↑<\/a>/gi, "");
        return `<li${attributes}><span class="word-note-number">[${number}]</span>${withoutBackLink}</li>`;
      });
      return `<ol class="word-footnotes">${numberedItems}</ol>`;
    });
}

export async function POST(request: Request) {
  const denied = await requirePermission(request, "RESEARCH_WRITE");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > maximumSize) {
      return Response.json({ message: "请上传不超过 25 MB 的 .docx 文档。" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx") || (file.type && file.type !== wordMimeType)) {
      return Response.json({ message: "仅支持标准 .docx 文档；旧版 .doc 请先在 Word 中另存为 .docx。" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return Response.json({ message: "该文件不是标准 .docx 文档。请确认不是旧版 .doc、改名文件或未下载完整的云端文件。" }, { status: 400 });
    }

    const result = await mammoth.convertToHtml({ buffer }, {
      styleMap: headingStyleMap,
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const contentType = image.contentType || "image/png";
        const stored = await storeResearchImage(Buffer.from(base64, "base64"), contentType);
        return { src: stored.url };
      }),
    });
    return Response.json({
      html: preserveWordNoteNumbers(result.value || "<p></p>"),
      warnings: result.messages.map((message) => message.message),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? `Word 文档未能导入：${error.message}` : "Word 文档未能导入，请确认文档未损坏。" }, { status: 400 });
  }
}
