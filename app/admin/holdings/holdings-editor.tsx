"use client";

import { useEffect, useState } from "react";
import { HoldingBibliographyFields, type HoldingBibliographyValues } from "../../components/holding-bibliography-fields";

type Form = HoldingBibliographyValues & {
  id?: string;
  recordType: "manuscript" | "artifact";
  recordId: string;
  status: string;
};

const empty = (): Form => ({
  recordType: "manuscript",
  recordId: "",
  title: "",
  author: "",
  dynasty: "",
  eraDetail: "",
  publicationDate: "",
  imprintPublisher: "",
  versionType: "",
  binding: "",
  volumeCount: "1",
  categories: "",
  institution: "",
  region: "",
  origin: "DOMESTIC",
  callNumber: "",
  catalogUrl: "",
  holdingDescription: "",
  status: "DRAFT",
});

type Holding = Form & {
  id: string;
  description?: string | null;
  book?: { id: string; title: string; author?: string | null; dynasty?: string | null; eraDetail?: string | null; publicationDate?: string | null; imprintPublisher?: string | null; versionType?: string | null; binding?: string | null; volumeCount?: number | null; categories?: string[] } | null;
  artifact?: { id: string; title: string } | null;
};
type PendingHoldingSubmission = {
  id: string;
  holdingId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  status: "DRAFT" | "PENDING";
  title: string;
  institution: string;
  origin: Form["origin"];
  draft?: Form | null;
};

const originLabel = (origin: Form["origin"]) => origin === "DOMESTIC" ? "国内馆藏" : "海外馆藏";
const titleOf = (holding: Holding) => holding.book?.title ?? holding.artifact?.title ?? "未关联资料";
type EntryMode = "create" | "edit";

