"use client";

import { useState } from "react";

type Media = { id: string };

export function PublicDetailGallery({ itemId, title, media }: { itemId: string; title: string; media: Media[] }) {
  const [activeMediaId, setActiveMediaId] = useState(media[0]?.id ?? "");
  const active = media.find((item) => item.id === activeMediaId) ?? media[0];
  const imageUrl = (mediaId: string) => `/api/personal-collection/public/${itemId}/media/${mediaId}`;

  return <div className="public-personal-detail-media">
    {active ? <img src={imageUrl(active.id)} alt={`${title}图片`} /> : <div className="public-personal-detail-empty">暂无公开图片</div>}
    {media.length > 1 && <div className="public-personal-detail-thumbs">
      {media.map((item, index) => <button type="button" key={item.id} aria-label={`查看第 ${index + 1} 张图片`} className={item.id === active?.id ? "active" : ""} onClick={() => setActiveMediaId(item.id)}><img src={imageUrl(item.id)} alt="" /></button>)}
    </div>}
  </div>;
}
