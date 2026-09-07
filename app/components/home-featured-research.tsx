import type { CSSProperties } from "react";
import type { HomeFeaturedResearch } from "../../lib/home-featured-research";

export function HomeFeaturedResearchSection({ research }: { research: HomeFeaturedResearch | null }) {
  if (!research) return null;
  const style = research.backgroundImagePath ? { "--home-research-image": `url("${research.backgroundImagePath}")` } as CSSProperties : undefined;
  return <section className={`home-featured-research${research.backgroundImagePath ? " home-featured-research-with-image" : ""}`} style={style} aria-labelledby="home-featured-research-title">
    <div className="home-featured-research-content">
      <p className="home-featured-research-eyebrow">ACADEMIC RESEARCH · 推荐阅读</p>
      <span className="home-featured-research-rule" aria-hidden="true" />
      <p className="home-featured-research-category">{research.category}</p>
      <h2 id="home-featured-research-title">{research.title}</h2>
      <p className="home-featured-research-meta">{research.meta}</p>
      <p className="home-featured-research-summary">{research.summary}</p>
      <a href={research.href}>{research.buttonLabel}<span aria-hidden="true">→</span></a>
    </div>
  </section>;
}
