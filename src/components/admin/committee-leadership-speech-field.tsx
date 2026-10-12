"use client";
import { useId, useState } from "react";
import { COMMITTEE_SPEECH_MAX_LENGTH, isCommitteeSpokespersonRole } from "@/lib/committee/speech";

export function CommitteeLeadershipSpeechField({ roleCode, speech }: { roleCode?: string | null; speech: string | null }) {
  const [value, setValue] = useState(speech || "");
  const id = useId();
  if (!isCommitteeSpokespersonRole(roleCode)) return <input name="speech" type="hidden" value="" />;
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>Leadership speech / quote</label>
      <textarea aria-describedby={id + "-help " + id + "-count"} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" id={id} maxLength={COMMITTEE_SPEECH_MAX_LENGTH} name="speech" onChange={event => setValue(event.target.value)} rows={3} value={value} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <p id={id + "-help"}>Optional public message for this committee tenure. Keep it to 2–4 short lines.</p>
        <p id={id + "-count"}>{value.length} / {COMMITTEE_SPEECH_MAX_LENGTH}</p>
      </div>
    </div>
  );
}
