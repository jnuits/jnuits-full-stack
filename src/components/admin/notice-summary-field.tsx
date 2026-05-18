"use client";

import { useMemo, useState } from "react";

type NoticeSummaryFieldProps = {
  defaultValue: string;
};

function counterTone(length: number) {
  if (length >= 950) {
    return "danger";
  }

  if (length >= 800) {
    return "warning";
  }

  return "muted";
}

export function NoticeSummaryField({ defaultValue }: NoticeSummaryFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const tone = useMemo(() => counterTone(value.length), [value.length]);

  return (
    <label className="notice-editor-field">
      <span>Summary *</span>
      <textarea
        className="notice-admin-field min-h-28"
        maxLength={1000}
        name="summary"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write the short public summary shown on the notices list."
        required
        value={value}
      />
      <small className={`notice-editor-counter notice-editor-counter--${tone}`}>
        {value.length} / 1000
      </small>
    </label>
  );
}
