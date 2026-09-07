"use client";

import { ManuscriptCategorySelect } from "./manuscript-metadata-fields";
import { CategoryRequestButton } from "./category-request-button";

export type HoldingBibliographyValues = {
  title: string;
  author: string;
  dynasty: string;
  eraDetail: string;
  publicationDate: string;
  imprintPublisher: string;
  versionType: string;
  binding: string;
  volumeCount: string;
  categories: string;
  institution: string;
  region: string;
  origin: "DOMESTIC" | "OVERSEAS";
  callNumber: string;
  catalogUrl: string;
  holdingDescription: string;
};

const origins = [["DOMESTIC", "国内馆藏"], ["OVERSEAS", "海外馆藏"]] as const;
const authorEraOptions = ["", "当代", "民国", "清", "明"];
const selectedCategories = (value: string) => value.split(/[、，,；;\n]/).map((item) => item.trim()).filter(Boolean);

export function HoldingBibliographyFields({ values, onChange, compact = false }: { values: HoldingBibliographyValues; onChange: <K extends keyof HoldingBibliographyValues>(key: K, value: HoldingBibliographyValues[K]) => void; compact?: boolean }) {
  const authorField = <div className="holding-revision-author-field"><select aria-label="作者年代" value={values.dynasty} onChange={(event) => onChange("dynasty", event.target.value)}>{authorEraOptions.map((option) => <option value={option} key={option}>{option || "—"}</option>)}</select><input aria-label="作者" value={values.author} onChange={(event) => onChange("author", event.target.value)} /></div>;

  if (compact) return <div className="holding-bibliography-fields holding-bibliography-fields--admin">
    <section className="holding-entry-section">
      <div className="holding-entry-section-heading"><b>书目资料</b><small>用于识别和检索这部书</small></div>
      <div className="holding-entry-fields">
        <label>书名<input value={values.title} onChange={(event) => onChange("title", event.target.value)} /></label>
        <label className="holding-field-author">作者{authorField}</label>
        <ManuscriptCategorySelect label="分类" compact categories={selectedCategories(values.categories)} onChange={(categories) => onChange("categories", categories.join("、"))} />
        <CategoryRequestButton scope="MANUSCRIPT" sourceArea="馆藏信息录入" />
        <label>册数<input type="number" min="1" value={values.volumeCount} onChange={(event) => onChange("volumeCount", event.target.value)} /></label>
        <label>刊刻年份<input value={values.eraDetail} onChange={(event) => onChange("eraDetail", event.target.value)} /></label>
        <label>刊刻时间<input value={values.publicationDate} onChange={(event) => onChange("publicationDate", event.target.value)} /></label>
        <label>刊刻主体<input value={values.imprintPublisher} onChange={(event) => onChange("imprintPublisher", event.target.value)} /></label>
        <label>版本<input value={values.versionType} onChange={(event) => onChange("versionType", event.target.value)} /></label>
        <label>装帧<input value={values.binding} onChange={(event) => onChange("binding", event.target.value)} /></label>
      </div>
    </section>
    <section className="holding-entry-section">
      <div className="holding-entry-section-heading"><b>馆藏信息</b><small>填写馆藏位置、馆方目录与补充说明</small></div>
      <div className="holding-entry-fields">
        <label>馆藏类型<select value={values.origin} onChange={(event) => onChange("origin", event.target.value as HoldingBibliographyValues["origin"])}>{origins.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>图书馆<input value={values.institution} onChange={(event) => onChange("institution", event.target.value)} /></label>
        <label>国家/地区<input value={values.region} onChange={(event) => onChange("region", event.target.value)} /></label>
        <label>检索号<input value={values.callNumber} onChange={(event) => onChange("callNumber", event.target.value)} /></label>
        <label className="holding-field-link">馆方链接<input value={values.catalogUrl} onChange={(event) => onChange("catalogUrl", event.target.value)} placeholder="https://…" /></label>
        <label className="holding-field-full">备注<textarea value={values.holdingDescription} onChange={(event) => onChange("holdingDescription", event.target.value)} /></label>
      </div>
    </section>
  </div>;

  return <div className="holding-revision-grid">
    <label className="field-wide holding-revision-compact-field">书名<input value={values.title} onChange={(event) => onChange("title", event.target.value)} /></label>
    <label className="field-wide holding-revision-compact-field">作者{authorField}</label>
    <label>册数<input type="number" min="1" value={values.volumeCount} onChange={(event) => onChange("volumeCount", event.target.value)} /></label>
    <label>刊刻年份<input value={values.eraDetail} onChange={(event) => onChange("eraDetail", event.target.value)} /></label>
    <label>刊刻时间<input value={values.publicationDate} onChange={(event) => onChange("publicationDate", event.target.value)} /></label>
    <label>刊刻主体<input value={values.imprintPublisher} onChange={(event) => onChange("imprintPublisher", event.target.value)} /></label>
    <label>版本<input value={values.versionType} onChange={(event) => onChange("versionType", event.target.value)} /></label>
    <label>装帧<input value={values.binding} onChange={(event) => onChange("binding", event.target.value)} /></label>
    <ManuscriptCategorySelect label="分类" className="field-wide" compact categories={selectedCategories(values.categories)} onChange={(categories) => onChange("categories", categories.join("、"))} />
    <CategoryRequestButton scope="MANUSCRIPT" sourceArea="馆藏信息录入" />
    <label>馆藏类型<select value={values.origin} onChange={(event) => onChange("origin", event.target.value as HoldingBibliographyValues["origin"])}>{origins.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>国家/地区<input value={values.region} onChange={(event) => onChange("region", event.target.value)} /></label>
    <label className="field-wide">图书馆<input value={values.institution} onChange={(event) => onChange("institution", event.target.value)} /></label>
    <label>检索号<input value={values.callNumber} onChange={(event) => onChange("callNumber", event.target.value)} /></label>
    <label className="field-wide">馆方链接<input value={values.catalogUrl} onChange={(event) => onChange("catalogUrl", event.target.value)} /></label>
    <label className="field-wide">备注<textarea value={values.holdingDescription} onChange={(event) => onChange("holdingDescription", event.target.value)} /></label>
  </div>;
}
