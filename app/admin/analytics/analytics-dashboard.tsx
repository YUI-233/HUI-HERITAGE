"use client";

import { useEffect, useState } from "react";
import type { VisitAnalytics } from "../../../lib/visit-analytics";

type Metric = "visitors" | "sessions" | "views" | "reads";
const names = { visitors: "访问用户数", sessions: "访问次数", views: "页面浏览量", reads: "内容阅读量", averageReads: "人均阅读量" };
const day = (d = new Date()) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);
const ago = (days: number) => day(new Date(Date.now() - days * 86400000));
const time = (value: Date | string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const number = (value: number) => value.toLocaleString("zh-CN");
function change(current: number, previous: number) {
  if (!previous) return current ? "暂无对比数据" : "与上一周期持平";
  const percent = (current - previous) / previous * 100;
  return percent === 0 ? "与上一周期持平" : `较上一周期 ${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export function AnalyticsDashboard() {
  const [from, setFrom] = useState(ago(29));
  const [to, setTo] = useState(day());
  const [preset, setPreset] = useState("30");
  const [userType, setUserType] = useState("ALL");
  const [contentType, setContentType] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("reads");
  const [metric, setMetric] = useState<Metric>("views");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: VisitAnalytics; error?: string }>({ key: "" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const params = new URLSearchParams({ from, to, userType, contentType, q: query, page: String(page), sort }).toString();
  const requestKey = `${params}:${reload}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/analytics?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message || "加载失败"); return body as VisitAnalytics; })
      .then(data => setResult({ key: requestKey, data }))
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, error: error.message || "加载失败，请重试。" }); });
    return () => controller.abort();
  }, [params, requestKey]);
  const loading = result.key !== requestKey;
  const data = loading ? undefined : result.data;
  const error = loading ? undefined : result.error;
  function selectPreset(value: string) { setPreset(value); setPage(1); if (value !== "custom") { setFrom(ago(Number(value) - 1)); setTo(day()); } }
  async function exportCsv() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch(`/api/admin/analytics?${params}&export=csv`, { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.message || "导出失败"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `访问数据-${from}-${to}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "导出失败，请重试。"); }
    finally { setExporting(false); }
  }
  return <div className="analytics-dashboard">
    <div className="analytics-filters">
      <label>统计范围<select value={preset} onChange={e => selectPreset(e.target.value)}><option value="1">今天</option><option value="7">近 7 天</option><option value="30">近 30 天</option><option value="custom">自定义日期</option></select></label>
      <label>开始日期<input type="date" value={from} max={to} onChange={e => { setFrom(e.target.value); setPreset("custom"); setPage(1); }}/></label>
      <label>结束日期<input type="date" value={to} min={from} max={day()} onChange={e => { setTo(e.target.value); setPreset("custom"); setPage(1); }}/></label>
      <label>用户类型<select value={userType} onChange={e => { setUserType(e.target.value); setPage(1); }}><option value="ALL">全部用户</option><option value="REGISTERED">注册用户</option><option value="GUEST">游客</option></select></label>
      <label>内容类型<select value={contentType} onChange={e => { setContentType(e.target.value); setPage(1); }}><option value="ALL">全部页面</option><option value="PAGE">普通页面</option><option value="BOOK">古籍</option><option value="ARTICLE">文章</option></select></label>
      <button type="button" className="analytics-secondary" onClick={() => setReload(value => value + 1)}>刷新数据</button>
    </div>
    <form className="analytics-search" onSubmit={e => { e.preventDefault(); setQuery(keyword); setPage(1); }}><input aria-label="按标题或页面路径搜索" placeholder="搜索内容标题或页面路径" value={keyword} onChange={e => setKeyword(e.target.value)}/><button>搜索</button>{query && <button type="button" className="analytics-secondary" onClick={() => { setKeyword(""); setQuery(""); setPage(1); }}>清除搜索</button>}</form>
    <div aria-live="polite">{loading && <p className="analytics-message">正在加载访问数据…</p>}{error && <p className="analytics-error" role="alert">{error} <button onClick={() => setReload(value => value + 1)}>重试</button></p>}</div>
    {data && <>
      <div className="analytics-summary">{(Object.keys(names) as Array<keyof typeof names>).map(key => <article key={key}><span>{names[key]}</span><strong>{number(data.current[key])}</strong><small>{change(data.current[key], data.previous[key])}</small></article>)}</div>
      <div className="analytics-audience"><div><span className="analytics-dot registered"/><b>注册用户</b><span>{number(data.current.registeredVisitors)} 位访客</span><strong>{number(data.current.registeredViews)} 次浏览</strong></div><div><span className="analytics-dot guest"/><b>游客</b><span>{number(data.current.guestVisitors)} 位访客</span><strong>{number(data.current.guestViews)} 次浏览</strong></div></div>
      <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>访问趋势</h2><p>{data.from} — {data.to} · 北京时间</p></div><label>趋势指标<select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{(Object.keys(names).filter(key => key !== "averageReads") as Metric[]).map(key => <option value={key} key={key}>{names[key]}</option>)}</select></label></div><Trend data={data} metric={metric}/></div>
      <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>阅读排行榜</h2><p>热门古籍与文章 · 各展示前 20 名</p></div><label>排行方式<select value={sort} onChange={e => setSort(e.target.value)}><option value="reads">按阅读次数</option><option value="readers">按阅读人数</option></select></label></div><Ranking data={data} type="BOOK"/><Ranking data={data} type="ARTICLE"/></div>
      <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>访问明细</h2><p>共 {number(data.total)} 条记录 · 每次页面打开记一条</p></div><button onClick={exportCsv} disabled={exporting || !data.total}>{exporting ? "正在导出…" : "导出 CSV"}</button></div>{exportError && <p className="analytics-error" role="alert">{exportError}</p>}<div className="analytics-table-wrap"><table><thead><tr><th>时间（北京时间）</th><th>用户类型</th><th>页面 / 内容标题</th><th>内容类型</th><th>来源</th></tr></thead><tbody>{data.details.map(row => <tr key={row.id}><td>{time(row.createdAt)}</td><td><span className={`analytics-badge ${row.userType === "REGISTERED" ? "registered" : "guest"}`}>{row.userType === "REGISTERED" ? "注册用户" : "游客"}</span></td><td><a href={row.path}>{row.title}</a><small className="analytics-path">{row.path}</small></td><td>{row.contentType === "BOOK" ? "古籍" : row.contentType === "ARTICLE" ? "文章" : "普通页面"}</td><td>{row.source || "直接访问"}</td></tr>)}{!data.details.length && <tr><td colSpan={5} className="analytics-empty">该筛选范围内暂无访问记录</td></tr>}</tbody></table></div><div className="analytics-pagination"><button className="analytics-secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page} / {Math.max(1, Math.ceil(data.total / 30))} 页</span><button className="analytics-secondary" disabled={page * 30 >= data.total} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
      <details className="analytics-notes"><summary>统计说明</summary><p>页面打开或刷新计一次浏览；古籍详情、古籍阅读器与文章详情计入阅读量。访问次数按浏览器会话统计，连续 30 分钟无页面访问后视为新会话。注册用户按账号去重，游客按浏览器标识去重，登录前后的记录不合并。系统 Admin 访问与后台页面不计入统计。</p><p>日期按北京时间计算，对比上一等长周期。筛选条件同时应用于概览、趋势、排行和明细。数据刷新后更新；统计从功能启用后开始累计，不补算历史记录。{data.firstRecordAt ? `首条访问记录：${time(data.firstRecordAt)}。` : "目前尚无访问记录。"}</p></details>
    </>}
  </div>;
}

function Ranking({ data, type }: { data: VisitAnalytics; type: "BOOK" | "ARTICLE" }) {
  const rows = data.ranking.filter(row => row.contentType === type).slice(0, 20);
  const total = data.contentTotals.find(row => row.contentType === type);
  return <div className="analytics-ranking"><h3>{type === "BOOK" ? "古籍阅读排行" : "文章阅读排行"}<span>总阅读 {number(total?.reads || 0)} 次 · {number(total?.readers || 0)} 位读者</span></h3><div className="analytics-table-wrap"><table><thead><tr><th>排名</th><th>标题</th><th>阅读次数</th><th>阅读人数</th><th>注册用户阅读</th><th>游客阅读</th><th>最近阅读</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.contentId}><td><span className={`analytics-rank ${index < 3 ? "top" : ""}`}>{index + 1}</span></td><td><a href={type === "BOOK" ? `/admin/catalog?recordId=${encodeURIComponent(row.contentId)}` : `/admin/research?articleId=${encodeURIComponent(row.contentId)}`}>{row.title}</a></td><td><b>{number(row.reads)}</b></td><td>{number(row.readers)}</td><td>{number(row.registered)}</td><td>{number(row.guests)}</td><td>{time(row.lastRead)}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="analytics-empty">暂无{type === "BOOK" ? "古籍" : "文章"}阅读数据</td></tr>}</tbody></table></div></div>;
}

function Trend({ data, metric }: { data: VisitAnalytics; metric: Metric }) {
  const dates: string[] = [];
  for (let value = new Date(`${data.from}T00:00:00Z`).getTime(), end = new Date(`${data.to}T00:00:00Z`).getTime(); value <= end; value += 86400000) dates.push(new Date(value).toISOString().slice(0, 10));
  const lookup = new Map(data.daily.map(row => [`${row.date}:${row.userType}`, row[metric]]));
  const maximum = Math.max(1, ...data.daily.map(row => row[metric]));
  const x = (index: number) => dates.length === 1 ? 450 : 55 + index / (dates.length - 1) * 790;
  const y = (value: number) => 235 - value / maximum * 185;
  const users = [{ key: "REGISTERED", name: "注册用户", color: "#9f332d" }, { key: "GUEST", name: "游客", color: "#65786b" }];
  return <><div className="analytics-chart-legend"><span><i className="analytics-dot registered"/>注册用户</span><span><i className="analytics-dot guest"/>游客</span></div>{!data.total ? <div className="analytics-empty analytics-chart-empty">该日期范围内暂无数据</div> : <svg className="analytics-chart" viewBox="0 0 900 280" role="img" aria-label={`${names[metric]}趋势，注册用户和游客按日对比`}><title>{names[metric]}趋势</title>{[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line x1="55" x2="845" y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke="#e4ddd2"/><text x="45" y={y(maximum * ratio) + 4} textAnchor="end">{Number((maximum * ratio).toFixed(1))}</text></g>)}{users.map(user => <g key={user.key}><polyline fill="none" stroke={user.color} strokeWidth="2.5" points={dates.map((date, index) => `${x(index)},${y(lookup.get(`${date}:${user.key}`) || 0)}`).join(" ")}/>{dates.map((date, index) => <circle key={date} cx={x(index)} cy={y(lookup.get(`${date}:${user.key}`) || 0)} r={dates.length > 60 ? 2 : 3.5} fill={user.color}><title>{date} · {user.name}：{lookup.get(`${date}:${user.key}`) || 0}</title></circle>)}</g>)}{dates.filter((_, index) => index === 0 || index === dates.length - 1 || index % Math.max(1, Math.ceil(dates.length / 6)) === 0).map(date => <text key={date} x={x(dates.indexOf(date))} y="264" textAnchor="middle">{date.slice(5)}</text>)}</svg>}</>;
}
