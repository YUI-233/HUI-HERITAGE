"use client";

import { FormEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { blankManuscriptMetadata, ManuscriptCategoryPicker, ManuscriptMetadataFields } from "../components/manuscript-metadata-fields";
import { manuscriptCategoryGroups } from "../../lib/manuscript-categories";
import { personalArtifactExamples, personalArtifactFeatureSets } from "../../lib/personal-artifact-example-data";

type Section = "shelf" | "items" | "books" | "artifacts";
type ItemType = "BOOK" | "ARTIFACT";
type PersonalItem = {
  id: string; type: ItemType; title: string; creator: string | null; era: string | null; eraDetail: string | null;
  publicationDate: string | null; imprintPublisher: string | null; editionOrCategory: string | null; binding: string | null;
  price: string | null; categories: string[]; volumeCount: number; serialNumber: string; description: string | null; media: Array<{ id: string; mimeType: string }>;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "ARCHIVED";
  isPublic: boolean; reviewComment: string | null; reviewedAt: string | null;
};

const mediaUrl = (item: PersonalItem, mediaId: string) => `/api/personal-collection/items/${item.id}/media/${mediaId}`;
const authorEraOptions = ["", "当代", "民国", "清", "明"];
const formatAuthorWithEra = (creator?: string | null, era?: string | null) => {
  const name = creator?.trim() || "佚名";
  const period = era?.trim();
  return period ? `[${period}] ${name}` : name;
};

const navItems: Array<{ id: Section; label: string }> = [
  { id: "shelf", label: "我的收藏馆" }, { id: "books", label: "书籍管理" }, { id: "artifacts", label: "藏品管理" },
];
const shelfGroups = [
  ["1", "经训"], ["2", "教法"], ["3", "教义"], ["4", "语言"], ["5", "历史"],
  ["6", "历法医药"], ["7", "文献学"], ["8", "艺文"], ["9", "报刊杂志"], ["10", "学术研究"], ["other", "未分类"],
] as const;
const categoryAliases: Array<[string, string[]]> = [
  ["1", ["经训", "古兰", "圣训", "穆圣", "圣人传记", "赞圣"]],
  ["2", ["教法", "礼制", "仪规", "杂学", "法理"]],
  ["3", ["教义", "认主", "劝喻", "苏菲", "逻辑", "哲学"]],
  ["4", ["语言", "文法", "阿拉伯", "波斯", "小儿锦", "经堂语"]],
  ["5", ["历史", "回教史", "人物传记", "家谱", "金石", "中西交通"]],
  ["6", ["历法医药", "历法", "医药"]], ["7", ["文献"]], ["8", ["艺文", "文学", "艺术", "音乐", "建筑"]],
  ["9", ["报刊"]], ["10", ["学术研究"]],
];
const defaultArtifactCategories = ["碑帖", "器皿", "书画", "纺织品", "照片", "手稿"];

function shelfGroupId(book: PersonalItem) {
  const category = book.categories.filter(Boolean).join(" / ");
  const number = category.match(/^\s*(10|[1-9])(?:[.\s]|$)/)?.[1];
  if (number && shelfGroups.some(([id]) => id === number)) return number;
  return categoryAliases.find(([, aliases]) => aliases.some((alias) => category.includes(alias)))?.[0] ?? "other";
}

export function PersonalCollectionWorkspace({ initialSection = "shelf", initialManagementView = "table" }: { initialSection?: Section; initialManagementView?: "table" | "create" }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [artifactCategories, setArtifactCategories] = useState<string[]>(defaultArtifactCategories);
  const [detailBook, setDetailBook] = useState<PersonalItem | null>(null);
  const [message, setMessage] = useState("正在读取个人收藏……");
  const sampleSeedAttempted = useRef(false);
  const load = async () => {
    const response = await fetch("/api/personal-collection/items", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "无法读取个人收藏。");
    setItems(body); setMessage("");
    const exampleCount = body.filter((item: PersonalItem) => item.type === "ARTIFACT" && item.title.startsWith("示例｜")).length;
    if (!sampleSeedAttempted.current && exampleCount < personalArtifactExamples.length) {
      sampleSeedAttempted.current = true;
      const seeded = await fetch("/api/personal-collection/artifact-examples", { method: "POST" });
      const result = await seeded.json().catch(() => ({}));
      if (seeded.ok && result.created) return load();
      if (!seeded.ok) setMessage(result.message ?? "示例素材暂未加入，可在“藏品管理”中重试。");
    }
  };
  const loadArtifactCategories = async () => {
    const response = await fetch("/api/personal-collection/artifact-categories", { cache: "no-store" });
    const body = await response.json().catch(() => []);
    if (response.ok && Array.isArray(body)) setArtifactCategories(body);
  };
  useEffect(() => { void load(); void loadArtifactCategories(); }, []);
  const books = useMemo(() => items.filter((item) => item.type === "BOOK"), [items]);
  const artifacts = useMemo(() => items.filter((item) => item.type === "ARTIFACT"), [items]);
  const updateSavedItem = (updated: PersonalItem) => setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  const isCollection = section === "shelf" || section === "items";

  return <div className="personal-workspace">
    <aside className="personal-sidebar" aria-label="个人收藏馆功能导航">
      {navItems.map((item) => <a className={isCollection && item.id === "shelf" ? "active" : section === item.id ? "active" : ""} href={`/personal-collection?section=${item.id}`} onClick={(event) => { event.preventDefault(); setSection(item.id); }} key={item.id}>{item.label}</a>)}
    </aside>
    <div className="personal-content">
      {isCollection && <>
        <div className="collection-tabs" role="tablist" aria-label="我的收藏馆视图">
          <button type="button" role="tab" aria-selected={section === "shelf"} className={section === "shelf" ? "active" : ""} onClick={() => setSection("shelf")}>我的书架</button>
          <button type="button" role="tab" aria-selected={section === "items"} className={section === "items" ? "active" : ""} onClick={() => setSection("items")}>我的藏品</button>
        </div>
        {section === "shelf" ? <ShelfPanel books={books} onOpen={setDetailBook} /> : <ItemsPanel artifacts={artifacts} categories={artifactCategories} />}
      </>}
      {section === "books" && <ManagementPanel type="BOOK" items={books} initialView={initialManagementView} onSaved={load} onItemSaved={updateSavedItem} />}
      {section === "artifacts" && <ManagementPanel type="ARTIFACT" items={artifacts} initialView={initialManagementView} categories={artifactCategories} onCategoriesChanged={loadArtifactCategories} onSaved={load} />}
      {message && <p className="personal-message">{message}</p>}
      {detailBook && <PersonalBookDetail book={detailBook} onClose={() => setDetailBook(null)}/>} 
    </div>
  </div>;
}

function ShelfPanel({ books, onOpen }: { books: PersonalItem[]; onOpen: (book: PersonalItem) => void }) {
  const totalVolumes = books.reduce((total, book) => total + book.volumeCount, 0);
  const serialFor = (book: PersonalItem, volume: number) => `${book.serialNumber}-${String(volume).padStart(2, "0")}`;
  const serialLabel = (book: PersonalItem) => {
    const first = serialFor(book, 1);
    if (book.volumeCount >= 3) return `${first}~${serialFor(book, book.volumeCount)}`;
    if (book.volumeCount === 2) return `${first}~${serialFor(book, 2)}`;
    return first;
  };
  const grouped = shelfGroups.map(([id, label]) => {
    const groupedBooks = books
      .filter((book) => shelfGroupId(book) === id)
      .sort((a, b) => a.title.localeCompare(b.title, "zh-Hans") || a.serialNumber.localeCompare(b.serialNumber, "zh-Hans"));
    return { id, label, books: groupedBooks, volumes: groupedBooks.reduce((total, book) => total + book.volumeCount, 0) };
  }).filter((group) => group.books.length > 0);

  return <section className="collection-panel shelf-panel">
    {grouped.length ? <div className="shelf-stack">
      {grouped.map((group) => <section className="shelf-row" key={group.id}>
        <aside className="shelf-category-sign"><strong>{group.label}</strong><span>{group.books.length} 种<br/>{group.volumes} 册</span></aside>
        <div className="shelf-row-books">
          {group.books.flatMap((book, index) => {
            const style = { "--set-color": ["#8e4a39", "#3d5960", "#896f41", "#665a45"][index % 4] } as CSSProperties;
            const titleSizeClass = book.title.length >= 13 ? "title-xxlong" : book.title.length >= 11 ? "title-xlong" : book.title.length >= 8 ? "title-long" : "";
            const titleClassName = `book-spine-title ${titleSizeClass}`.trim();
            const caseTitleClassName = `book-case-title ${titleSizeClass}`.trim();
            if (book.volumeCount > 1) return <article className={`book-case ${titleSizeClass}`.trim()} key={book.id} style={style} role="button" tabIndex={0} onClick={() => onOpen(book)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(book); }}>
              <div className="book-case-volumes">{Array.from({ length: book.volumeCount }, (_, volumeIndex) => <i key={volumeIndex} aria-hidden="true"/>)}</div>
              <div className={caseTitleClassName}><b>{book.title}</b><small>{book.creator ?? "佚名"}</small></div><span className="book-case-volume-count">{book.volumeCount}册</span><em>{serialLabel(book)}</em>
            </article>;
            return <article className={`book-spine book-spine-single ${titleSizeClass}`.trim()} key={book.id} style={style} role="button" tabIndex={0} onClick={() => onOpen(book)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(book); }} title={`${book.title} · ${book.creator ?? "佚名"} · ${serialFor(book, 1)}`}>
              <b className={titleClassName}>{book.title}</b><small className="book-spine-author">{book.creator ?? "佚名"}</small><em className="book-spine-label">{serialFor(book, 1)}</em>
            </article>;
          })}
        </div>
      </section>)}
    </div> : <div className="empty-shelf">
      <div className="empty-shelf-scene" aria-hidden="true">
        <img src="/personal-library-empty-reading-room-wide.png" alt=""/>
      </div>
      <div className="empty-shelf-copy">
        <p className="empty-shelf-kicker">YOUR PERSONAL LIBRARY</p>
        <h2>尚未收录书籍</h2>
        <p>岁月流转，散落于民间的古籍文献正悄然湮没。每一册旧籍，皆承载着一段民族记忆与文化脉络。请从录入您的典藏开始，为它们建立数字档案，并逐步完成数字化整理，使珍贵文献得以长久保存、持续研究，并向更多人开放共享，让散落的古籍重新被看见。</p>
        <p className="empty-shelf-privacy-note">在你没有手动公开之前，你上传的书目资料和图片会只保存在您的个人收藏馆中。</p>
        <div className="empty-shelf-actions">
          <a className="empty-shelf-primary-action" href="/personal-collection?section=books&view=create">新增第一册书</a>
        </div>
      </div>
    </div>}
    <p className="shelf-total">共 {books.length} 种／{totalVolumes} 册</p>
  </section>;
}

