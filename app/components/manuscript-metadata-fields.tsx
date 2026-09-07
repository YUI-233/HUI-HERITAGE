"use client";

import { useEffect, useState } from "react";
import { manuscriptCategoryGroups } from "../../lib/manuscript-categories";

export type ManuscriptMetadataValue = {
  language: string;
  author: string;
  volumeCount: number;
  dynasty: string;
  eraDetail: string;
  publicationDate: string;
  imprintPublisher: string;
  versionType: string;
  binding: string;
  categories: string[];
  description: string;
};

export const blankManuscriptMetadata = (): ManuscriptMetadataValue => ({
  language: "汉文", author: "", volumeCount: 1, dynasty: "", eraDetail: "", publicationDate: "",
  imprintPublisher: "", versionType: "", binding: "", categories: [], description: "",
});

export function ManuscriptCategorySelect({ categories, onChange, compact = false, label = "分类（可多选）", className = "", groups = manuscriptCategoryGroups, required = false, scope = "MANUSCRIPT" }: {
  categories: string[];
  onChange: (categories: string[]) => void;
  compact?: boolean;
  label?: string;
  className?: string;
  groups?: ReadonlyArray<{ label: string; options: readonly string[] }>;
  required?: boolean;
  scope?: "MANUSCRIPT" | "ARTIFACT" | "RESEARCH";
}) {
  const [nextCategory, setNextCategory] = useState("");
  const [managed, setManaged] = useState<string[]>([]);
  useEffect(() => { void fetch(`/api/categories?scope=${scope}`).then(async (response) => { if (response.ok) setManaged((await response.json()).map((item: { name: string }) => item.name)); }); }, [scope]);
  const allGroups = managed.length ? [...groups, { label: "管理员维护分类", options: managed.filter((name) => !groups.some((group) => group.options.includes(name))) }] : groups;
  const addCategory = (category = nextCategory) => {
    if (!category || categories.includes(category)) return;
    onChange([...categories, category]);
    setNextCategory("");
  };

  return <div className={`manuscript-category-picker${compact ? " compact" : ""}${className ? ` ${className}` : ""}`}>
    <label>{label}
      {!compact && <span>从下拉列表选择后添加；同一种书可归入多个类别。</span>}
      <select name="categories" required={required && categories.length === 0} value={nextCategory} onChange={(event) => {
        const category = event.target.value;
        if (compact) addCategory(category); else setNextCategory(category);
      }}>
        <option value="">请选择分类</option>
        {allGroups.map((group) => <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => <option value={option} key={option}>{option}</option>)}
        </optgroup>)}
      </select>
    </label>
    {!compact && <button type="button" className="secondary" onClick={() => addCategory()} disabled={!nextCategory || categories.includes(nextCategory)}>添加分类</button>}
    {categories.length > 0 && <div className="selected-categories">
      {categories.map((category) => <button type="button" key={category} onClick={() => onChange(categories.filter((item) => item !== category))}>{category} ×</button>)}
    </div>}
  </div>;
}

export function ManuscriptCategoryPicker({ value, onChange, compact = false }: {
  value: ManuscriptMetadataValue;
  onChange: (patch: Partial<ManuscriptMetadataValue>) => void;
  compact?: boolean;
}) {
  return <ManuscriptCategorySelect categories={value.categories} onChange={(categories) => onChange({ categories })} compact={compact} />;
}

export function ManuscriptMetadataFields({ value, onChange, showCategories = true, showDescription = true, showBinding = true }: {
  value: ManuscriptMetadataValue;
  onChange: (patch: Partial<ManuscriptMetadataValue>) => void;
  showCategories?: boolean;
  showDescription?: boolean;
  showBinding?: boolean;
}) {
  return <>
    <div className="two-fields">
      <label>作者年代
        <select name="era" value={value.dynasty} onChange={(event) => onChange({ dynasty: event.target.value })}>
          <option value="">请选择</option><option>当代</option><option>民国</option><option>清</option><option>明</option>
        </select>
      </label>
      <label>作者<input name="creator" value={value.author} onChange={(event) => onChange({ author: event.target.value })}/></label>
    </div>
    <div className="two-fields">
      <label>语言<input name="language" value={value.language} onChange={(event) => onChange({ language: event.target.value })} placeholder="如：汉文、阿拉伯文"/></label>
      <label>册数<input name="volumeCount" type="number" min="1" max="999" value={value.volumeCount} onChange={(event) => onChange({ volumeCount: Math.max(1, Number(event.target.value) || 1) })}/></label>
    </div>
    <div className="two-fields">
      <label>刊刻年份<input name="eraDetail" value={value.eraDetail} onChange={(event) => onChange({ eraDetail: event.target.value })} placeholder="如：光绪元年／民国10年"/></label>
      <label>刊刻时间<input name="publicationDate" value={value.publicationDate} onChange={(event) => onChange({ publicationDate: event.target.value })} placeholder="如：1881"/></label>
    </div>
    <div className="two-fields">
      <label>刊刻主体<input name="imprintPublisher" value={value.imprintPublisher} onChange={(event) => onChange({ imprintPublisher: event.target.value })} placeholder="如：京都清真寺"/></label>
      <label>版本<input name="editionOrCategory" value={value.versionType} onChange={(event) => onChange({ versionType: event.target.value })} placeholder="如：木刻本"/></label>
    </div>
    {showBinding && <div className="two-fields">
      <label>装帧<input name="binding" value={value.binding} onChange={(event) => onChange({ binding: event.target.value })} placeholder="如：线装／平装／精装"/></label>
    </div>}
    {showCategories && <ManuscriptCategoryPicker value={value} onChange={onChange}/>} 
    {showDescription && <label>备注<textarea name="description" value={value.description} onChange={(event) => onChange({ description: event.target.value })}/></label>}
  </>;
}
