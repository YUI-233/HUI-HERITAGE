"use client";

type AuditExportButtonProps = { id: string; onMessage: (message: string) => void };

export function AuditExportButton({ id, onMessage }: AuditExportButtonProps) {
  const download = async () => {
    const response = await fetch(`/api/admin/import-batches/${id}/export`);
    if (!response.ok) { const data = await response.json().catch(() => ({})); return onMessage(data.message ?? "审核记录下载失败。"); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `审核批次-${id}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    onMessage("审核记录已开始下载。");
  };
  return <button type="button" className="secondary" onClick={() => void download()}>下载审核记录</button>;
}
