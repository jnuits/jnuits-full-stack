"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
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
type Field = typeof fields[number][0] | "professionalVisibility";

export function DirectProfileEditForm({ currentValues, stepUpActive }: {
  currentValues: Record<Field, string | null>;
  stepUpActive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function handleSubmit(formData: FormData) {
    setError(null); setMessage(null);
    const keys: Field[] = [...fields.map(([key]) => key), "professionalVisibility"];
    const payload = Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "").trim()])
      .filter(([key, value]) => value !== (currentValues[key as Field] ?? "").trim()));
    if (!Object.keys(payload).length) { setMessage("No profile fields changed."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/profile/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.message || "Profile save failed. Unlock editing and try again."); return; }
      setMessage(body?.message || "Profile changes saved."); router.refresh();
    } catch { setError("Unable to reach the server. Your changes have not been saved; please retry."); }
    finally { setPending(false); }
  }
  return <section className="profile-edit-card profile-edit-card--direct">
    <div className="profile-edit-card__header">
      <div className="profile-edit-card__icon" data-tone={stepUpActive ? "success" : "locked"}>{stepUpActive ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}</div>
      <div><p className="profile-edit-kicker">Direct profile edit</p><h2 className="profile-edit-title">Update contact and workplace details</h2></div>
    </div>
    <p className="profile-edit-copy">These changes save immediately after current-password verification. Identity and academic details require approval below.</p>
    <form action={(data) => startTransition(() => void handleSubmit(data))} className="profile-edit-form-grid" id="direct-profile-edit-form">
      {fields.map(([key, label, type, maxLength]) => <label className="input-label" htmlFor={`dpe-${key}`} key={key}>{label}<input id={`dpe-${key}`} name={key} type={type} maxLength={maxLength} defaultValue={currentValues[key] ?? ""} disabled={pending} autoComplete={type === "url" ? "url" : type === "tel" ? "tel" : undefined} /></label>)}
      <label className="input-label" htmlFor="dpe-visibility">Workplace visibility<select id="dpe-visibility" name="professionalVisibility" defaultValue={currentValues.professionalVisibility ?? "members-only"} disabled={pending}><option value="private">Private</option><option value="members-only">Members only</option><option value="public">Public</option></select></label>
      <p className="profile-edit-copy profile-edit-span-2">Public workplace details may appear in the public directory. Choose Private to keep them out of the directory.</p>
      <div className="profile-edit-actions profile-edit-span-2"><button className="primary-button" disabled={!stepUpActive || pending} type="submit">{pending ? "Saving..." : "Save direct changes"}</button></div>
    </form>
    {message ? <p className="portal-message portal-message--success" role="status">{message}</p> : null}
    {error ? <p className="portal-message portal-message--error" role="alert">{error}</p> : null}
  </section>;
}
