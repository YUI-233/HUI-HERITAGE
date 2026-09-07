"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BorrowingCardVisual } from "../components/borrowing-card";

type PanelProps = {
  exempt: boolean;
  card: { cardNumber: string; issuedAt: string } | null;
  holderName: string;
  limited: boolean;
  limit: number | null;
  borrowedToday: number;
  remaining: number | null;
  records: Array<{ id: string; bookId: string; title: string }>;
};

export function BorrowingCardPanel(props: PanelProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const dailyLimit = props.limit ?? 5;
  const available = props.remaining ?? Math.max(0, dailyLimit - props.borrowedToday);
  const summary = props.exempt || !props.limited ? "不设每日上限" : `今日借阅额度：${available}/${dailyLimit}`;
  return <div className="account-borrowing-field"><dt>借阅证</dt><dd>{props.exempt ? <span>无需办理</span> : props.card ? <button type="button" onClick={() => setOpen(true)}>已办理 · 点击查看</button> : <span>尚未办理</span>}<small>{summary}</small></dd>{open && props.card && createPortal(<div className="borrowing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="borrowing-modal borrowing-modal--issued account-borrowing-modal" role="dialog" aria-modal="true" aria-labelledby="account-borrowing-title"><button className="borrowing-modal-close" type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button><p>借阅证</p><h2 id="account-borrowing-title">借阅证</h2><BorrowingCardVisual cardNumber={props.card.cardNumber} holderName={props.holderName} issuedAt={props.card.issuedAt} limited={props.limited} limit={props.limit}/><div className="account-borrowing-modal-summary">{summary}</div>{props.records.length > 0 && <div className="account-borrowing-history"><h3>今日借阅</h3><div className="account-borrowing-books">{props.records.map((record) => <a href={`/catalog/${record.bookId}`} key={record.id}>{record.title}</a>)}</div></div>}</section></div>, document.body)}</div>;
}
