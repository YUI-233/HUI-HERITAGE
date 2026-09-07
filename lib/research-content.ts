export type ResearchSection = { id: string; level: 2 | 3; title: string };
export type PreparedResearchContent = { html: string; sections: ResearchSection[] };

const text = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
const comparableText = (value: string) => text(value).replace(/\s+/g, "");

function removeRepeatedIntroduction(contentHtml: string, title: string, summary: string) {
  let content = contentHtml.trim();
  const removeFirstBlockWhenEqual = (expected: string) => {
    while (true) {
      const match = content.match(/^<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>\s*/i);
      if (!match || text(match[2])) break;
      content = content.slice(match[0].length);
    }
    const match = content.match(/^<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>\s*/i);
    if (match && comparableText(match[2]) === comparableText(expected)) content = content.slice(match[0].length);
  };
  removeFirstBlockWhenEqual(title);
  removeFirstBlockWhenEqual(summary);
  return content;
}

export function prepareResearchContent(contentHtml: string, title: string, summary: string): PreparedResearchContent {
  let html = removeRepeatedIntroduction(contentHtml, title, summary).replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (paragraph, inner: string) => {
    const heading = text(inner).match(/^【\s*([^【】]{1,80}?)\s*】$/);
    return heading ? `<h2>【${heading[1]}】</h2>` : paragraph;
  });
  const sections: ResearchSection[] = [];
  html = html.replace(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, inner: string) => {
    const titleText = text(inner);
    if (!titleText) return "";
    const id = `research-section-${sections.length + 1}`;
    sections.push({ id, level: Number(level) as 2 | 3, title: titleText.replace(/^【\s*|\s*】$/g, "") });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html, sections };
}
