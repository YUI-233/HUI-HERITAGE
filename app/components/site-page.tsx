import type { SitePage, SitePageSlug } from "../../lib/site-pages";
import type { CSSProperties } from "react";
import { PublicHeader } from "./public-header";

export function SitePageView({ page, slug }: { page: SitePage; slug: SitePageSlug }) {
  const paragraphs = page.body.split(/\n{2,}/).filter(Boolean);
  const tone = page.textTone === "light" ? { title: "#fffaf2", copy: "#f6ede1", eyebrow: "#f2c5b2" } : { title: "#1d1916", copy: "#554d44", eyebrow: "#b3332e" };
  const overlay = page.overlayTone === "light" ? "#f8f4ec" : page.overlayTone === "dark" ? "#17201f" : "transparent";
  const heroStyle = { "--site-page-image": `url("${page.backgroundImagePath}")`, "--site-page-image-position-x": `${page.backgroundPositionX}%`, "--site-page-image-position-y": `${page.backgroundPositionY}%`, "--site-page-title-color": tone.title, "--site-page-copy-color": tone.copy, "--site-page-eyebrow-color": tone.eyebrow, "--site-page-overlay-color": overlay, "--site-page-overlay-opacity": `${page.overlayOpacity / 100}` } as CSSProperties;
  return <main className="site-page"><PublicHeader/><section className={`site-page-hero site-page-hero-${slug}`} style={heroStyle}><div><p className="eyebrow">HUI HERITAGE</p><h1>{page.title}</h1><p>{page.intro}</p></div></section><article className="site-page-body">{paragraphs.map((paragraph, index) => <p key={index}>{slug === "contact" && paragraph.includes("huiheritage@gmail.com") ? <>{paragraph.split("huiheritage@gmail.com")[0]}<a href="mailto:huiheritage@gmail.com">huiheritage@gmail.com</a>{paragraph.split("huiheritage@gmail.com").slice(1).join("huiheritage@gmail.com")}</> : paragraph}</p>)}</article></main>;
}
