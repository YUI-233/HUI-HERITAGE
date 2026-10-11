"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ReaderTheme = "paper" | "soft" | "night";
const themeLabels: Record<ReaderTheme, string> = { paper: "白纸", soft: "护眼", night: "夜间" };

function readStoredNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

export function ArticleBookmark({ articleId }: { articleId: string }) {
  const key = `hui-heritage:research-bookmark:${articleId}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSaved(window.localStorage.getItem(key) === "1"), 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  return <button type="button" className={saved ? "research-bookmark saved" : "research-bookmark"} aria-pressed={saved} onClick={() => {
    setSaved((current) => {
      const next = !current;
      if (next) window.localStorage.setItem(key, "1"); else window.localStorage.removeItem(key);
      return next;
    });
  }}><span aria-hidden="true">{saved ? "◆" : "◇"}</span>{saved ? "已收藏" : "收藏"}</button>;
}

export function ReaderTools({ children }: { children: ReactNode }) {
  const shell = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(2.05);
  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [progress, setProgress] = useState(0);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFontSize(Math.min(22, Math.max(16, readStoredNumber("hui-heritage:research-font-size", 18))));
      setLineHeight(Math.min(2.35, Math.max(1.75, readStoredNumber("hui-heritage:research-line-height", 2.05))));
      const storedTheme = window.localStorage.getItem("hui-heritage:research-theme");
      if (storedTheme === "soft" || storedTheme === "night") setTheme(storedTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hui-heritage:research-font-size", String(fontSize));
    window.localStorage.setItem("hui-heritage:research-line-height", String(lineHeight));
    window.localStorage.setItem("hui-heritage:research-theme", theme);
  }, [fontSize, lineHeight, theme]);

  useEffect(() => {
    const update = () => {
      const node = shell.current;
      if (!node) return;
      const start = node.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, node.offsetHeight - window.innerHeight * .55);
      setProgress(Math.round(Math.min(100, Math.max(0, ((window.scrollY - start + window.innerHeight * .22) / distance) * 100))));
      const headings = Array.from(node.querySelectorAll<HTMLElement>(".research-reading-content h2[id], .research-reading-content h3[id]"));
      const active = [...headings].reverse().find((heading) => heading.getBoundingClientRect().top <= 150) ?? headings[0];
      node.querySelectorAll<HTMLAnchorElement>(".research-toc a").forEach((link) => {
        if (active && link.hash === `#${active.id}`) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("research-focus-mode", focus);
    return () => document.body.classList.remove("research-focus-mode");
  }, [focus]);

  const changeFont = (step: number) => setFontSize((value) => Math.min(22, Math.max(16, value + step)));
  const changeLineHeight = () => setLineHeight((value) => value >= 2.3 ? 1.8 : Number((value + .15).toFixed(2)));
  const changeTheme = () => setTheme((value) => value === "paper" ? "soft" : value === "soft" ? "night" : "paper");

  return <div ref={shell} className={`research-reader-shell theme-${theme}`} style={{ "--research-font-size": `${fontSize}px`, "--research-line-height": lineHeight } as React.CSSProperties}>
    {children}
    <div className="research-reader-tools" aria-label="阅读设置">
      <button type="button" onClick={() => changeFont(-1)} aria-label="减小字号">A−</button>
      <button type="button" onClick={() => changeFont(1)} aria-label="增大字号">A＋</button>
      <span className="research-tool-divider" aria-hidden="true"/>
      <button type="button" onClick={changeLineHeight} title="调整行距" aria-label={`调整行距，当前 ${lineHeight}`}>行距</button>
      <button type="button" onClick={changeTheme} title="切换纸张主题">{themeLabels[theme]}</button>
      <button type="button" className={focus ? "active" : ""} onClick={() => setFocus((value) => !value)}>{focus ? "退出专注" : "专注模式"}</button>
      <span className="research-tool-divider" aria-hidden="true"/>
      <span className="research-progress-value">{progress}%</span>
      <span className="research-progress-track" aria-hidden="true"><i style={{ width: `${progress}%` }}/></span>
    </div>
  </div>;
}
