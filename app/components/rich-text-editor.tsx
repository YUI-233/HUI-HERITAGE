"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Placeholder from "@tiptap/extension-placeholder";
import { Footnote, FootnoteReference, Footnotes } from "@ditojs/tiptap-footnotes";

type ResearchStyle = "research-original" | "research-translation" | "research-annotation";
type Props = { value: string; onChange: (html: string) => void };
type BlockFormat = { type: "paragraph" | "heading"; attrs: Record<string, unknown> };

const ResearchParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: { default: null, parseHTML: (element) => element.getAttribute("class"), renderHTML: (attributes) => attributes.class ? { class: attributes.class } : {} },
      style: { default: null, parseHTML: (element) => element.getAttribute("style"), renderHTML: (attributes) => attributes.style ? { style: attributes.style } : {} },
    };
  },
});

const ResearchOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: { default: null, parseHTML: (element) => element.getAttribute("class"), renderHTML: (attributes) => attributes.class ? { class: attributes.class } : {} },
    };
  },
});

const buttonClass = (active: boolean) => `research-editor-button${active ? " is-active" : ""}`;

export function RichTextEditor({ value, onChange }: Props) {
  const previousValue = useRef(value);
  const documentInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [formatBrush, setFormatBrush] = useState<BlockFormat | null>(null);
  const [importNote, setImportNote] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    content: value || "<p></p>",
    extensions: [
      StarterKit.configure({ document: false, paragraph: false, orderedList: false, listItem: false, underline: false, link: false, horizontalRule: false, heading: { levels: [2, 3, 4] } }),
      Document.extend({ content: "block+ footnotes?" }),
      ResearchParagraph,
      ResearchOrderedList,
      ListItem,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ autolink: true, openOnClick: false }),
      Image.configure({ allowBase64: false, resize: { enabled: true } }),
      CharacterCount,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      HorizontalRule,
      Placeholder.configure({ placeholder: "在此输入正文，或从 Word 粘贴内容…" }),
      Footnotes,
      Footnote,
      FootnoteReference,
    ],
    editorProps: {
      attributes: { class: "research-tiptap-content" },
      handlePaste: (_view, event) => {
        const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!images.length) return false;
        const position = editor?.state.selection.from;
        void uploadImages(images, position);
        return false;
      },
    },
    onUpdate: ({ editor: nextEditor }) => { const html = nextEditor.getHTML(); previousValue.current = html; onChange(html); },
    onSelectionUpdate: () => setSelectionVersion((current) => current + 1),
    onTransaction: () => setSelectionVersion((current) => current + 1),
  });

  useEffect(() => {
    if (!editor || value === previousValue.current) return;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    previousValue.current = value;
  }, [editor, value]);

  if (!editor) return <div className="research-editor-loading">正在加载专业编辑器…</div>;
  const setResearchStyle = (style?: ResearchStyle) => editor.chain().focus().updateAttributes("paragraph", { class: style ?? null }).run();
  const editLink = () => {
    const href = window.prompt("请输入链接地址：", editor.getAttributes("link").href ?? "");
    if (href === null) return;
    if (!href.trim()) return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };
  const uploadImages = async (files: File[], position?: number) => {
    const accepted = files.filter((file) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type));
    if (!accepted.length) return setImportNote("图片仅支持 JPG、PNG、WebP 或 GIF 格式。");
    setIsImporting(true);
    setImportNote(`正在上传 ${accepted.length} 张图片…`);
    try {
      let insertAt = position;
      for (const file of accepted) {
        if (file.size > 12 * 1024 * 1024) throw new Error(`“${file.name}”超过 12 MB。`);
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/admin/research-image", { method: "POST", body: form });
        const result = await response.json() as { url?: string; message?: string };
        if (!response.ok || !result.url) throw new Error(result.message ?? "图片上传失败。");
        const chain = editor.chain().focus();
        if (insertAt !== undefined) chain.setTextSelection(insertAt);
        chain.setImage({ src: result.url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
        insertAt = undefined;
      }
      setImportNote(`已插入 ${accepted.length} 张图片。`);
    } catch (error) {
      setImportNote(`图片未能插入：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setIsImporting(false);
    }
  };
  const importDocx = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) return setImportNote("请选择 .docx 格式的 Word 文档。");
    if (editor.getText().trim() && !window.confirm("导入将替换当前正文。请确认当前内容已保存后继续。")) return;
    setIsImporting(true);
    setImportNote(`正在读取“${file.name}”…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/research-import", { method: "POST", body: form });
      const result = await response.json() as { html?: string; warnings?: string[]; message?: string };
      if (!response.ok) throw new Error(result.message ?? "服务器未能读取该 Word 文档。");
      const html = result.html || "<p></p>";
      editor.commands.setContent(html);
      previousValue.current = html;
      onChange(html);
      const warningCount = result.warnings?.length ?? 0;
      setImportNote(warningCount ? `已导入；有 ${warningCount} 项格式提示，请检查标题、图片和脚注。` : "已导入 Word 正文，请检查标题、图片和脚注。");
    } catch (error) {
      setImportNote(`Word 文档未能导入：${error instanceof Error ? error.message : "请确认文件未损坏且为 .docx 格式。"}`);
    } finally {
      setIsImporting(false);
    }
  };
  const useFormatBrush = () => {
    const block = editor.state.selection.$from.parent;
    if (block.type.name !== "paragraph" && block.type.name !== "heading") return;
    if (!formatBrush) return setFormatBrush({ type: block.type.name, attrs: { ...block.attrs } });
    editor.chain().focus().setNode(formatBrush.type, formatBrush.attrs).run();
    setFormatBrush(null);
  };
  const outline: Array<{ level: number; text: string; position: number }> = [];
  editor.state.doc.descendants((node, position) => { if (node.type.name === "heading") outline.push({ level: Number(node.attrs.level), text: node.textContent, position }); });

  return <div className="research-tiptap-editor" data-selection-version={selectionVersion}>
    <div className="research-tiptap-toolbar" aria-label="正文格式工具">
      <span className="research-toolbar-group">结构</span>
      <button type="button" className={buttonClass(editor.isActive("paragraph"))} onClick={() => editor.chain().focus().setParagraph().run()}>正文</button>
      {[2, 3, 4].map((level) => <button key={level} type="button" className={buttonClass(editor.isActive("heading", { level }))} onClick={() => editor.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run()}>{`${level - 1}级标题`}</button>)}
      <span className="research-toolbar-group">文本</span>
      <button type="button" className={buttonClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>粗体</button>
      <button type="button" className={buttonClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>斜体</button>
      <button type="button" className={buttonClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>下划线</button>
      <button type="button" className={buttonClass(editor.isActive("highlight"))} onClick={() => editor.chain().focus().toggleHighlight().run()}>高亮</button>
      <button type="button" className={buttonClass(editor.isActive("superscript"))} onClick={() => editor.chain().focus().toggleSuperscript().run()}>上标</button>
      <button type="button" className={buttonClass(editor.isActive("subscript"))} onClick={() => editor.chain().focus().toggleSubscript().run()}>下标</button>
      <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>清除格式</button>
      <span className="research-toolbar-group">段落</span>
      <button type="button" className={buttonClass(Boolean(formatBrush))} onClick={useFormatBrush}>{formatBrush ? "应用格式" : "格式刷"}</button>
      <button type="button" className={buttonClass(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()}>左对齐</button>
      <button type="button" className={buttonClass(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()}>居中</button>
      <button type="button" className={buttonClass(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()}>右对齐</button>
      <button type="button" className={buttonClass(editor.isActive({ textAlign: "justify" }))} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>两端对齐</button>
      <span className="research-toolbar-group">学术标记</span>
      <button type="button" className={buttonClass(editor.isActive("paragraph", { class: "research-original" }))} onClick={() => setResearchStyle("research-original")}>原文</button>
      <button type="button" className={buttonClass(editor.isActive("paragraph", { class: "research-translation" }))} onClick={() => setResearchStyle("research-translation")}>译文</button>
      <button type="button" className={buttonClass(editor.isActive("paragraph", { class: "research-annotation" }))} onClick={() => setResearchStyle("research-annotation")}>解字</button>
      <button type="button" onClick={() => setResearchStyle()}>取消标记</button>
      <span className="research-toolbar-group">插入</span>
      <button type="button" disabled={isImporting} onClick={() => documentInput.current?.click()}>{isImporting ? "正在导入…" : "导入 Word"}</button><input ref={documentInput} className="research-docx-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { void importDocx(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <button type="button" className={buttonClass(editor.isActive("link"))} onClick={editLink}>链接</button>
      <button type="button" disabled={isImporting} onClick={() => imageInput.current?.click()}>上传图片</button><input ref={imageInput} className="research-docx-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => { void uploadImages(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>列表</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>引用</button>
      <button type="button" className={buttonClass(editor.isActive("table"))} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>表格</button>
      <button type="button" onClick={() => editor.chain().focus().addFootnote().run()}>脚注</button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>分隔线</button>
      <span className="research-toolbar-group">编辑</span>
      <button type="button" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>撤销</button>
      <button type="button" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>重做</button>
    </div>
    {outline.length > 0 && <nav className="research-tiptap-outline" aria-label="文章目录"><b>文章目录</b>{outline.map((item) => <button key={`${item.position}-${item.text}`} type="button" className={`outline-level-${item.level}`} onClick={() => editor.chain().focus().setTextSelection(item.position + 1).run()}>{item.text}</button>)}</nav>}
    <EditorContent editor={editor} />
    <small className="research-tiptap-help">选择文字或将光标置于段落中后使用工具。可导入含图片的 Word 文档，也可复制粘贴图片或使用“上传图片”。脚注会自动编号，并集中显示在正文末尾。当前 {editor.storage.characterCount.characters()} 字，{editor.storage.characterCount.words()} 词。{importNote && ` ${importNote}`}</small>
  </div>;
}
