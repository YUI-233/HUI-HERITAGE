import type { CSSProperties } from "react";
import type { ResearchInvitationContent } from "../../lib/research-invitation";

export function HomeResearchInvitation({ content }: { content: ResearchInvitationContent }) {
  const style = content.backgroundImagePath ? { "--research-invitation-image": `url("${content.backgroundImagePath}")` } as CSSProperties : undefined;
  return <section className={`home-research-invitation${content.backgroundImagePath ? " home-research-invitation-with-image" : ""}`} style={style} aria-labelledby="research-invitation-title"><div className="home-research-invitation-content"><p className="home-research-invitation-eyebrow">{content.eyebrow}</p><span className="home-research-invitation-rule" aria-hidden="true"/><h2 id="research-invitation-title">{content.title}</h2><p>{content.introduction}</p><ul>{content.cards.map((card, index) => <li key={`${card.title}-${index}`}><b>{card.title}</b><span>{card.description}</span></li>)}</ul><a href="/support">{content.buttonLabel}<span aria-hidden="true">→</span></a></div></section>;
}
