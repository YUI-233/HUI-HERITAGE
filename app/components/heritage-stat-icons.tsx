type HeritageStatIconProps = { className?: string };

function IconFrame({ children, className }: HeritageStatIconProps & { children: React.ReactNode }) {
  return <svg className={className} viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function ApprovedIconFrame({ children, className }: HeritageStatIconProps & { children: React.ReactNode }) {
  return <svg className={className} viewBox="0 0 120 120" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export function ArchiveIndexIcon({ className }: HeritageStatIconProps) {
  return <IconFrame className={className}><path d="M4.2 7.2h15.6v12H4.2z"/><path d="M3.3 4.2h17.4v3H3.3z"/><path d="M9 11.2h6v3H9z"/></IconFrame>;
}

export function OpenBookIcon({ className }: HeritageStatIconProps) {
  return <ApprovedIconFrame className={className}><path d="M8 28c17-4 34-3 49 4v66c-15-7-32-8-49-4V28Z"/><path d="M112 28c-17-4-34-3-49 4v66c15-7 32-8 49-4V28Z"/><path d="M60 33v69M8 94c18-2 35 0 52 9 17-9 34-11 52-9M5 32v69c20-2 38 0 55 6 17-6 35-8 55-6V32"/><path d="M25 57h22M25 70h22M73 57h22M73 70h22"/></ApprovedIconFrame>;
}

export function LibraryIcon({ className }: HeritageStatIconProps) {
  return <ApprovedIconFrame className={className}><path d="M8 35 60 6l52 29H8ZM17 35 60 13l43 22M12 40h96M15 46h90"/><path d="M18 50h19M21 55h13v42H21zM18 101h19M43 50h19M46 55h13v42H46zM43 101h19M68 50h19M71 55h13v42H71zM68 101h19M93 50h19M96 55h13v42H96zM93 101h19"/><path d="M14 106h92M9 112h102M4 117h112"/></ApprovedIconFrame>;
}

export function CollectorIcon({ className }: HeritageStatIconProps) {
  return <ApprovedIconFrame className={className}><ellipse cx="60" cy="27" rx="20" ry="24"/><path d="M41 57c-17 5-27 21-27 43 0 10 6 16 15 16M79 57c17 5 27 21 27 43 0 10-6 16-15 16"/><circle cx="27" cy="98" r="11"/><circle cx="93" cy="98" r="11"/><path d="M37 86c8 1 16 4 23 8 7-4 15-7 23-8v30c-8 0-16 1-23 4-7-3-15-4-23-4V86ZM60 94v26"/></ApprovedIconFrame>;
}
