"use client";

import { useState } from "react";
import { BorrowingCardVisual } from "../../components/borrowing-card";

type CardResult = {
  ok: true;
  card: { cardNumber: string; issuedAt: string };
  holderName: string;
  limited: boolean;
  limit: number | null;
};
type Volume = { id: string; href: string; label: string };

export function BorrowingReadButton({ bookId, title, readerHref, volumes = [] }: { bookId: string; title: string; readerHref: string; volumes?: Volume[] }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [volumePickerOpen, setVolumePickerOpen] = useState(false);
  const [selectedHref, setSelectedHref] = useState(readerHref);
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<CardResult | null>(null);

  const checkout = async (nextHref = selectedHref) => {
    if (busy) return;
    setBusy(true); setMessage(""); setSelectedHref(nextHref);
    try {
      const response = await fetch("/api/borrowing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId }) });
      const result = await response.json().catch(() => null) as { ok?: boolean; code?: string; message?: string } | null;
      if (response.ok && result?.ok) return window.location.assign(nextHref);
      if (response.status === 401 || result?.code === "AUTH_REQUIRED") return window.location.assign("/login");
      setMessage(result?.message || "暂时无法借阅这本古籍。");
      setOpen(true);
    } catch { setMessage("暂时无法借阅这本古籍，请稍后重试。"); setOpen(true); }
    finally { setBusy(false); }
  };

  const beginReading = () => {
    if (volumes.length > 1) return setVolumePickerOpen(true);
    void checkout(readerHref);
  };

  const issueCard = async () => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/borrowing/card", { method: "POST" });
      const result = await response.json().catch(() => null) as CardResult & { code?: string; message?: string };
      if (!response.ok || !result?.ok) return setMessage(result?.message || "借阅证办理失败。");
      setCard(result);
    } catch { setMessage("借阅证办理失败，请稍后重试。"); }
    finally { setBusy(false); }
  };

  const cardNote = "您已是注册用户，无需填写额外资料，即可一键办理借阅证。";

  return <>
    <button className="detail-action borrowing-read-action" type="button" onClick={beginReading} disabled={busy}>{busy ? "请稍候…" : "阅读"}</button>
    {volumePickerOpen && <div className="borrowing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setVolumePickerOpen(false); }}><section className="borrowing-modal borrowing-volume-picker" role="dialog" aria-modal="true" aria-labelledby="volume-picker-title"><button className="borrowing-modal-close" type="button" aria-label="关闭" onClick={() => setVolumePickerOpen(false)}>×</button><p>SELECT VOLUME</p><h2 id="volume-picker-title">选择阅读册次</h2><span>《{title}》共 {volumes.length} 册，请选择要打开的册次。</span><div className="borrowing-volume-list">{volumes.map((volume) => <button type="button" key={volume.id} onClick={() => { setVolumePickerOpen(false); void checkout(`/catalog/${bookId}/reader?volume=${encodeURIComponent(volume.id)}`); }}>{volume.label}<small>打开 PDF 阅读器 →</small></button>)}</div></section></div>}
    {open && <div className="borrowing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section className={`borrowing-modal${card ? " borrowing-modal--issued" : ""}`} role="dialog" aria-modal="true" aria-labelledby="borrowing-dialog-title"><button className="borrowing-modal-close" type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button><p>LIBRARY CARD</p><h2 id="borrowing-dialog-title">{card ? "借阅证办理成功" : message.includes("额度") ? "今日借阅额度" : "办理借阅证"}</h2>{card ? <><BorrowingCardVisual cardNumber={card.card.cardNumber} holderName={card.holderName} issuedAt={card.card.issuedAt} limited={card.limited} limit={card.limit}/><p className="borrowing-modal-note">借阅证已经生效，现在可以借阅《{title}》。</p><button className="borrowing-primary" type="button" onClick={() => void checkout()} disabled={busy}>{busy ? "正在借阅…" : "借阅并阅读"}</button></> : <><p className="borrowing-modal-note">{message === "请先一键办理借阅证。" ? cardNote : message}</p>{message === "请先一键办理借阅证。" && <button className="borrowing-primary" type="button" onClick={() => void issueCard()} disabled={busy}>{busy ? "正在办理…" : "一键办理借阅证"}</button>}</>} </section></div>}
  </>;
}
