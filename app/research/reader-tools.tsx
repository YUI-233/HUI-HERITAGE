"use client";

import { useState, type ReactNode } from "react";

export function ReaderTools({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(2.05);

  return <div className="research-reader-shell" style={{ "--research-font-size": `${fontSize}px`, "--research-line-height": lineHeight } as React.CSSProperties}>
    <div className="research-reader-tools" aria-label="阅读设置">
      <span>阅读设置</span>
      <div><button type="button" onClick={() => setFontSize((value) => Math.max(16, value - 1))} aria-label="减小字号">A−</button><button type="button" onClick={() => setFontSize((value) => Math.min(22, value + 1))} aria-label="增大字号">A＋</button></div>
      <div><button type="button" onClick={() => setLineHeight((value) => Math.max(1.75, Number((value - .15).toFixed(2))))}>紧凑</button><button type="button" onClick={() => setLineHeight((value) => Math.min(2.35, Number((value + .15).toFixed(2))))}>舒展</button></div>
    </div>
    {children}
  </div>;
}
