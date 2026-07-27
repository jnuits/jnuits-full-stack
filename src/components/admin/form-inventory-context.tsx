"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ManagedFormLifecycle } from "@/lib/forms/lifecycle-actions";

export type FormInventoryKind =
  | "alumni_onboarding"
  | "event_registration"
  | "membership_application";

export type FormInventoryItem = {
  currentPublishedVersionId: null | string;
  id: string;
  kind: FormInventoryKind;
  /** Canonical union, so the studio and lifecycle panel cannot drift apart. */
  lifecycle: ManagedFormLifecycle;
  slug: string;
  title: string;
  updatedAt?: string;
};

type FormInventoryValue = {
  error: null | string;
  forms: FormInventoryItem[];
  loading: boolean;
  /**
   * Canonical public origin, resolved on the server and passed in. Panels must
   * use this rather than `window.location.origin`, which produces a share link
   * for whatever host the operator happens to be browsing.
   */
  publicBaseUrl: string;
  refresh: () => Promise<void>;
};

/**
 * The Form Studio page mounts three panels that all need the same inventory.
 * Loading it once here keeps them consistent: a publish or lifecycle change
 * refreshes every panel together instead of leaving the others stale.
 */
const FormInventoryContext = createContext<FormInventoryValue | null>(null);

export function useFormInventory() {
  const value = useContext(FormInventoryContext);
  if (!value) {
    throw new Error("useFormInventory must be used inside FormInventoryProvider.");
  }
  return value;
}

export function FormInventoryProvider({
  children,
  publicBaseUrl,
}: {
  children: ReactNode;
  publicBaseUrl: string;
}) {
  const [forms, setForms] = useState<FormInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/forms?pageSize=100", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; items?: FormInventoryItem[] }
        | null;
      if (!response.ok) throw new Error(payload?.error || "Forms could not be loaded.");
      setForms(payload?.items || []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Forms could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ error, forms, loading, publicBaseUrl, refresh }),
    [error, forms, loading, publicBaseUrl, refresh]
  );

  return (
    <FormInventoryContext.Provider value={value}>{children}</FormInventoryContext.Provider>
  );
}