function PersonalBookDetail({ book, onClose }: { book: PersonalItem; onClose: () => void }) {
  const [activeMediaId, setActiveMediaId] = useState(book.media[0]?.id ?? "");
  const active = book.media.find((media) => media.id === activeMediaId) ?? book.media[0];
  const fields = [["编号", book.serialNumber], ["分类", book.categories.join("／") || "未分类"], ["作者", formatAuthorWithEra(book.creator, book.era)], ["册数", `${book.volumeCount} 册`], ["刊刻年份", book.eraDetail || "未填写"], ["刊刻时间", book.publicationDate || "未填写"], ["刊刻主体", book.imprintPublisher || "未填写"], ["版本", book.editionOrCategory], ["装帧", book.binding], ["备注", book.description]].filter(([, value]) => Boolean(value));
  return <div className="personal-detail-backdrop" role="presentation" onMouseDown={onClose}><article className="personal-book-detail" role="dialog" aria-modal="true" aria-label={`${book.title}详情`} onMouseDown={(event) => event.stopPropagation()}><button className="personal-detail-close" type="button" onClick={onClose}>关闭 ×</button><div className="personal-detail-media">{active ? <img src={mediaUrl(book, active.id)} alt={`${book.title}图片`}/> : <div className="personal-detail-empty">暂无图片</div>}{book.media.length > 1 && <div className="personal-detail-thumbs">{book.media.map((media, index) => <button type="button" aria-label={`查看第 ${index + 1} 张图片`} className={media.id === active?.id ? "active" : ""} key={media.id} onClick={() => setActiveMediaId(media.id)}><img src={mediaUrl(book, media.id)} alt=""/></button>)}</div>}</div><div className="personal-detail-copy"><p>个人收藏 · 书籍详情</p><h2>{book.title}</h2><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></article></div>;
}

