"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", notify);

      return () => mediaQuery.removeEventListener("change", notify);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
