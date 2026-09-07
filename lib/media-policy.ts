export type Viewer = { id: string; role: "MEMBER" | "COLLECTOR" | "SUPER_ADMIN" } | null;
export type MediaVisibility = "PUBLIC" | "MEMBER_ONLY" | "PRIVATE";
/** Use this in the image route before resolving a local storageKey. */
export function canReadMedia(visibility: MediaVisibility, viewer: Viewer) { if (visibility === "PUBLIC") return true; if (visibility === "MEMBER_ONLY") return viewer !== null; return viewer?.role === "SUPER_ADMIN"; }
