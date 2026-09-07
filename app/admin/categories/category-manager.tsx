"use client";

import { useMemo, useState } from "react";
import { manuscriptCategoryTree, type ResourceCategoryNode } from "../../../lib/manuscript-categories";

type Request = { id: string; scope: string; proposedName: string; requestReason: string; status: string };
type Category = { id: string; scope: string; name: string; parentName?: string | null; description?: string | null; isActive: boolean; usageCount: number };
type Row = { first: string; second: string; third: string; note?: string };

function categoryCode(name: string) {
  return name.match(/^(\d+(?:\.\d+)*)/)?.[1] ?? "";
}

const chineseDigits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function chineseNumber(value: number) {
  if (value < 10) return Object.entries(chineseDigits).find(([, number]) => number === value)?.[0] ?? "";
  if (value === 10) return "十";
  if (value < 20) return `十${Object.entries(chineseDigits).find(([, number]) => number === value - 10)?.[0] ?? ""}`;
  const tens = Object.entries(chineseDigits).find(([, number]) => number === Math.floor(value / 10))?.[0] ?? "";
  const ones = value % 10 ? Object.entries(chineseDigits).find(([, number]) => number === value % 10)?.[0] ?? "" : "";
  return `${tens}十${ones}`;
}

function rootSequence(name: string) {
  const prefix = name.split("、")[0] ?? "";
  if (/^\d+$/.test(prefix)) return Number(prefix);
  if (prefix === "十") return 10;
  if (prefix.startsWith("十")) return 10 + (chineseDigits[prefix[1]] ?? 0);
  if (prefix.endsWith("十")) return (chineseDigits[prefix[0]] ?? 0) * 10;
  if (prefix.length === 3 && prefix[1] === "十") return (chineseDigits[prefix[0]] ?? 0) * 10 + (chineseDigits[prefix[2]] ?? 0);
  return chineseDigits[prefix] ?? 0;
}

function nextChildCode(parentCode: string, items: Category[]) {
  const prefix = parentCode ? `${parentCode}.` : "";
  const max = items.reduce((highest, item) => {
    const segments = categoryCode(item.name).split(".");
    const last = Number(segments.at(-1));
    return Number.isFinite(last) ? Math.max(highest, last) : highest;
  }, 0);
  return `${prefix}${max + 1}`;
}

function toRows(nodes: ResourceCategoryNode[]): Row[] {
  return nodes.flatMap((first) => {
    if (!first.children?.length) return [{ first: first.name, second: "", third: "", note: first.note }];
    return first.children.flatMap((second) =>
      second.children?.length
        ? second.children.map((third) => ({ first: first.name, second: second.name, third: third.name, note: third.note }))
        : [{ first: first.name, second: second.name, third: "", note: second.note }],
    );
  });
}

function managedRows(categories: Category[], scope: string): Row[] {
  const ordered = [...categories].filter((item) => item.scope === scope).sort((left, right) => categoryCode(left.name).localeCompare(categoryCode(right.name), undefined, { numeric: true }) || left.name.localeCompare(right.name, "zh-CN"));
  const childrenOf = (parentName: string) => ordered.filter((item) => item.parentName === parentName);
  return ordered.filter((item) => !item.parentName).flatMap((first) => {
    const second = childrenOf(first.name);
    if (!second.length) return [{ first: first.name, second: "", third: "", note: first.description ?? undefined }];
    return second.flatMap((secondItem) => {
      const third = childrenOf(secondItem.name);
      return third.length ? third.map((thirdItem) => ({ first: first.name, second: secondItem.name, third: thirdItem.name, note: thirdItem.description ?? undefined })) : [{ first: first.name, second: secondItem.name, third: "", note: secondItem.description ?? undefined }];
    });
  });
}

function firstSpan(rows: Row[], index: number) {
  let size = 1;
  while (rows[index + size]?.first === rows[index].first) size += 1;
  return size;
}

function secondSpan(rows: Row[], index: number) {
  let size = 1;
  while (rows[index + size]?.first === rows[index].first && rows[index + size]?.second === rows[index].second) size += 1;
  return size;
}

