type BorrowingCardVisualProps = {
  cardNumber: string;
  holderName: string;
  issuedAt: string;
  limited: boolean;
  limit: number | null;
};

type IconProps = { className?: string };

function BookOpenIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 5.7c2.9-.8 5.5-.2 8.5 2.1v10.6c-3-2.3-5.6-2.9-8.5-2.1V5.7Z"/><path d="M20.5 5.7c-2.9-.8-5.5-.2-8.5 2.1v10.6c3-2.3 5.6-2.9 8.5-2.1V5.7Z"/><path d="M12 7.8v10.6"/></svg>;
}

function ContactCardIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16c.8-1.7 2-2.5 3.2-2.5s2.5.8 3.2 2.5M15 10h3M15 14h3"/></svg>;
}

function CalendarIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="1.5"/><path d="M7 3.5v4M17 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/></svg>;
}

function BooksIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 7 9-3 7 3-9 3L4 7Z"/><path d="m4 11 9 3 7-3M4 15l9 3 7-3M4 7v8l9 5 7-5V7"/></svg>;
}

export function BorrowingCardVisual({ cardNumber, holderName, issuedAt, limited, limit }: BorrowingCardVisualProps) {
  const issueDate = new Date(issuedAt);
  const validUntil = new Date(issueDate);
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const formatDate = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("/");
  const date = formatDate(issueDate);
  const fields = [
    { label: "书斋名", value: holderName, icon: BookOpenIcon, tone: "blue" },
    { label: "借阅证号", value: cardNumber, icon: ContactCardIcon, tone: "blue" },
    { label: "办理日期", value: date, icon: CalendarIcon, tone: "orange" },
    { label: "借阅额度", value: limited ? "每日" + (limit ?? 5) + "本" : "不设每日上限", icon: BooksIcon, tone: "orange" },
  ];

  return <div className="borrowing-card-visual" aria-label={holderName + "的 HUI HERITAGE 借阅证"}>
    <aside className="borrowing-card-ribbon"><span>HUI HERITAGE LIBRARY</span><BookOpenIcon className="borrowing-card-ribbon-icon"/></aside>
    <div className="borrowing-card-content">
      <div className="borrowing-card-brand"><span><em>HUI</em> HERITAGE</span><small>以文载道　以典传真</small></div>
      <img className="borrowing-card-mark" src="/brand-mark.png" alt="HUI HERITAGE 印章"/>
      <div className="borrowing-card-title"><small>LIBRARY CARD</small><strong>借阅证</strong></div>
      <dl className="borrowing-card-fields">{fields.map(({ label, value, icon: Icon, tone }) => <div className={"borrowing-card-field borrowing-card-field--" + tone} key={label}><span className="borrowing-card-field-icon"><Icon/></span><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>
      <p>VALID <i>{formatDate(validUntil)}</i></p>
    </div>
    <img className="borrowing-card-wave" src="/hui_heritage_wave_exact_1536x1024_transparent.svg" alt="" aria-hidden="true"/>
  </div>;
}
