"use client";

import { useEffect } from "react";

export function HoldingFilterAutoClose() {
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      document.querySelectorAll<HTMLDetailsElement>(".holding-column-filter[open]").forEach((details) => {
        if (!details.contains(target)) details.open = false;
      });
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>(".holding-column-filter[open]").forEach((details) => {
        details.open = false;
      });
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return null;
}