const artifactPreviewItems = personalArtifactExamples.map((item, index) => ({ id: `met-example-${index + 1}`, ...item, image: item.url }));
const previewForExampleTitle = (title: string) => artifactPreviewItems.find((item) => item.title === title)?.image ?? "";
const exampleForTitle = (title: string) => artifactPreviewItems.find((item) => item.title === title);

function ItemsPanel({ artifacts, categories }: { artifacts: PersonalItem[]; categories: string[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const allCategories = [...new Set([...categories, ...artifacts.map((item) => item.editionOrCategory).filter((item): item is string => Boolean(item))])];
  const personalEntries = artifacts.map((item) => {
    const sample = exampleForTitle(item.title);
    return { id: item.id, title: item.title, category: item.editionOrCategory || "未分类", collection: sample?.collection ?? null, creator: item.creator || "作者／来源待补充", era: item.era || "年代待补充", description: item.description || sample?.description || "暂无说明", image: item.media[0] ? mediaUrl(item, item.media[0].id) : sample?.image || "", source: sample?.source || "", example: item.title.startsWith("示例｜") };
  });
  const examples = artifacts.some((item) => item.title.startsWith("示例｜")) ? [] : artifactPreviewItems.map((item) => ({ ...item, description: item.description, example: true }));
  const sourceEntries = [...personalEntries, ...examples];
  const entries = selectedCollection ? sourceEntries.filter((item) => item.collection === selectedCollection) : sourceEntries.filter((item) => item.category === selectedCategory);
  const activeTitle = selectedCollection ?? selectedCategory ?? "";
  const activeLabel = selectedCollection ? "FEATURED COLLECTION" : "COLLECTION CATEGORY";

  if (selectedCategory || selectedCollection) return <section className="collection-panel artifact-gallery-panel">
    <div className="artifact-gallery-top"><button type="button" onClick={() => { setSelectedCategory(null); setSelectedCollection(null); }}>← 返回我的藏品</button><span>{entries.length} 件记录</span></div>
    <div className="artifact-gallery-heading"><div><p>{activeLabel}</p><h2>{activeTitle}</h2></div><div className="artifact-gallery-filters"><b>全部</b><span>A–Z</span><span>时间</span></div></div>
    <div className="artifact-mosaic">{entries.map((item) => <article className="artifact-tile" key={item.id}>
      {item.image ? <img src={item.image} alt={item.title}/> : <div className="artifact-image-placeholder">尚未添加图片</div>}
      <div className="artifact-tile-overlay"><span>{item.example ? "开放馆藏示例" : item.category}</span><h3>{item.title}</h3><small>{item.creator} · {item.era}</small><p>{item.description}</p>{item.example && <a href={item.source} target="_blank" rel="noreferrer">查看来源</a>}</div>
    </article>)}</div>
    {!entries.length && <div className="empty-state"><b>这个类别尚无藏品</b><p>可从左侧“藏品管理”新增记录并上传图片；随后会自动出现在这里。</p></div>}
  </section>;

  return <section className="collection-panel artifact-home-panel">
    <section className="artifact-feature-section"><h3>集锦</h3><div className="artifact-feature-grid">{personalArtifactFeatureSets.map((feature) => <button type="button" className="artifact-feature-card" key={feature.title} onClick={() => setSelectedCollection(feature.collection)}><img src={feature.image} alt=""/><span><b>{feature.title}</b><small>{feature.description}</small></span></button>)}</div></section>
    <section className="artifact-category-section"><div><h3>类别</h3><p>每个类别均准备 8 条带图片和说明的测试记录；点击即可查看方块图像墙。</p></div><div className="artifact-category-grid">{allCategories.map((category, index) => { const sample = sourceEntries.find((item) => item.category === category); const count = sourceEntries.filter((item) => item.category === category).length; return <button type="button" className="artifact-category-card" key={category} onClick={() => setSelectedCategory(category)}>{sample?.image ? <img src={sample.image} alt=""/> : <div className={`artifact-category-swatch tone-${index % 4}`}/>}<span><b>{category}</b><small>{count} 件记录</small></span></button>; })}</div></section>
    {!artifacts.length && <p className="artifact-preview-note">当前没有你的藏品记录；画面中的开放馆藏图片仅用于帮助预览浏览效果，不会写入个人藏品。</p>}
  </section>;
}

function ManagementPanel({ type, items, initialView = "table", onSaved, onItemSaved, categories = defaultArtifactCategories, onCategoriesChanged = async () => {} }: { type: ItemType; items: PersonalItem[]; initialView?: "table" | "create"; onSaved: () => Promise<void>; onItemSaved?: (item: PersonalItem) => void; categories?: string[]; onCategoriesChanged?: () => Promise<void> }) {
  const [bookView, setBookView] = useState<"table" | "create">(initialView);
  const [artifactView, setArtifactView] = useState<"table" | "create">(initialView);
  if (type === "BOOK") {
    if (bookView === "table") return <BookManagementTable items={items} onAdd={() => setBookView("create")} onSaved={onSaved} onItemSaved={onItemSaved} />;
    return <CollectionEntryPanel type={type} items={items} onBack={() => setBookView("table")} onSaved={async () => { await onSaved(); setBookView("table"); }} />;
  }
  if (artifactView === "table") return <ArtifactManagementTable items={items} categories={categories} onAdd={() => setArtifactView("create")} onSaved={onSaved} />;
  return <CollectionEntryPanel type={type} items={items} categories={categories} onCategoriesChanged={onCategoriesChanged} onBack={() => setArtifactView("table")} onSaved={async () => { await onSaved(); setArtifactView("table"); }} />;
}

const personalStatusLabel: Record<PersonalItem["status"], string> = {
  DRAFT: "", PENDING: "审核中", APPROVED: "", REJECTED: "已退回", NEEDS_REVISION: "待补充", ARCHIVED: "已归档",
};

function PublicationControls({ item, onChanged }: { item: PersonalItem; onChanged: () => Promise<void> }) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (action: "APPLY_PUBLIC" | "WITHDRAW" | "SET_PRIVATE") => {
    setWorking(true); setMessage("");
    try {
      const response = await fetch(`/api/personal-collection/items/${item.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) return setMessage(body.message ?? "操作未完成。");
      if (action !== "APPLY_PUBLIC") setMessage(action === "WITHDRAW" ? "已撤回申请" : "已撤回公开");
      await onChanged();
    } catch { setMessage("操作未完成。"); } finally { setWorking(false); }
  };
  return <div className="personal-publication-controls">{personalStatusLabel[item.status] && <span className={`publication-status status-${item.status.toLowerCase()}`}>{personalStatusLabel[item.status]}</span>}
    {item.status === "DRAFT" || item.status === "REJECTED" || item.status === "NEEDS_REVISION" ? <button type="button" disabled={working} onClick={() => void run("APPLY_PUBLIC")}>{working ? "申请中" : "申请公开"}</button> : null}
    {item.status === "PENDING" ? <button type="button" className="publication-withdraw" disabled={working} onClick={() => void run("WITHDRAW")}>{working ? "处理中" : "撤回"}</button> : null}
    {item.status === "APPROVED" && item.isPublic && <><a href={`/personal-collection/public/${item.id}`} target="_blank" rel="noreferrer">查看</a><button type="button" disabled={working} onClick={() => void run("SET_PRIVATE")}>{working ? "处理中" : "撤回"}</button></>}
    {message && <small>{message}</small>}
  </div>;
}

function BookManagementTable({ items, onAdd, onSaved, onItemSaved = () => {} }: { items: PersonalItem[]; onAdd: () => void; onSaved: () => Promise<void>; onItemSaved?: (item: PersonalItem) => void }) {
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [uploadingIds, setUploadingIds] = useState<string[]>([]);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => { if (!rows.length && items.length) setRows(items); }, [items, rows.length]);
  useEffect(() => () => { timers.current.forEach((timer) => clearTimeout(timer)); }, []);

  const text = (value: string | null) => value ?? "";
  const saveRow = async (row: PersonalItem) => {
    if (!row.title.trim()) return setMessage("书名不能为空。");
    setSavingIds((current) => current.includes(row.id) ? current : [...current, row.id]);
    try {
      const response = await fetch("/api/personal-collection/items", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, type: "BOOK", title: row.title, creator: text(row.creator), era: text(row.era), eraDetail: text(row.eraDetail), publicationDate: text(row.publicationDate), imprintPublisher: text(row.imprintPublisher), editionOrCategory: text(row.editionOrCategory), binding: text(row.binding), categories: row.categories, volumeCount: row.volumeCount, description: text(row.description) }),
      });
      const result = await response.json();
      if (!response.ok) return setMessage(result.message ?? "自动保存失败，请稍后重试。");
      setMessage(`已自动保存“${result.title}”，书架已同步更新。`);
      onItemSaved({ ...row, ...result, media: row.media });
    } catch { setMessage("自动保存未完成，请确认本地服务仍在运行后重试。"); }
    finally { setSavingIds((current) => current.filter((id) => id !== row.id)); }
  };
  const queueSave = (row: PersonalItem) => {
    const previous = timers.current.get(row.id);
    if (previous) clearTimeout(previous);
    timers.current.set(row.id, setTimeout(() => { timers.current.delete(row.id); void saveRow(row); }, 700));
  };
  const updateRow = <K extends keyof PersonalItem>(id: string, key: K, value: PersonalItem[K]) => {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, [key]: value };
      queueSave(updated);
      return updated;
    }));
  };
  const replacePrimaryCategory = (row: PersonalItem, value: string) => {
    const remaining = row.categories.filter((category, index) => index > 0 && category !== value);
    updateRow(row.id, "categories", value ? [value, ...remaining] : remaining);
  };
  const deleteRow = async (row: PersonalItem) => {
    if (!window.confirm(`确认删除“${row.title}”吗？删除后无法恢复。`)) return;
    const pending = timers.current.get(row.id);
    if (pending) clearTimeout(pending);
    timers.current.delete(row.id);
    setDeletingIds((current) => [...current, row.id]);
    try {
      const response = await fetch("/api/personal-collection/items", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, type: "BOOK" }),
      });
      const result = await response.json();
      if (!response.ok) return setMessage(result.message ?? "删除失败，请稍后重试。");
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage(`已删除“${row.title}”，书架已同步更新。`);
      await onSaved();
    } catch { setMessage("删除请求未完成，请确认本地服务仍在运行后重试。"); }
    finally { setDeletingIds((current) => current.filter((id) => id !== row.id)); }
  };
  const applyAllBooks = async () => {
    const candidates = rows.filter((row) => ["DRAFT", "REJECTED", "NEEDS_REVISION"].includes(row.status));
    const eligible = candidates.filter((row) => row.media.length > 0);
    const withoutImage = candidates.length - eligible.length;
    if (!candidates.length) return setApplyMessage("当前没有可申请公开的藏书。");
    if (!eligible.length) return setApplyMessage("没有带图片的藏书可申请公开；请至少为每本书上传一张图片。");
    if (!window.confirm(`将为 ${eligible.length} 本带照片的藏书发起公开申请${withoutImage ? `；另有 ${withoutImage} 本未上传照片，已自动跳过` : ""}。是否继续？`)) return;
    setApplyingAll(true);
    setApplyMessage("");
    try {
      const response = await fetch("/api/personal-collection/items/publication", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPLY_BOOKS" }) });
      const result = await response.json();
      if (!response.ok) return setApplyMessage(result.message ?? "公开申请未完成。");
      setApplyMessage(`已申请 ${result.submitted} 本藏书，并已通知 ${result.reviewersNotified ?? 0} 位审核人员${result.skippedWithoutImage ? `；${result.skippedWithoutImage} 本因未上传照片未提交` : ""}。`);
      await onSaved();
    } catch { setApplyMessage("公开申请未完成，请稍后重试。"); }
    finally { setApplyingAll(false); }
  };
  const uploadImages = async (row: PersonalItem, files: FileList | null) => {
    const selected = Array.from(files ?? []).slice(0, Math.max(0, 2 - row.media.length)); if (!selected.length) return setMessage("每本书最多保存 2 张图片。");
    setUploadingIds((current) => [...current, row.id]);
    try { for (const file of selected) { const data = new FormData(); data.set("file", file); const response = await fetch(`/api/personal-collection/items/${row.id}/media`, { method: "POST", body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "图片上传失败。"); } await onSaved(); setMessage(`已为“${row.title}”保存 ${selected.length} 张图片。`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "图片上传失败。"); }
    finally { setUploadingIds((current) => current.filter((id) => id !== row.id)); }
  };
  const deleteImage = async (row: PersonalItem, mediaId: string) => {
    const response = await fetch(`/api/personal-collection/items/${row.id}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId }) }); const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "图片删除失败。"); await onSaved(); setMessage("图片已删除。");
  };

  return <section className="collection-panel book-table-panel">
    <div className="panel-heading book-table-heading"><div><p>BOOK MANAGEMENT</p><h2>书籍管理</h2></div><div className="book-table-actions"><span className="book-apply-feedback" aria-live="polite">{applyMessage}</span><button className="book-apply-all-button" type="button" disabled={applyingAll} onClick={() => void applyAllBooks()}>{applyingAll ? "申请中…" : "一键公开藏书"}</button><a className="book-add-button" href="/personal-collection?section=books&view=create" onClick={(event) => { event.preventDefault(); onAdd(); }}>＋ 添加书籍</a></div></div>
    <p className="book-table-note">所有手动新增及 CSV 导入的书目均在此显示。直接修改字段即可自动保存；分类下拉框调整主分类，已有附加分类会保留。</p>
    <div className="book-table-scroll"><table className="book-management-table compact-book-table"><colgroup><col className="book-col-serial"/><col className="book-col-category"/><col className="book-col-title"/><col className="book-col-author"/><col className="book-col-volumes"/><col className="book-col-era-detail"/><col className="book-col-date"/><col className="book-col-publisher"/><col className="book-col-edition"/><col className="book-col-binding"/><col className="book-col-note"/><col className="book-col-action"/></colgroup><thead><tr><th>编号</th><th>分类</th><th>书名</th><th>作者</th><th>册数</th><th>刊刻年份</th><th>刊刻时间</th><th>刊刻主体</th><th>版本</th><th>装帧</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.id} data-saving={savingIds.includes(row.id)}>
        <td className="serial-cell"><span>{row.serialNumber}</span><div className="book-row-images">{row.media.map((media) => <span key={media.id}><img src={mediaUrl(row, media.id)} alt="书籍图片"/><button type="button" aria-label="删除图片" onClick={() => void deleteImage(row, media.id)}>×</button></span>)}{row.media.length < 2 && <label className="book-image-upload">{uploadingIds.includes(row.id) ? "上传中" : "+ 图"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadImages(row, event.target.files); event.currentTarget.value = ""; }}/></label>}</div>{savingIds.includes(row.id) && <small>保存中</small>}</td>
        <td><select aria-label={`${row.title}的分类`} title={row.categories.join("；")} value={row.categories[0] ?? ""} onChange={(event) => replacePrimaryCategory(row, event.target.value)}><option value="">未分类</option>{manuscriptCategoryGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option value={option} key={option}>{option}</option>)}</optgroup>)}</select></td>
        <td><input aria-label="书名" value={row.title} onChange={(event) => updateRow(row.id, "title", event.target.value)}/></td>
        <td><div className="author-era-cell"><select aria-label="作者年代" value={text(row.era)} onChange={(event) => updateRow(row.id, "era", event.target.value)}>{authorEraOptions.map((option) => <option value={option} key={option}>{option || "—"}</option>)}</select><input aria-label="作者" value={text(row.creator)} onChange={(event) => updateRow(row.id, "creator", event.target.value)}/></div></td>
        <td><input aria-label="册数" type="number" min="1" max="999" value={row.volumeCount} onChange={(event) => updateRow(row.id, "volumeCount", Math.max(1, Number(event.target.value) || 1))}/></td>
        <td><input aria-label="刊刻年份" value={text(row.eraDetail)} onChange={(event) => updateRow(row.id, "eraDetail", event.target.value)}/></td>
        <td><input aria-label="刊刻时间" value={text(row.publicationDate)} onChange={(event) => updateRow(row.id, "publicationDate", event.target.value)}/></td>
        <td><input aria-label="刊刻主体" value={text(row.imprintPublisher)} onChange={(event) => updateRow(row.id, "imprintPublisher", event.target.value)}/></td>
        <td><input aria-label="版本" value={text(row.editionOrCategory)} onChange={(event) => updateRow(row.id, "editionOrCategory", event.target.value)}/></td>
        <td><input aria-label="装帧" value={text(row.binding)} onChange={(event) => updateRow(row.id, "binding", event.target.value)}/></td>
        <td><textarea aria-label="备注" value={text(row.description)} onChange={(event) => updateRow(row.id, "description", event.target.value)}/></td>
        <td className="record-action-cell"><div className="record-action-stack"><PublicationControls item={row} onChanged={onSaved}/><button className="book-delete-button" type="button" disabled={deletingIds.includes(row.id)} onClick={() => void deleteRow(row)}>{deletingIds.includes(row.id) ? "删除中" : "删除"}</button></div></td>
      </tr>) : <tr><td className="book-table-empty" colSpan={12}>尚无个人书籍。请使用右上角“＋ 添加书籍”录入，或在进入后的页面导入 CSV。</td></tr>}</tbody>
    </table></div>{message && <p className="personal-message">{message}</p>}
  </section>;
}

