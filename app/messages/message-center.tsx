"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Participant = { displayName: string; collectionSlug: string | null; collectionName: string | null };
type Message = { id: string; body: string; sentAt: string; sender: "SELF" | "OTHER" };
type ConversationSummary = { id: string; participant: Participant; lastMessage: Message; unreadCount: number; updatedAt: string };
type ConversationDetail = ConversationSummary & { messages: Message[] };
type Recipient = { collectionSlug: string; collectionName: string; displayName: string };

async function bodyOf(response: Response) { return response.json().catch(() => ({})); }
function timeLabel(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export function MessageCenter({ initialRecipient }: { initialRecipient: Recipient | null }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [details, setDetails] = useState<Record<string, ConversationDetail>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeRecipient, setComposeRecipient] = useState<Recipient | null>(initialRecipient);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadInbox = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/messages/conversations?page=1&limit=50", { cache: "no-store" });
      const body = await bodyOf(response);
      if (response.status === 401) return window.location.assign("/login");
      if (!response.ok) throw new Error(body.message ?? "暂时无法读取站内信。");
      const items = Array.isArray(body.items) ? body.items as ConversationSummary[] : [];
      setConversations(items);
      if (!initialRecipient && items[0]) setSelectedId(items[0].id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "暂时无法读取站内信。"); }
    finally { setLoading(false); }
  }, [initialRecipient]);

  useEffect(() => { const timer = window.setTimeout(() => void loadInbox(), 0); return () => window.clearTimeout(timer); }, [loadInbox]);

  const openConversation = async (id: string) => {
    setComposeRecipient(null); setSelectedId(id); setError("");
    let detail = details[id];
    if (!detail) {
      try {
        const response = await fetch(`/api/messages/conversations/${id}`, { cache: "no-store" });
        const body = await bodyOf(response);
        if (response.status === 401) return window.location.assign("/login");
        if (!response.ok) throw new Error(body.message ?? "暂时无法读取会话。");
        detail = body as ConversationDetail;
        setDetails((current) => ({ ...current, [id]: detail }));
      } catch (caught) { setError(caught instanceof Error ? caught.message : "暂时无法读取会话。"); return; }
    }
    if (detail.unreadCount > 0) {
      const response = await fetch(`/api/messages/conversations/${id}/read`, { method: "PATCH" });
      if (response.ok) {
        setConversations((current) => current.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item));
        setDetails((current) => ({ ...current, [id]: { ...detail, unreadCount: 0 } }));
      }
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return setError("请输入消息内容。");
    if (text.length > 1000) return setError("每条消息不能超过 1000 个字符。");
    setSending(true); setError("");
    const isNew = Boolean(composeRecipient);
    const url = isNew ? "/api/messages/conversations" : `/api/messages/conversations/${selectedId}/messages`;
    const payload = isNew ? { recipientCollectionSlug: composeRecipient?.collectionSlug, body: text } : { body: text };
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await bodyOf(response);
      if (response.status === 401) return window.location.assign("/login");
      if (!response.ok) throw new Error(body.message ?? "消息发送失败，请稍后重试。");
      const detail = body as ConversationDetail;
      setDetails((current) => ({ ...current, [detail.id]: detail }));
      setConversations((current) => [detail, ...current.filter((item) => item.id !== detail.id)]);
      setSelectedId(detail.id);
      setComposeRecipient(null); setDraft("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "消息发送失败，请稍后重试。"); }
    finally { setSending(false); }
  };

  const selected = selectedId ? details[selectedId] : null;
  const unreadTotal = useMemo(() => conversations.reduce((total, item) => total + item.unreadCount, 0), [conversations]);

  return <section className="message-center">
    <aside className="conversation-sidebar"><header><div><h2>会话</h2><span>{unreadTotal ? `${unreadTotal} 条未读` : "全部已读"}</span></div></header>{loading ? <p className="conversation-state">正在读取会话……</p> : conversations.length ? <div className="conversation-list">{conversations.map((item) => <button type="button" className={item.id === selectedId && !composeRecipient ? "active" : ""} onClick={() => void openConversation(item.id)} key={item.id}><span className="conversation-avatar">{item.participant.displayName.slice(0, 1)}</span><span><b>{item.participant.displayName}</b><small>{item.lastMessage.body}</small></span><time>{timeLabel(item.updatedAt)}</time>{item.unreadCount > 0 && <i>{item.unreadCount}</i>}</button>)}</div> : <p className="conversation-state">还没有站内信。你可以从公开收藏馆联系收藏者。</p>}</aside>
    <section className="conversation-main">
      {composeRecipient ? <><header className="conversation-heading"><div><p>NEW MESSAGE</p><h2>写给 {composeRecipient.displayName}</h2><span>{composeRecipient.collectionName}</span></div><Link href={`/personal-collections/${composeRecipient.collectionSlug}`}>返回收藏馆</Link></header><div className="new-message-note">请围绕公开馆藏信息进行交流。每条消息最多 1000 个字符。</div><MessageComposer draft={draft} sending={sending} error={error} onDraft={setDraft} onSubmit={send}/></> : selected ? <><header className="conversation-heading"><div><p>CONVERSATION</p><h2>{selected.participant.displayName}</h2><span>{selected.participant.collectionName ?? "藏友交流"}</span></div>{selected.participant.collectionSlug && <Link href={`/personal-collections/${selected.participant.collectionSlug}`}>查看收藏馆</Link>}</header><div className="message-thread">{selected.messages.map((message) => <article className={message.sender === "SELF" ? "self" : "other"} key={message.id}><div>{message.body}</div><time>{timeLabel(message.sentAt)}</time></article>)}</div><MessageComposer draft={draft} sending={sending} error={error} onDraft={setDraft} onSubmit={send}/></> : <div className="conversation-placeholder"><img src="/brand-mark.svg" alt=""/><h2>选择一段会话</h2><p>从左侧打开已有会话，或前往公开收藏馆联系收藏者。</p><Link href="/personal-collections">浏览公开收藏馆</Link>{error && <span>{error}</span>}</div>}
    </section>
  </section>;
}

function MessageComposer({ draft, sending, error, onDraft, onSubmit }: { draft: string; sending: boolean; error: string; onDraft: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return <form className="message-composer" onSubmit={onSubmit}><label htmlFor="message-body">消息内容</label><textarea id="message-body" value={draft} maxLength={1050} placeholder="请输入想与收藏者交流的内容……" onChange={(event) => onDraft(event.target.value)}/><div><span className={draft.length > 1000 ? "error" : ""}>{error || `${draft.length} / 1000`}</span><button disabled={sending || !draft.trim()}>{sending ? "正在发送……" : "发送消息"}</button></div></form>;
}