export function CategoryManager({ initialRequests, initialCategories }: { initialRequests: Request[]; initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [scope, setScope] = useState("MANUSCRIPT");
  const [message, setMessage] = useState(`现有古籍分类 ${initialCategories.filter((item) => item.scope === "MANUSCRIPT").length} 个。`);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newSecond, setNewSecond] = useState("");
  const [newThird, setNewThird] = useState("");
  const labels: Record<string, string> = { MANUSCRIPT: "古籍分类", ARTIFACT: "文物分类", RESEARCH: "学术文章分类" };
  const tableRows = scope === "MANUSCRIPT" ? toRows(manuscriptCategoryTree) : managedRows(categories, scope);

  const roots = useMemo(
    () => categories.filter((item) => item.scope === scope && !item.parentName).sort((left, right) => rootSequence(left.name) - rootSequence(right.name) || left.name.localeCompare(right.name, "zh-CN")),
    [categories, scope],
  );
  const secondLevel = useMemo(
    () => categories.filter((item) => item.scope === scope && item.parentName === first),
    [categories, first, scope],
  );
  const thirdLevel = useMemo(
    () => categories.filter((item) => item.scope === scope && item.parentName === second),
    [categories, second, scope],
  );
  const creatingFirst = first === "__new__";
  const creatingSecond = Boolean(first) && second === "__new__";
  const creatingThird = Boolean(second) && third === "__new__";
  const currentFirstIndex = scope === "MANUSCRIPT" ? manuscriptCategoryTree.findIndex((item) => item.name === first) : roots.findIndex((item) => item.name === first);
  const firstCode = String(rootSequence(first) || (currentFirstIndex >= 0 ? currentFirstIndex + 1 : ""));
  const secondCode = categoryCode(second);
  const nextFirstCode = Math.max(0, ...roots.map((item) => rootSequence(item.name)), scope === "MANUSCRIPT" ? manuscriptCategoryTree.length : 0) + 1;
  const nextSecondCode = nextChildCode(firstCode, secondLevel);
  const nextThirdCode = nextChildCode(secondCode, thirdLevel);

  async function reload() {
    const response = await fetch("/api/admin/category-requests?view=categories");
    const data = await response.json();
    if (response.ok) setCategories(data);
    else setMessage(data.message ?? "操作失败。");
  }

  async function save(body: object, successMessage: string, afterSave?: () => void) {
    const response = await fetch("/api/admin/category-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "创建失败。");
    setMessage(successMessage);
    afterSave?.();
    setNewFirst("");
    setNewSecond("");
    setNewThird("");
    await reload();
  }

  async function update(body: object) {
    const response = await fetch("/api/admin/category-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.message ?? "保存失败。");
    else await reload();
  }

  function createCategory() {
    if (creatingFirst) {
      if (!newFirst.trim()) return setMessage("请填写新的一级分类名称。");
      const name = `${chineseNumber(nextFirstCode)}、${newFirst.trim()}`;
      void save({ scope, name }, `${labels[scope]}一级分类已创建。`, () => { setFirst(name); setSecond(""); });
      return;
    }
    if (!first) return setMessage("请先选择一级分类。");
    if (creatingSecond) {
      if (!newSecond.trim()) return setMessage("请填写新的二级分类名称。");
      void save({ scope, name: `${nextSecondCode} ${newSecond.trim()}`, parentName: first }, `${labels[scope]}二级分类已创建。`);
      return;
    }
    if (!second) return setMessage("请先选择二级分类，或选择“新建二级分类”。");
    if (!creatingThird) return setMessage("请选择“新建三级分类”后再填写新的三级分类名称。");
    if (!newThird.trim()) return setMessage("请填写新的三级分类名称。");
    void save({ scope, name: `${nextThirdCode} ${newThird.trim()}`, parentName: second }, `${labels[scope]}三级分类已创建。`);
  }

  const lookup = (name: string) => categories.find((item) => item.scope === scope && item.name === name);

  return <div className="review-desk">
    <p className="catalog-editor-message">{message}</p>
    <section className="category-management-section">
      <h2>新增分类</h2>
      <p>按层级逐步选择：创建一级时只填写一级名称；选定现有一级后，可创建二级；选定现有二级后，可创建三级。</p>
      <div className="category-create-grid">
        <label>分类体系
          <select value={scope} onChange={(event) => { const value = event.target.value; setScope(value); setFirst(""); setSecond(""); setThird(""); setNewFirst(""); setNewSecond(""); setNewThird(""); setMessage(`现有${labels[value]} ${categories.filter((item) => item.scope === value).length} 个。`); }}>
            <option value="MANUSCRIPT">古籍分类</option>
            <option value="ARTIFACT">文物分类</option>
            <option value="RESEARCH">学术文章分类</option>
          </select>
        </label>
        <label>一级分类
          {creatingFirst ? <div className="new-category-inline">
            <span>{chineseNumber(nextFirstCode)}、</span><input value={newFirst} placeholder="输入新的一级分类" onChange={(event) => setNewFirst(event.target.value)} />
            <button type="button" disabled={!newFirst.trim()} onClick={createCategory}>确认</button>
          </div> : <select value={first} onChange={(event) => { setFirst(event.target.value); setSecond(""); setThird(""); setNewSecond(""); setNewThird(""); }}>
              <option value="">选择一级分类</option>
              {roots.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              <option value="__new__">＋ 新建一级分类</option>
            </select>}
        </label>
        <label>二级分类
          {creatingSecond ? <div className="new-category-inline">
            <span>{nextSecondCode}</span><input value={newSecond} placeholder="输入新的二级分类" onChange={(event) => setNewSecond(event.target.value)} />
            <button type="button" disabled={!newSecond.trim()} onClick={createCategory}>确认</button>
          </div> : <select disabled={!first} value={second} onChange={(event) => { setSecond(event.target.value); setThird(""); setNewThird(""); }}>
              <option value="">选择二级分类</option>
              {secondLevel.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              <option value="__new__">＋ 新建二级分类</option>
            </select>}
        </label>
        <label>三级分类
          {creatingThird ? <div className="new-category-inline">
            <span>{nextThirdCode}</span><input value={newThird} placeholder="输入新的三级分类" onChange={(event) => setNewThird(event.target.value)} />
            <button type="button" disabled={!newThird.trim()} onClick={createCategory}>确认</button>
          </div> : <select disabled={!second || creatingSecond} value={third} onChange={(event) => setThird(event.target.value)}>
              <option value="">选择三级分类</option>
              {thirdLevel.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              <option value="__new__">＋ 新建三级分类</option>
            </select>}
        </label>
      </div>
    </section>
    <section className="category-management-section">
      <h2>{labels[scope]}</h2>
      {!tableRows.length ? <p>{labels[scope]}尚未建立分类，可在上方按一级、二级、三级逐层创建。</p> :
      <div className="category-library-table-wrap"><table className="category-library-table">
        <colgroup><col className="cat-col-1" /><col className="cat-col-2" /><col className="cat-col-3" /><col className="cat-col-4" /><col className="cat-col-5" /><col className="cat-col-6" /><col className="cat-col-7" /></colgroup>
        <thead><tr><th>一级分类</th><th>二级分类</th><th>三级分类</th><th>备注说明</th><th>使用</th><th>状态</th><th>管理</th></tr></thead>
        <tbody>{tableRows.map((row, index) => {
          const category = lookup(row.third || row.second || row.first);
          const showFirst = index === 0 || tableRows[index - 1].first !== row.first;
          const showSecond = showFirst || tableRows[index - 1].second !== row.second;
          return <tr key={`${row.first}-${row.second}-${row.third}-${index}`}>
            {showFirst && <td rowSpan={firstSpan(tableRows, index)}>{row.first}</td>}
            {showSecond && <td rowSpan={secondSpan(tableRows, index)}>{row.second || "—"}</td>}
            <td>{row.third || "—"}</td>
            <td>{category && <input defaultValue={category.description ?? row.note ?? ""} placeholder="点击填写备注" onBlur={(event) => void update({ id: category.id, description: event.target.value })} />}</td>
            <td>{category?.usageCount ?? 0} 次</td>
            <td>{category?.isActive === false ? "已停用" : "启用中"}</td>
            <td>{category && <button className="secondary" onClick={() => void update({ id: category.id, isActive: !category.isActive })}>{category.isActive ? "停用" : "启用"}</button>}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
    <section className="category-management-section">
      <h2>分类申请审核</h2>
      {initialRequests.length ? initialRequests.map((request) => <article className="review-card" key={request.id}><b>{request.proposedName}</b> · {request.status}<p>{request.requestReason}</p></article>) : <p>目前没有待处理的分类申请。</p>}
    </section>
  </div>;
}