function ArtifactManagementTable({ items, categories, onAdd, onSaved }: { items: PersonalItem[]; categories: string[]; onAdd: () => void; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [uploadingIds, setUploadingIds] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  useEffect(() => setRows(items), [items]);
  const text = (value: string | null) => value ?? "";
  const saveRow = async (row: PersonalItem) => {
    if (!row.title.trim()) return setMessage("藏品名称不能为空。");
    setSavingIds((current) => current.includes(row.id) ? current : [...current, row.id]);
    try {
      const response = await fetch("/api/personal-collection/items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, type: "ARTIFACT", title: row.title, creator: text(row.creator), era: text(row.era), editionOrCategory: text(row.editionOrCategory), price: text(row.price), volumeCount: row.volumeCount, description: text(row.description) }) });
      const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "保存失败，请稍后重试。");
      setMessage(`已保存“${body.title}”。`); await onSaved();
    } catch { setMessage("保存请求未完成，请确认本地服务仍在运行后重试。"); }
    finally { setSavingIds((current) => current.filter((id) => id !== row.id)); }
  };
  const updateRow = <K extends keyof PersonalItem>(id: string, key: K, value: PersonalItem[K]) => setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const deleteRow = async (row: PersonalItem) => {
    if (!window.confirm(`确认删除“${row.title}”吗？删除后无法恢复。`)) return;
    const response = await fetch("/api/personal-collection/items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, type: "ARTIFACT" }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "删除失败。");
    setRows((current) => current.filter((item) => item.id !== row.id)); setMessage(`已删除“${row.title}”。`); await onSaved();
  };
  const uploadImages = async (row: PersonalItem, files: FileList | null) => {
    const selected = Array.from(files ?? []).slice(0, Math.max(0, 3 - row.media.length)); if (!selected.length) return setMessage("每件藏品最多保存 3 张图片。");
    setUploadingIds((current) => [...current, row.id]);
    try { for (const file of selected) { const data = new FormData(); data.set("file", file); const response = await fetch(`/api/personal-collection/items/${row.id}/media`, { method: "POST", body: data }); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "图片上传失败。"); } await onSaved(); setMessage(`已为“${row.title}”保存 ${selected.length} 张图片。`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "图片上传失败。"); }
    finally { setUploadingIds((current) => current.filter((id) => id !== row.id)); }
  };
  const deleteImage = async (row: PersonalItem, mediaId: string) => {
    const response = await fetch(`/api/personal-collection/items/${row.id}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId }) }); const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "图片删除失败。"); await onSaved(); setMessage("图片已删除。");
  };
  const addExamples = async () => {
    setSeeding(true);
    try { const response = await fetch("/api/personal-collection/artifact-examples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) }); const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "无法加入示例素材。"); setMessage(body.message ?? "示例素材已加入。"); await onSaved(); }
    catch { setMessage("示例素材加入未完成，请确认本地服务仍在运行后重试。"); }
    finally { setSeeding(false); }
  };
  return <section className="collection-panel book-table-panel artifact-table-panel">
    <div className="panel-heading book-table-heading"><div><p>OBJECT MANAGEMENT</p><h2>藏品管理</h2></div><div className="artifact-table-actions">{message && <small>{message}</small>}<button className="artifact-example-button" type="button" disabled={seeding} onClick={() => void addExamples}>{seeding ? "正在加入…" : "加载示例素材"}</button><button className="book-add-button" type="button" onClick={onAdd}>＋ 添加藏品</button></div></div>
    <p className="book-table-note">所有手动新增及 CSV 导入的藏品均在此显示。修改字段后离开输入框即可保存；图片最多 3 张。</p>
    <div className="book-table-scroll"><table className="book-management-table artifact-management-table"><colgroup><col className="artifact-col-serial"/><col className="artifact-col-category"/><col className="artifact-col-title"/><col className="artifact-col-creator"/><col className="artifact-col-era"/><col className="artifact-col-price"/><col className="artifact-col-volume"/><col className="artifact-col-note"/><col className="artifact-col-action"/></colgroup><thead><tr><th>编号／图片</th><th>类别</th><th>藏品名称</th><th>作者／来源</th><th>年代</th><th>价格</th><th>数量</th><th>说明</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id} data-saving={savingIds.includes(row.id)}>
      <td className="serial-cell"><span>{row.serialNumber}</span><div className="book-row-images">{row.media.map((media) => <span key={media.id}><img src={mediaUrl(row, media.id)} alt="藏品图片"/><button type="button" aria-label="删除图片" onClick={() => void deleteImage(row, media.id)}>×</button></span>)}{!row.media.length && previewForExampleTitle(row.title) && <span className="example-image"><img src={previewForExampleTitle(row.title)} alt="开放馆藏示例图片"/></span>}{row.media.length < 3 && <label className="book-image-upload">{uploadingIds.includes(row.id) ? "上传中" : "+ 图"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadImages(row, event.target.files); event.currentTarget.value = ""; }}/></label>}</div></td>
      <td><select aria-label={`${row.title}的类别`} value={text(row.editionOrCategory)} onChange={(event) => updateRow(row.id, "editionOrCategory", event.target.value)} onBlur={(event) => void saveRow({ ...row, editionOrCategory: event.currentTarget.value })}><option value="">请选择</option>{[...new Set([...categories, text(row.editionOrCategory)])].filter(Boolean).map((category) => <option value={category} key={category}>{category}</option>)}</select></td>
      <td><input aria-label="藏品名称" value={row.title} onChange={(event) => updateRow(row.id, "title", event.target.value)} onBlur={(event) => void saveRow({ ...row, title: event.currentTarget.value })}/></td>
      <td><input aria-label="作者或来源" value={text(row.creator)} onChange={(event) => updateRow(row.id, "creator", event.target.value)} onBlur={(event) => void saveRow({ ...row, creator: event.currentTarget.value })}/></td>
      <td><input aria-label="年代" value={text(row.era)} onChange={(event) => updateRow(row.id, "era", event.target.value)} onBlur={(event) => void saveRow({ ...row, era: event.currentTarget.value })}/></td>
      <td><input aria-label="价格" value={text(row.price)} onChange={(event) => updateRow(row.id, "price", event.target.value)} onBlur={(event) => void saveRow({ ...row, price: event.currentTarget.value })}/></td>
      <td><input aria-label="数量" type="number" min="1" max="999" value={row.volumeCount} onChange={(event) => updateRow(row.id, "volumeCount", Math.max(1, Number(event.target.value) || 1))} onBlur={(event) => void saveRow({ ...row, volumeCount: Math.max(1, Number(event.currentTarget.value) || 1) })}/></td>
      <td><textarea aria-label="说明" value={text(row.description)} onChange={(event) => updateRow(row.id, "description", event.target.value)} onBlur={(event) => void saveRow({ ...row, description: event.currentTarget.value })}/></td>
       <td className="record-action-cell"><div className="record-action-stack"><PublicationControls item={row} onChanged={onSaved}/><button className="book-delete-button" type="button" onClick={() => void deleteRow(row)}>删除</button></div></td>
    </tr>) : <tr><td className="book-table-empty" colSpan={9}>尚无个人藏品。请使用右上角“＋ 添加藏品”录入。</td></tr>}</tbody></table></div>{message && <p className="personal-message">{message}</p>}
  </section>;
}

function BookManagementTableLegacy({ items, onAdd, onSaved }: { items: PersonalItem[]; onAdd: () => void; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  useEffect(() => setRows(items), [items]);

  const updateRow = <K extends keyof PersonalItem>(id: string, key: K, value: PersonalItem[K]) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  };
  const text = (value: string | null) => value ?? "";
  const saveRow = async (row: PersonalItem) => {
    if (!row.title.trim()) return setMessage("书名不能为空。");
    setSavingId(row.id); setMessage("");
    try {
      const response = await fetch("/api/personal-collection/items", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, type: "BOOK", title: row.title, creator: text(row.creator), era: text(row.era), eraDetail: text(row.eraDetail), publicationDate: text(row.publicationDate), imprintPublisher: text(row.imprintPublisher), editionOrCategory: text(row.editionOrCategory), binding: text(row.binding), categories: row.categories, volumeCount: row.volumeCount, description: text(row.description) }),
      });
      const result = await response.json();
      if (!response.ok) return setMessage(result.message ?? "保存失败，请稍后重试。");
      setMessage(`已保存“${result.title}”，书架将同步更新。`);
      await onSaved();
    } catch { setMessage("保存请求未完成，请确认本地服务仍在运行后重试。"); }
    finally { setSavingId(null); }
  };

  return <section className="collection-panel book-table-panel">
    <div className="panel-heading book-table-heading"><div><p>BOOK MANAGEMENT</p><h2>书籍管理</h2></div><button className="book-add-button" type="button" onClick={onAdd}>＋ 添加书籍</button></div>
    <p className="book-table-note">所有手动新增及 CSV 导入的书目均在此显示。可直接修改单行内容，点击“保存”后会同步至我的书架。</p>
    <div className="book-table-scroll"><table className="book-management-table"><thead><tr><th>编号</th><th>分类</th><th>书名</th><th>作者</th><th>册数</th><th>年代</th><th>刊刻年份</th><th>刊刻时间</th><th>刊刻主体</th><th>版本</th><th>装帧</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.id}>
        <td className="serial-cell">{row.serialNumber}</td>
        <td><input aria-label={`${row.title}的分类`} value={row.categories.join("；")} onChange={(event) => updateRow(row.id, "categories", event.target.value.split(/[、,，;；\n]/).map((value) => value.trim()).filter(Boolean))}/></td>
        <td><input aria-label="书名" value={row.title} onChange={(event) => updateRow(row.id, "title", event.target.value)}/></td>
        <td><input aria-label="作者" value={text(row.creator)} onChange={(event) => updateRow(row.id, "creator", event.target.value)}/></td>
        <td><input aria-label="册数" type="number" min="1" max="999" value={row.volumeCount} onChange={(event) => updateRow(row.id, "volumeCount", Math.max(1, Number(event.target.value) || 1))}/></td>
        <td><input aria-label="年代" value={text(row.era)} onChange={(event) => updateRow(row.id, "era", event.target.value)}/></td>
        <td><input aria-label="刊刻年份" value={text(row.eraDetail)} onChange={(event) => updateRow(row.id, "eraDetail", event.target.value)}/></td>
        <td><input aria-label="刊刻时间" value={text(row.publicationDate)} onChange={(event) => updateRow(row.id, "publicationDate", event.target.value)}/></td>
        <td><input aria-label="刊刻主体" value={text(row.imprintPublisher)} onChange={(event) => updateRow(row.id, "imprintPublisher", event.target.value)}/></td>
        <td><input aria-label="版本" value={text(row.editionOrCategory)} onChange={(event) => updateRow(row.id, "editionOrCategory", event.target.value)}/></td>
        <td><input aria-label="装帧" value={text(row.binding)} onChange={(event) => updateRow(row.id, "binding", event.target.value)}/></td>
        <td><textarea aria-label="备注" value={text(row.description)} onChange={(event) => updateRow(row.id, "description", event.target.value)}/></td>
        <td><button className="book-table-save" type="button" disabled={savingId === row.id} onClick={() => void saveRow(row)}>{savingId === row.id ? "保存中…" : "保存"}</button></td>
      </tr>) : <tr><td className="book-table-empty" colSpan={13}>尚无个人书籍。请使用右上角“＋ 添加书籍”录入，或在进入后的页面导入 CSV。</td></tr>}</tbody>
    </table></div>{message && <p className="personal-message">{message}</p>}
  </section>;
}

function CollectionEntryPanel({ type, items, onSaved, onBack, categories = defaultArtifactCategories, onCategoriesChanged = async () => {} }: { type: ItemType; items: PersonalItem[]; onSaved: () => Promise<void>; onBack?: () => void; categories?: string[]; onCategoriesChanged?: () => Promise<void> }) {
  const section = type === "BOOK" ? "books" : "artifacts";
  return <>{onBack && <div className="entry-backbar"><a className="management-back-button" href={`/personal-collection?section=${section}`} onClick={(event) => { event.preventDefault(); onBack(); }}>← 返回{type === "BOOK" ? "书籍" : "藏品"}管理</a></div>}<CollectionEntryPanelLegacy type={type} items={items} categories={categories} onCategoriesChanged={onCategoriesChanged} onSaved={onSaved}/></>;
}

function CollectionEntryPanelLegacy({ type, items, onSaved, categories, onCategoriesChanged }: { type: ItemType; items: PersonalItem[]; onSaved: () => Promise<void>; categories: string[]; onCategoriesChanged: () => Promise<void> }) {
  const label = type === "BOOK" ? "书籍" : "藏品";
  const [message, setMessage] = useState(""); const [file, setFile] = useState<File>(); const [isImporting, setIsImporting] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]); const [isSaving, setIsSaving] = useState(false);
  const [bookMetadata, setBookMetadata] = useState(blankManuscriptMetadata()); const fileInputRef = useRef<HTMLInputElement>(null);
  const [artifactCategory, setArtifactCategory] = useState(""); const [newArtifactCategory, setNewArtifactCategory] = useState(""); const [categoryMessage, setCategoryMessage] = useState("");
  const addArtifactCategory = async () => {
    const name = newArtifactCategory.trim(); if (!name) return;
    const response = await fetch("/api/personal-collection/artifact-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const body = await response.json();
    if (!response.ok) return setCategoryMessage(body.message ?? "无法新增类别。");
    setArtifactCategory(name); setNewArtifactCategory(""); setCategoryMessage(`已新增“${name}”，可直接保存藏品。`); await onCategoriesChanged();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (type === "ARTIFACT" && artifactCategory === "__new__") return setMessage("请先新增类别，再保存藏品。"); const data = new FormData(event.currentTarget);
    const body = type === "BOOK"
      ? { type, title: data.get("title"), creator: bookMetadata.author, era: bookMetadata.dynasty, eraDetail: bookMetadata.eraDetail, publicationDate: bookMetadata.publicationDate, imprintPublisher: bookMetadata.imprintPublisher, editionOrCategory: bookMetadata.versionType, binding: bookMetadata.binding, categories: bookMetadata.categories, volumeCount: bookMetadata.volumeCount, description: bookMetadata.description }
      : { type, title: data.get("title"), creator: data.get("creator"), era: data.get("era"), editionOrCategory: artifactCategory, price: data.get("price"), volumeCount: data.get("volumeCount"), description: data.get("description") };
    setIsSaving(true);
    try {
      const response = await fetch("/api/personal-collection/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json();
      if (!response.ok) return setMessage(result.message ?? `无法新增${label}。`);
      let uploaded = 0;
      for (const image of pendingImages) { const imageData = new FormData(); imageData.set("file", image); const imageResponse = await fetch(`/api/personal-collection/items/${result.id}/media`, { method: "POST", body: imageData }); if (imageResponse.ok) uploaded += 1; }
      event.currentTarget.reset(); setPendingImages([]); if (type === "BOOK") setBookMetadata(blankManuscriptMetadata()); else setArtifactCategory(""); setMessage(`已新增“${result.title}”${uploaded ? `，并保存 ${uploaded} 张图片` : ""}。`); await onSaved();
    } catch { setMessage(`无法新增${label}，请确认本地服务仍在运行。`); } finally { setIsSaving(false); }
  };
  const importCsv = async (event: FormEvent) => {
    event.preventDefault(); if (!file) return setMessage("请选择 Excel 或 CSV 文件。"); if (!/\.(xlsx|csv)$/i.test(file.name)) return setMessage("请选择扩展名为 .xlsx 或 .csv 的文件。"); if (file.size > 5 * 1024 * 1024) return setMessage("批量导入文件不能超过 5 MB。");
    setIsImporting(true); setMessage("正在批量导入，请稍候……");
    try { const data = new FormData(); data.set("file", file); data.set("type", type); const response = await fetch("/api/personal-collection/items/import", { method: "POST", body: data }); const body = await response.json().catch(() => ({})); if (!response.ok) return setMessage(body.message ?? "批量导入失败，请检查模板和必填列。"); setFile(undefined); if (fileInputRef.current) fileInputRef.current.value = ""; setMessage(`已导入 ${body.created} 条${label}记录。`); await onSaved(); } catch { setMessage("导入请求未完成，请确认本地服务仍在运行后重试。"); } finally { setIsImporting(false); }
  };
  return <section className={`collection-panel management-panel ${type === "BOOK" ? "book-entry-panel" : ""}`}>
    {type !== "BOOK" && <div className="panel-heading"><div><p>OBJECT MANAGEMENT</p><h2>{label}管理</h2></div><span>{items.length} 条</span></div>}
    <div className="management-layout">
      <form className="personal-form" action="/api/personal-collection/items" method="post" onSubmit={(event) => void submit(event)}><input type="hidden" name="type" value={type}/><div className="personal-entry-heading"><h3>新增{label}</h3><button disabled={isSaving}>{isSaving ? "正在保存…" : `保存${label}`}</button></div>{type === "BOOK" ? <><div className="book-title-category-row"><label>书名<input name="title" required /></label><ManuscriptCategoryPicker compact value={bookMetadata} onChange={(patch) => setBookMetadata((current) => ({ ...current, ...patch }))}/></div><div className="entry-image-picker"><strong>书籍图片</strong><span>可先选择，保存时自动上传（最多 2 张）</span><label>选择图片<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setPendingImages(Array.from(event.target.files ?? []).slice(0, 2))}/></label>{pendingImages.length > 0 && <small>{pendingImages.map((image) => image.name).join("；")}</small>}</div><ManuscriptMetadataFields value={bookMetadata} onChange={(patch) => setBookMetadata((current) => ({ ...current, ...patch }))} showCategories={false}/></> : <><div className="artifact-title-category-row"><label>藏品名称<input name="title" required /></label><label>类别<select name="editionOrCategory" value={artifactCategory} required onChange={(event) => setArtifactCategory(event.target.value)}><option value="">请选择类别</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}<option value="__new__">＋ 新建类别…</option></select></label></div>{artifactCategory === "__new__" && <div className="artifact-category-create"><input value={newArtifactCategory} placeholder="如：印章" onChange={(event) => setNewArtifactCategory(event.target.value)}/><button type="button" onClick={() => void addArtifactCategory()}>新增类别</button>{categoryMessage && <small>{categoryMessage}</small>}</div>}<div className="personal-form-grid"><label>作者／来源<input name="creator" /></label><label>年代<input name="era" /></label></div><div className="personal-form-grid"><label>价格<input name="price" placeholder="如：¥ 800" /></label><label>数量<input name="volumeCount" type="number" min="1" max="999" defaultValue="1" /></label></div><div className="entry-image-picker"><strong>藏品图片</strong><span>可先选择，保存时自动上传（最多 3 张）</span><label>选择图片<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setPendingImages(Array.from(event.target.files ?? []).slice(0, 3))}/></label>{pendingImages.length > 0 && <small>{pendingImages.map((image) => image.name).join("；")}</small>}</div><label>说明<textarea name="description" /></label></>}</form>
      <form className="personal-import" onSubmit={(event) => void importCsv(event)}>
        <h3>批量导入</h3>
        <p>{type === "BOOK" ? "书籍 Excel／CSV 与公共古籍录入使用同一套核心书目字段；资料只属于当前账户，不进入公共馆藏。" : "可一次导入多条个人藏品；资料只属于当前账户，不进入公共馆藏。"}</p>
        <div className="template-downloads"><a href="/templates/个人书籍导入模板（分类下拉）.xlsx" download>下载 Excel 模板</a><small>推荐使用：书籍分类带下拉菜单；可直接上传 Excel，无需另存为 CSV。</small></div>
        <div className="template-downloads plain-template-download"><a href="/api/personal-collection/template">下载 CSV 模板</a><small>CSV 不支持下拉菜单；Excel 与 CSV 均可直接导入。</small></div>
        <label>选择 Excel 或 CSV 文件<input ref={fileInputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => setFile(event.target.files?.[0])}/></label>{file && <small>已选择：{file.name}</small>}<button disabled={isImporting}>{isImporting ? "正在导入……" : "开始导入"}</button>
      </form>
    </div>{message && <p className="personal-message">{message}</p>}
  </section>;
}
