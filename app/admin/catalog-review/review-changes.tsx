import type { CatalogReviewSnapshot } from "../../../lib/catalog-review-baseline";

type FieldValue = string | number | string[] | null | undefined;
type Current = CatalogReviewSnapshot & { type: "manuscript" | "artifact"; comparisonUnavailable?: boolean; baseline?: CatalogReviewSnapshot | null };
const common = [["title", "题名"], ["description", "备注"], ["source", "资料来源"], ["keywords", "主题词"]] as const;
const book = [["language", "语言"], ["author", "作者"], ["dynasty", "作者年代"], ["volumeCount", "册数"], ["eraDetail", "刊刻年份"], ["publicationDate", "刊刻时间"], ["imprintPublisher", "刊刻主体"], ["versionType", "版本"], ["binding", "装帧"], ["categories", "分类"]] as const;
const artifact = [["category", "类别"], ["era", "年代"], ["material", "材质"]] as const;
const display = (item: FieldValue) => Array.isArray(item) ? item.join("、") : item == null ? "" : String(item).trim();

export function ReviewChanges({ detail }: { detail: Current }) {
  const before = detail.baseline;
  if (!before) return detail.comparisonUnavailable ? <section className="review-diff review-diff-note"><h3>修改前后对比</h3><p>这条旧申请没有保存修改前版本，无法可靠追溯差异。请核对下方完整资料和附件。</p></section> : null;
  const fields = [...common, ...(detail.type === "manuscript" ? book : artifact)];
  const changed = fields.map(([key, label]) => ({ key, label, oldValue: display(before[key]), newValue: display(detail[key]) })).filter((field) => field.oldValue !== field.newValue);
  const originalMedia = new Map(before.media.map((media) => [media.id, media]));
  const currentMedia = new Map(detail.media.map((media) => [media.id, media]));
  const removed = before.media.filter((media) => !currentMedia.has(media.id));
  const added = detail.media.filter((media) => !originalMedia.has(media.id));
  const retained = detail.media.filter((media) => originalMedia.has(media.id));
  return <section className="review-diff" aria-labelledby="review-diff-title">
    <h3 id="review-diff-title">修改前后对比</h3>
    {changed.length ? <div className="review-diff-list">{changed.map((field) => <div className="review-diff-row" key={field.key}><h4>{field.label}</h4><div className="review-diff-pair"><div><small>修改前</small><p>{field.oldValue || <em>未填写</em>}</p></div><div><small>修改后 {field.oldValue ? field.newValue ? "" : "· 已删除" : "· 新增"}</small><p>{field.newValue || <em>未填写</em>}</p></div></div></div>)}</div> : <p className="review-diff-empty">书目信息没有变化。</p>}
    <div className="review-diff-media"><h4>附件变化</h4><p>新增 {added.length} 个 · 删除 {removed.length} 个 · 保留 {retained.length} 个</p><ul>{added.map((media) => <li key={media.id}><span className="review-diff-added">新增</span>{media.mimeType === "application/pdf" ? "PDF" : "图片"} · {media.id}</li>)}{removed.map((media) => <li key={media.id}><span className="review-diff-removed">已删除</span>{media.mimeType === "application/pdf" ? "PDF" : "图片"} · {media.id}（原文件已移除，无法预览）</li>)}{retained.map((media) => <li key={media.id}><span className="review-diff-retained">保留</span>{media.mimeType === "application/pdf" ? "PDF" : "图片"} · {media.id}</li>)}</ul></div>
  </section>;
}
