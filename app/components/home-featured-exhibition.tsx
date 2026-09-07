import type { FeaturedExhibition } from "../../lib/featured-exhibition";

export function HomeFeaturedExhibition({ exhibition }: { exhibition: FeaturedExhibition | null }) {
  if (!exhibition) return null;
  return <section className="home-featured-exhibition" aria-labelledby="featured-exhibition-title">
    <div className="home-featured-copy">
      <p className="home-featured-eyebrow">FEATURED EXHIBITION · 精选展览</p>
      <span className="home-featured-rule" aria-hidden="true" />
      <h2 id="featured-exhibition-title">{exhibition.title}</h2>
      <p className="home-featured-meta">{exhibition.meta}</p>
      <p className="home-featured-description">{exhibition.description}</p>
      <a className="home-featured-action" href={exhibition.href}>{exhibition.buttonLabel}</a>
    </div>
    <div className="home-featured-media">
      <a className="home-featured-visual" href={exhibition.href} aria-label={`查看《${exhibition.title}》详情`}>
        <img src={exhibition.image} alt={exhibition.title} />
      </a>
      <aside className="home-featured-source" aria-label={`资料来源：${exhibition.sourceLines.join("，")}`}>
        <span className="home-featured-source-rule" aria-hidden="true" />
        <span className="home-featured-source-text">
          <span className="home-featured-source-label">資料來源</span>
          <span className="home-featured-source-kind">{exhibition.sourceLines[0]}</span>
          <span className="home-featured-source-name">{exhibition.sourceLines[1]}</span>
        </span>
      </aside>
    </div>
  </section>;
}
