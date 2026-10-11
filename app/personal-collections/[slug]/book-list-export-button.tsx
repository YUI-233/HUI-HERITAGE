"use client";

import Link from "next/link";
import { useState } from "react";

type BookListExportButtonProps = {
  slug: string;
  collectionName: string;
  bookCount: number;
};

type ExportError = {
  code?: string;
  message?: string;
};

function getDownloadFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

export function BookListExportButton({ slug, collectionName, bookCount }: BookListExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [needsCard, setNeedsCard] = useState(false);

  async function exportBookList() {
    setIsExporting(true);
    setFeedback("");
    setNeedsCard(false);

    try {
      const response = await fetch(`/api/personal-collections/${encodeURIComponent(slug)}/books/export?format=xlsx`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });

      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({} as ExportError));
        if (response.status === 403 && (error.code === "CARD_REQUIRED" || error.code === "CARD_INACTIVE")) {
          setNeedsCard(true);
          setFeedback(error.message ?? "导出书单需要有效借阅证。");
        } else if (error.code === "NO_PUBLIC_BOOKS") {
          setFeedback("该收藏馆目前没有可导出的公开书籍。");
        } else if (response.status === 404 && !error.code) {
          setFeedback("书单导出接口尚未接通，请等待后端完成接口开发。");
        } else {
          setFeedback(error.message ?? "书单导出失败，请稍后重试。");
        }
        return;
      }

      const blob = await response.blob();
      const date = new Date().toISOString().slice(0, 10);
      const safeCollectionName = collectionName.replace(/[\\/:*?"<>|]/g, "-");
      const filename = getDownloadFilename(
        response.headers.get("Content-Disposition"),
        `${safeCollectionName}-公开书单-${date}.xlsx`,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setFeedback("公开书单已开始下载。");
    } catch {
      setFeedback("网络连接异常，暂时无法导出书单。");
    } finally {
      setIsExporting(false);
    }
  }

  return <div className="public-book-list-export">
    <button type="button" onClick={exportBookList} disabled={isExporting || bookCount === 0}>
      {bookCount === 0 ? "暂无可导出书籍" : isExporting ? "正在生成表格…" : "导出公开书单"}
    </button>
    <small>持有效借阅证可导出</small>
    {feedback && <span role="status">{feedback}{needsCard && <> <Link href="/account">查看或办理借阅证</Link></>}</span>}
  </div>;
}
