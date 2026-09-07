"use client";

type Volume = { id: string; label: string };

export function VolumeSwitcher({ recordId, volumes, currentVolumeId }: { recordId: string; volumes: Volume[]; currentVolumeId?: string }) {
  if (volumes.length < 2) return null;

  return <label className="reader-volume-switcher">选择册数
    <select value={currentVolumeId ?? volumes[0].id} onChange={(event) => {
      // PDF.js keeps a document worker alive during App Router's client-side
      // transition. Loading the next volume in that overlap can fail even
      // though the file itself is available. A normal document navigation
      // gives every volume a fresh reader instance and matches a manual refresh.
      window.location.assign(`/catalog/${recordId}/reader?volume=${encodeURIComponent(event.target.value)}`);
    }}>
      {volumes.map((volume) => <option key={volume.id} value={volume.id}>{volume.label}</option>)}
    </select>
  </label>;
}
