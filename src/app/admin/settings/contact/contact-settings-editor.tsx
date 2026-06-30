"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ContactSettingKey, ContactSettingRow } from "@/lib/contact-settings";
import { saveContactSetting } from "./actions";

type SaveStatus = "error" | "idle" | "saved" | "saving";

type ContactSettingsEditorProps = {
  rows: ContactSettingRow[];
};

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-primary focus:ring-2 focus:ring-primary/20";

const sections = [
  {
    key: "email",
    title: "Email Addresses",
    description: "Public inboxes shown on the contact page.",
    groups: new Set(["email"]),
  },
  {
    key: "phone",
    title: "Phone Numbers",
    description: "Institutional phone contacts shown as tappable links.",
    groups: new Set(["phone"]),
  },
  {
    key: "location-hours",
    title: "Location & Hours",
    description: "Address, founding date, and public office hours.",
    groups: new Set(["location", "hours"]),
  },
];

function fieldLabel(row: ContactSettingRow) {
  return row.group_name === "hours" ? row.label.replace(" Hours", "") : row.label;
}

function feedbackIcon(status: SaveStatus) {
  if (status === "saving") {
    return <Loader2 aria-hidden="true" size={14} className="animate-spin" />;
  }

  if (status === "saved") {
    return <CheckCircle2 aria-hidden="true" size={14} className="text-emerald-600" />;
  }

  if (status === "error") {
    return <XCircle aria-hidden="true" size={14} className="text-destructive" />;
  }

  return null;
}

export function ContactSettingsEditor({ rows }: ContactSettingsEditorProps) {
  const initialValues = useMemo(
    () =>
      rows.reduce<Record<ContactSettingKey, string>>(
        (accumulator, row) => ({
          ...accumulator,
          [row.key]: row.value,
        }),
        {} as Record<ContactSettingKey, string>,
      ),
    [rows],
  );
  const [values, setValues] = useState<Record<ContactSettingKey, string>>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<ContactSettingKey, string>>(
    initialValues,
  );
  const [statuses, setStatuses] = useState<Partial<Record<ContactSettingKey, SaveStatus>>>({});
  const [errors, setErrors] = useState<Partial<Record<ContactSettingKey, string>>>({});

  async function handleSave(row: ContactSettingRow) {
    const value = values[row.key] ?? "";

    if (value === savedValues[row.key]) {
      return;
    }

    setStatuses((current) => ({ ...current, [row.key]: "saving" }));
    setErrors((current) => ({ ...current, [row.key]: undefined }));

    try {
      await saveContactSetting(row.key, value);
      setSavedValues((current) => ({ ...current, [row.key]: value }));
      setStatuses((current) => ({ ...current, [row.key]: "saved" }));
      window.setTimeout(() => {
        setStatuses((current) =>
          current[row.key] === "saved" ? { ...current, [row.key]: "idle" } : current,
        );
      }, 1800);
    } catch {
      setStatuses((current) => ({ ...current, [row.key]: "error" }));
      setErrors((current) => ({
        ...current,
        [row.key]: "Unable to save setting.",
      }));
    }
  }

  return (
    <div className="grid gap-6">
      {sections.map((section) => {
        const sectionRows = rows.filter((row) => section.groups.has(row.group_name));

        return (
          <article key={section.key} className="glass-card grid gap-5 p-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {section.title}
              </h2>
              <p className="section-copy mt-1 text-sm">{section.description}</p>
            </div>

            <div className="grid gap-4">
              {sectionRows.map((row) => {
                const status = statuses[row.key] ?? "idle";
                const value = values[row.key] ?? "";
                const dirty = value !== savedValues[row.key];

                return (
                  <div
                    key={row.key}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] lg:items-start">
                      <div>
                        <label
                          className="text-sm font-medium text-[var(--foreground)]"
                          htmlFor={`contact-setting-${row.key}`}
                        >
                          {fieldLabel(row)}
                        </label>
                        {row.description ? (
                          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                            {row.description}
                          </p>
                        ) : null}
                      </div>

                      <input
                        className={inputClass}
                        id={`contact-setting-${row.key}`}
                        type={row.input_type}
                        value={value}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [row.key]: event.currentTarget.value,
                          }))
                        }
                      />

                      <button
                        className="secondary-button inline-flex h-10 min-w-24 items-center justify-center gap-2 px-3 text-xs"
                        type="button"
                        disabled={!dirty || status === "saving"}
                        onClick={() => {
                          void handleSave(row);
                        }}
                      >
                        {feedbackIcon(status)}
                        {status === "saving"
                          ? "Saving"
                          : status === "saved"
                            ? "Saved"
                            : status === "error"
                              ? "Retry"
                              : "Save"}
                      </button>
                    </div>

                    {errors[row.key] ? (
                      <p className="mt-2 text-xs font-medium text-destructive">
                        {errors[row.key]}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

