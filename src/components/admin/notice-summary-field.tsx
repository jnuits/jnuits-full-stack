"use client";

import { useState } from "react";

import { CharacterLimitCounter } from "@/components/admin/character-limit-counter";

type NoticeSummaryFieldProps = {
  defaultValue: string;
};

export function NoticeSummaryField({ defaultValue }: NoticeSummaryFieldProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="notice-editor-field">
      <label htmlFor="notice-summary">Summary *</label>
      <textarea
        aria-describedby="notice-summary-counter"
        className="notice-admin-field min-h-28"
        id="notice-summary"
        maxLength={1000}
        name="summary"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write the short public summary shown on the notices list."
        required
        value={value}
      />
      <CharacterLimitCounter
        current={value.length}
        id="notice-summary-counter"
        maximum={1000}
      />
    </div>
  );
}