export function HoldingsEditor() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingHoldingSubmission[]>([]);
  const [mode, setMode] = useState<EntryMode>("create");
  const [form, setForm] = useState<Form>(empty());
  const [message, setMessage] = useState("已登录且具有“录入馆藏信息”权限的用户可直接维护馆藏记录。");
  const authHeaders: Record<string, string> = {};

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateBibliography = <K extends keyof HoldingBibliographyValues>(key: K, value: HoldingBibliographyValues[K]) => setForm((current) => ({ ...current, [key]: value }));
  const load = async () => {
    const response = await fetch("/api/admin/holdings", { headers: authHeaders });
    const data = await response.json() as { holdings?: Holding[]; pendingSubmissions?: PendingHoldingSubmission[]; message?: string };
    if (!response.ok) return setMessage(data.message ?? "读取失败。");
    const allHoldings = data.holdings ?? [];
    const officialHoldings = allHoldings.filter((holding) => holding.origin === "DOMESTIC" || holding.origin === "OVERSEAS");
    const approvedHoldings = officialHoldings.filter((holding) => holding.status === "APPROVED");
    setHoldings(officialHoldings);
    setPendingSubmissions(data.pendingSubmissions ?? []);
    setMessage(`当前共有 ${allHoldings.length} 条馆藏信息，其中 ${approvedHoldings.length} 条为已通过审核、可编辑的国内／海外馆藏。`);
  };

  const selectHolding = (holding: Holding) => {
    setForm({ id: holding.id, recordType: holding.book ? "manuscript" : "artifact", recordId: holding.book?.id ?? holding.artifact?.id ?? "", title: titleOf(holding), author: holding.book?.author ?? "", dynasty: holding.book?.dynasty ?? "", eraDetail: holding.book?.eraDetail ?? "", publicationDate: holding.book?.publicationDate ?? "", imprintPublisher: holding.book?.imprintPublisher ?? "", versionType: holding.book?.versionType ?? "", binding: holding.book?.binding ?? "", volumeCount: String(holding.book?.volumeCount ?? 1), categories: holding.book?.categories?.join("、") ?? "", institution: holding.institution, region: holding.region, origin: holding.origin, callNumber: holding.callNumber ?? "", catalogUrl: holding.catalogUrl ?? "", holdingDescription: holding.description ?? "", status: holding.status });
    setMessage(`正在编辑《${titleOf(holding)}》· ${holding.institution}。修改后请保存。`);
  };

  const changeMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    setForm(empty());
    setMessage(nextMode === "edit" ? "请选择需要编辑的馆藏记录。" : "正在新建馆藏记录。");
  };

  const requestDeletion = async () => {
    if (!form.id) return;
    const holding = holdings.find((item) => item.id === form.id);
    const reason = window.prompt(`请填写删除《${holding ? titleOf(holding) : "该馆藏"}》的理由：`);
    if (!reason?.trim()) return setMessage("删除申请需要填写理由，供审核人员核对。");
    if (!window.confirm("确认提交删除申请吗？审核通过后，这条馆藏将从公开检索中下架。")) return;
    const response = await fetch("/api/holding-deletions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ holdingId: form.id, reason }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.message ?? "提交删除申请失败。");
    setMessage("删除申请已提交，等待另一位馆藏审核人员处理。记录在审核通过前仍会保留。");
  };

  useEffect(() => { void load(); }, []);

  const save = async (action: "draft" | "submit") => {
    if (mode === "edit" && !form.id) return setMessage("请先选择需要编辑的馆藏记录。");
    const isSubmission = action === "submit";
    const isOfficialRevision = isSubmission && form.id && form.status === "APPROVED";
    const status = action === "draft" ? "DRAFT" : "PENDING";
    const response = await fetch("/api/admin/holdings", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "保存失败。");
    const id = data.holding?.id ?? data.id;
    if (isSubmission) {
      setMode("create");
      setForm(empty());
    } else {
      setForm((current) => ({ ...current, id: id ?? current.id, recordId: data.holding?.bookId ?? data.bookId ?? current.recordId, status }));
    }
    await load();
    setMessage(isOfficialRevision ? "馆藏修改已提交审核。审核通过后才会更新正式馆藏记录。" : action === "draft" ? "已保存为草稿，可在待处理区继续编辑。" : "馆藏信息已提交审核，审核通过后将公开。");
  };

  const pendingRecords = holdings.filter((holding) => ["DRAFT", "NEEDS_REVISION", "REJECTED"].includes(holding.status));
  const approvedHoldings = holdings.filter((holding) => holding.status === "APPROVED");
  const pendingSubmissionLabel = (submission: PendingHoldingSubmission) => submission.action === "CREATE" ? "新建馆藏" : submission.action === "DELETE" ? "删除申请" : "馆藏修改";
  const resumeSubmission = (submission: PendingHoldingSubmission, draft: Form) => {
    setMode("edit");
    setForm(draft);
    setMessage(`正在继续编辑《${submission.title}》的馆藏修改草稿。`);
  };
  const withdrawSubmission = async (submission: PendingHoldingSubmission) => {
    const action = submission.action === "CREATE" ? "撤回为草稿" : submission.action === "DELETE" ? "撤回删除申请" : "撤回修改";
    if (!window.confirm(`确认${action}《${submission.title}》吗？`)) return;
    const response = await fetch(`/api/admin/holding-submissions/${submission.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { message?: string; draft?: Form | null };
    if (!response.ok) return setMessage(data.message ?? "撤回失败。 ");
    await load();
    if (submission.action === "UPDATE" && data.draft) return resumeSubmission(submission, data.draft);
    setMessage(`《${submission.title}》已${action}。`);
  };
  const deleteSubmissionDraft = async (submission: PendingHoldingSubmission) => {
    if (!window.confirm(`确认删除《${submission.title}》的馆藏修改草稿吗？正式馆藏不会受到影响。`)) return;
    const response = await fetch(`/api/admin/holding-submissions/${submission.id}`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.message ?? "删除草稿失败。");
    await load();
    setMessage(`《${submission.title}》的馆藏修改草稿已删除。`);
  };
  const deleteDraft = async (holding: Holding) => {
    if (!window.confirm(`确认删除《${titleOf(holding)}》吗？此操作不能恢复。`)) return;
    const response = await fetch(`/api/admin/holdings/${holding.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.message ?? "删除失败。");
    if (form.id === holding.id) changeMode("create");
    setMessage("待处理馆藏已删除。");
    await load();
  };

  return <>
    <div className="catalog-editor holdings-editor">
      <div className="catalog-entry-mode">
        <label>选择操作<select value={mode} onChange={(event) => changeMode(event.target.value as EntryMode)}><option value="create">新建馆藏记录</option><option value="edit">编辑已有馆藏</option></select></label>
        <label>选择需要编辑的馆藏<select value={mode === "edit" ? form.id ?? "" : ""} disabled={mode !== "edit"} onChange={(event) => { const holding = approvedHoldings.find((item) => item.id === event.target.value); if (holding) selectHolding(holding); }}><option value="">{mode === "edit" ? "请选择馆藏记录" : "请先选择“编辑已有馆藏”"}</option>{approvedHoldings.map((holding) => <option value={holding.id} key={holding.id}>{titleOf(holding)} · {holding.institution} · {originLabel(holding.origin)}</option>)}</select><small>仅显示已通过审核的国内与海外馆藏；待处理记录请在下方继续编辑。</small></label>
      </div>
      <div className="catalog-admin-layout">
        <form className="catalog-entry-form" onSubmit={(event) => { event.preventDefault(); void save("draft"); }}>
          <div className="catalog-entry-heading"><span>01</span><div><b>馆藏信息</b><small>{mode === "edit" ? "修改书籍基本信息与馆藏位置、索书号、目录链接和说明。" : "填写书籍基本信息与馆藏信息后，即可新建馆藏记录。"}</small></div></div>
          <>
          <HoldingBibliographyFields values={form} onChange={updateBibliography} compact />
          <div className={`catalog-form-actions${form.id && form.status === "APPROVED" ? " holdings-approved-actions" : ""}`}>{form.id && form.status === "APPROVED" ? <><button type="button" onClick={() => void save("submit")}>提交馆藏修改</button><button type="button" className="catalog-delete-request" onClick={() => void requestDeletion()}>申请删除馆藏</button></> : <><button type="button" className="secondary" onClick={() => void save("draft")}>保存为草稿</button><button type="button" onClick={() => void save("submit")}>提交馆藏信息</button></>}</div>
          </>
        </form>
      </div>
      <p className="catalog-editor-message">{message}</p>
    </div>
    <div className="catalog-draft-box holdings-manual-pending" aria-labelledby="holdings-manual-pending-title">
        <div className="catalog-draft-heading"><h2 id="holdings-manual-pending-title">待处理</h2></div>
        <p className="catalog-draft-note">草稿、待审核、需补充和退回的单条馆藏会保留在这里；待审核的资料可撤回，继续编辑后可再次提交审核。</p>
        {pendingRecords.length || pendingSubmissions.length ? <div className="catalog-draft-list">
          {pendingRecords.map((holding) => <article key={holding.id}>
            <div><span className={`catalog-draft-status ${holding.status.toLowerCase()}`}>{holding.status === "DRAFT" ? "草稿" : holding.status === "NEEDS_REVISION" ? "需补充" : "已退回"}</span><b>《{titleOf(holding)}》</b><small>{holding.institution} · {originLabel(holding.origin)}</small></div>
            <div className="catalog-draft-actions"><button type="button" onClick={() => { setMode("edit"); selectHolding(holding); }}>继续编辑</button><button type="button" className="catalog-draft-delete" onClick={() => void deleteDraft(holding)}>删除</button></div>
          </article>)}
          {pendingSubmissions.map((submission) => <article key={`submission-${submission.id}`}>
            <div><span className={`catalog-draft-status ${submission.status.toLowerCase()}`}>{submission.status === "DRAFT" ? "草稿" : "待审核"}</span><b>《{submission.title}》· {pendingSubmissionLabel(submission)}</b><small>{submission.institution} · {originLabel(submission.origin)}</small></div>
            <div className="catalog-draft-actions">{submission.status === "DRAFT" && submission.draft ? <><button type="button" onClick={() => resumeSubmission(submission, submission.draft!)}>继续编辑</button><button type="button" className="catalog-draft-delete" onClick={() => void deleteSubmissionDraft(submission)}>删除</button></> : <button type="button" className="secondary" onClick={() => void withdrawSubmission(submission)}>{submission.action === "CREATE" ? "撤回为草稿" : submission.action === "DELETE" ? "撤回删除申请" : "撤回修改"}</button>}</div>
          </article>)}
        </div> : <div className="catalog-draft-empty"><span aria-hidden="true">—</span><b>当前没有待处理的单条馆藏</b></div>}
        <div id="holdings-pending-batch-slot" />
    </div>
  </>;
}
