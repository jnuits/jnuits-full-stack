"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";

const fields = [
  ["phone", "Phone", "tel", 40],
  ["currentOrganization", "Current organization", "text", 180],
  ["designation", "Designation", "text", 160],
  ["workLocation", "Work location", "text", 160],
  ["facebookUrl", "Facebook URL", "url", 2048],
  ["linkedinUrl", "LinkedIn URL", "url", 2048],
  ["websiteUrl", "Website URL", "url", 2048],
] as const;

type Field = (typeof fields)[number][0] | "professionalVisibility";
export type WorkplaceApplicability = "applicable" | "not_applicable" | null;

export type DirectProfileEditFormProps = {
  currentValues: Record<Field, string | null>;
  stepUpActive: boolean;
  workplaceContractReady?: boolean;
  workplaceApplicability?: WorkplaceApplicability;
};

export function DirectProfileEditForm({
  currentValues,
  stepUpActive,
  workplaceContractReady = false,
  workplaceApplicability = null,
}: DirectProfileEditFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitLocked = useRef(false);
  const canonicalApplicability = workplaceApplicability ?? "";
  const [applicability, setApplicability] = useState({
    canonical: canonicalApplicability,
    selected: canonicalApplicability,
  });
  // A successful refresh can normalize unanswered + new workplace to applicable.
  // Reconcile a clean control, while preserving an independently edited choice.
  if (applicability.canonical !== canonicalApplicability) {
    setApplicability({
      canonical: canonicalApplicability,
      selected: applicability.selected === applicability.canonical
        ? canonicalApplicability : applicability.selected,
    });
  }
  const selectedApplicability = applicability.selected;
  const setSelectedApplicability = (selected: string) =>
    setApplicability(current => ({ ...current, selected }));

  const orgRef = useRef<HTMLInputElement>(null);
  const desigRef = useRef<HTMLInputElement>(null);
  const locRef = useRef<HTMLInputElement>(null);

  // Preserve focus intent through password unlock; focus only once authorized editor is active
  useEffect(() => {
    if (!stepUpActive || typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const target = document.getElementById(hash);
    if (target) {
      target.focus();
    }
  }, [stepUpActive]);

  function handleClearWorkplaceFields() {
    if (orgRef.current) orgRef.current.value = "";
    if (desigRef.current) desigRef.current.value = "";
    if (locRef.current) locRef.current.value = "";
    setError(null);
  }

  async function handleSubmit(formData: FormData) {
    if (submitLocked.current) return;
    setError(null);
    setMessage(null);

    const keys: Field[] = [...fields.map(([key]) => key), "professionalVisibility"];
    const payload: Record<string, string> = {};

    for (const key of keys) {
      const formValue = String(formData.get(key) ?? "").trim();
      const initialValue = (currentValues[key as Field] ?? "").trim();
      if (formValue !== initialValue) {
        payload[key] = formValue;
      }
    }

    if (workplaceContractReady) {
      const rawApplicability = String(formData.get("workplaceApplicability") ?? "").trim();
      const orgVal = String(formData.get("currentOrganization") ?? "").trim();
      const desigVal = String(formData.get("designation") ?? "").trim();
      const locVal = String(formData.get("workLocation") ?? "").trim();

      // not_applicable requires blank currentOrganization, designation and workLocation
      if (rawApplicability === "not_applicable" && (orgVal || desigVal || locVal)) {
        setError(
          "To declare workplace not applicable, please clear current organization, designation, and work location first."
        );
        return;
      }

      const initialApplicability = workplaceApplicability ?? "";
      if (rawApplicability !== initialApplicability) {
        payload["workplaceApplicability"] = rawApplicability || "";
      }
    }

    if (!Object.keys(payload).length) {
      setMessage("No profile fields changed.");
      return;
    }

    submitLocked.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/profile/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message || "Profile save failed. Unlock editing and try again.");
        return;
      }
      setMessage(body?.message || "Profile changes saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Your changes have not been saved; please retry.");
    } finally {
      submitLocked.current = false;
      setPending(false);
    }
  }

  return (
    <section className="profile-edit-card profile-edit-card--direct">
      <div className="profile-edit-card__header">
        <div
          className="profile-edit-card__icon"
          data-tone={stepUpActive ? "success" : "locked"}
        >
          {stepUpActive ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
        </div>
        <div>
          <p className="profile-edit-kicker">Direct profile edit</p>
          <h2 className="profile-edit-title">Update contact and workplace details</h2>
        </div>
      </div>
      <p className="profile-edit-copy">
        These changes save immediately after current-password verification. Identity and
        academic details require approval below.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
        className="profile-edit-form-grid"
        id="direct-profile-edit-form"
      >
        {fields.map(([key, label, type, maxLength]) => {
          const inputRef =
            key === "currentOrganization"
              ? orgRef
              : key === "designation"
                ? desigRef
                : key === "workLocation"
                  ? locRef
                  : undefined;

          return (
            <label className="input-label" htmlFor={`dpe-${key}`} key={key}>
              {label}
              <input
                id={`dpe-${key}`}
                name={key}
                type={type}
                maxLength={maxLength}
                defaultValue={currentValues[key] ?? ""}
                disabled={!stepUpActive || pending}
                ref={inputRef}
                autoComplete={type === "url" ? "url" : type === "tel" ? "tel" : undefined}
              />
            </label>
          );
        })}

        {workplaceContractReady && (
          <div className="profile-edit-span-2 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-3.5">
            <label className="input-label" htmlFor="dpe-workplaceApplicability">
              Workplace applicability
              <select
                id="dpe-workplaceApplicability"
                name="workplaceApplicability"
                value={selectedApplicability}
                onChange={(e) => setSelectedApplicability(e.target.value)}
                disabled={!stepUpActive || pending}
              >
                <option value="">Unanswered / Not specified</option>
                <option value="applicable">Workplace applies (currently employed / active)</option>
                <option value="not_applicable">Not applicable (student, between roles, or retired)</option>
              </select>
            </label>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              An explicit &ldquo;Not applicable&rdquo; declaration excludes workplace details from completion scoring.
              It requires current organization, designation, and location to remain blank.
            </p>
            {selectedApplicability === "not_applicable" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearWorkplaceFields}
                  disabled={!stepUpActive || pending}
                  className="ghost-button text-xs"
                >
                  Clear workplace fields locally
                </button>
                <span className="text-xs text-[var(--muted-foreground)]">
                  (Changes can be reviewed before clicking Save below)
                </span>
              </div>
            )}
          </div>
        )}

        <label className="input-label" htmlFor="dpe-visibility">
          Workplace visibility
          <select
            id="dpe-visibility"
            name="professionalVisibility"
            defaultValue={currentValues.professionalVisibility ?? "members-only"}
            disabled={!stepUpActive || pending}
          >
            <option value="private">Private</option>
            <option value="members-only">Members only</option>
            <option value="public">Public</option>
          </select>
        </label>

        <p className="profile-edit-copy profile-edit-span-2">
          Public workplace details may appear in the public directory. Choose Private to
          keep them out of the directory.
        </p>

        <div className="profile-edit-actions profile-edit-span-2">
          <button
            className="primary-button"
            disabled={!stepUpActive || pending}
            type="submit"
          >
            {pending ? "Saving..." : "Save direct changes"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="portal-message portal-message--success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="portal-message portal-message--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
