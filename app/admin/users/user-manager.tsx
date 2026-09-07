"use client";

import { FormEvent, useEffect, useState } from "react";

type Group = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  dailyBorrowLimitEnabled: boolean;
};

const permissions = [
  ["CATALOG_WRITE", "录入古籍／文物"],
  ["CATALOG_REVIEW", "审核古籍／文物"],
  ["HOLDING_WRITE", "录入馆藏信息"],
  ["HOLDING_REVIEW", "审核馆藏信息"],
  ["RESEARCH_WRITE", "研究资料编辑"],
  ["RESEARCH_REVIEW", "研究资料审核"],
  ["CATEGORY_MANAGE", "管理分类与审核申请"],
  ["PERSONAL_COLLECTION", "开通及管理个人收藏馆"],
] as const;

const empty = { id: "", name: "", description: "", permissions: [] as string[], dailyBorrowLimitEnabled: true };

export function UserManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [message, setMessage] = useState("系统 Admin 由系统自动创建；可在此维护用户组权限并按邮箱授权。");
  const [groupForm, setGroupForm] = useState(empty);
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState("");

  const loadGroups = async () => {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "读取用户组失败。");
    setGroups(data.groups ?? []);
  };

  useEffect(() => { void loadGroups(); }, []);

  const selectGroup = (id: string) => {
    const group = groups.find((item) => item.id === id);
    setGroupForm(group ? { id: group.id, name: group.name, description: group.description ?? "", permissions: group.permissions, dailyBorrowLimitEnabled: group.dailyBorrowLimitEnabled } : empty);
  };

  const toggle = (code: string, checked: boolean) => setGroupForm((current) => ({ ...current, permissions: checked ? [...new Set([...current.permissions, code])] : current.permissions.filter((item) => item !== code) }));

  const saveGroup = async (event: FormEvent) => {
    event.preventDefault();
    const action = groupForm.id ? "updateGroup" : "createGroup";
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...groupForm }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "用户组保存失败。");
    setMessage(`用户组“${data.name}”权限已保存。`);
    setGroupForm(empty);
    await loadGroups();
  };

  const assignGroup = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assignGroupByEmail", email, groupId: groupId || null }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "账号授权保存失败。");
    setMessage(`${data.displayName || data.email} 已分配至“${data.groupName ?? "未分配用户组"}”。`);
    setEmail("");
    setGroupId("");
  };

  return <div className="catalog-editor">
    <div className="catalog-admin-layout">
      <form onSubmit={(event) => void saveGroup(event)}>
        <p>USER GROUP</p>
        <h2>{groupForm.id ? "编辑用户组" : "新建用户组"}</h2>
        <label>选择已有用户组<select value={groupForm.id} onChange={(event) => selectGroup(event.target.value)}><option value="">新建用户组</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}{group.isSystem ? "（系统组）" : ""}</option>)}</select></label>
        <label>用户组名称<input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} required placeholder="如：馆藏志愿者"/></label>
        <label>说明<input value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} placeholder="该组的职责说明"/></label>
        <fieldset><legend>权限勾选</legend>{permissions.map(([code, label]) => <label key={code}><input type="checkbox" checked={groupForm.permissions.includes(code)} onChange={(event) => toggle(code, event.target.checked)}/>{label}</label>)}<label><input type="checkbox" checked={groupForm.dailyBorrowLimitEnabled} onChange={(event) => setGroupForm((current) => ({ ...current, dailyBorrowLimitEnabled: event.target.checked }))}/>每日 5 本借阅上限</label></fieldset>
        <button>{groupForm.id ? "保存用户组权限" : "创建用户组"}</button>
        {groupForm.id && <button type="button" className="secondary" onClick={() => setGroupForm(empty)}>取消编辑</button>}
        <hr/><h2>已有用户组</h2>
        {groups.length ? groups.map((group) => <button type="button" className="admin-record" onClick={() => selectGroup(group.id)} key={group.id}><b>{group.name}</b><small>{group.description || "未填写说明"}</small><small>{group.dailyBorrowLimitEnabled ? "每日借阅上限：5 本" : "每日借阅上限：不限制"}</small><small>{group.permissions.length ? group.permissions.map((code) => permissions.find(([item]) => item === code)?.[1] ?? code).join(" · ") : "未授权权限"}</small></button>) : <p>尚未创建用户组。</p>}
      </form>
      <form onSubmit={(event) => void assignGroup(event)}>
        <p>ACCOUNT AUTHORIZATION</p><h2>按注册邮箱授权</h2><p>用户先在前台自行注册；输入其注册邮箱并选择用户组，即可完成授权。拥有审核权限的用户可审核其他用户提交的资料。</p>
        <label>用户注册邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required/></label>
        <label>选择用户组<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">未分配用户组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <button>保存用户组授权</button><a className="button-link secondary" href="/register">前往注册页</a>
      </form>
    </div>
    <p className="catalog-editor-message">{message}</p>
  </div>;
}
