"use client";

import { createContext, useContext, type ReactNode } from "react";

const NonceContext = createContext<string | undefined>(undefined);

export function NonceProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string | undefined;
}) {
  return (
    <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
  );
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
