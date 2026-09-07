"use client";

import { useEffect, useRef, useState } from "react";
import "./notification-bell.css";

type Notice = { id: string; title: string; message: string; href: string | null; isRead: boolean; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const load = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setNotices(body.notifications ?? []); setUnread(body.unreadCount ?? 0);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeFromEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => { document.removeEventListener("pointerdown", closeFromOutside); document.removeEventListener("keydown", closeFromEscape); };
  }, [open]);
  const markAllRead = async () => {
    if (!unread) return;
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "READ_ALL" }) });
    setUnread(0); setNotices((current) => current.map((notice) => ({ ...notice, isRead: true })));
  };
  const toggle = () => { const next = !open; setOpen(next); if (next) void load(); };
  return <div className="notification-bell" ref={containerRef}><button type="button" aria-label="查看系统通知" aria-expanded={open} onClick={toggle}>🔔{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</button>{open && <aside role="status"><header><strong>系统通知</strong><span><button type="button" disabled={!unread} onClick={() => void markAllRead()}>全部已读</button><button type="button" onClick={() => setOpen(false)}>关闭</button></span></header>{notices.length ? <ul>{notices.map((notice) => <li key={notice.id} className={notice.isRead ? "" : "unread"}>{notice.href ? <a href={notice.href}>{notice.title}</a> : <b>{notice.title}</b>}<p>{notice.message}</p><time>{new Date(notice.createdAt).toLocaleString("zh-CN", { hour12: false })}</time></li>)}</ul> : <p className="empty">暂无系统通知。</p>}</aside>}</div>;
}
