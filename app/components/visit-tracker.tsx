"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

let fallbackSession = { id: "", touched: 0 };
function sessionId() {
  const now = Date.now();
  let session = fallbackSession;
  try { session = JSON.parse(sessionStorage.getItem("hui-visit-session") || "null") || session; } catch { /* Storage may be disabled. */ }
  if (!session.id || now - session.touched > 30 * 60 * 1000) session = { id: crypto.randomUUID(), touched: now };
  session.touched = now;
  fallbackSession = session;
  try { sessionStorage.setItem("hui-visit-session", JSON.stringify(session)); } catch { /* Use the in-memory session. */ }
  return session.id;
}

export function VisitTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const volume = pathname?.endsWith("/reader") ? search.get("volume") : null;
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
    const key = `${pathname}:${volume || ""}`;
    if (previous.current === key) return;
    previous.current = key;
    // Defer until the destination page has committed its title.
    const timer = setTimeout(() => {
      void fetch("/api/analytics/visit", {
        method: "POST", credentials: "same-origin", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), sessionId: sessionId(), path: pathname, title: document.querySelector("h1")?.textContent?.trim().slice(0, 200) || document.title, referrer: document.referrer }),
      }).catch(() => undefined);
    }, 150);
    return () => { clearTimeout(timer); previous.current = null; };
  }, [pathname, volume]);
  return null;
}
