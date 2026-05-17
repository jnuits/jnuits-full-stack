"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type AdvisorSpeechFormProps = {
  advisorId: string;
  initialSpeech: string;
  lastUpdatedLabel: string;
  saveAction: (formData: FormData) => void | Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" disabled={pending} type="submit">
      {pending ? "Updating message..." : "Update message"}
    </button>
  );
}

export function AdvisorSpeechForm({
  advisorId,
  initialSpeech,
  lastUpdatedLabel,
  saveAction,
}: AdvisorSpeechFormProps) {
  const [speech, setSpeech] = useState(initialSpeech);
  const characterCount = speech.length;

  return (
    <form
      action={saveAction}
      className="advisor-speech-form"
      style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}
    >
      <input name="advisorId" type="hidden" value={advisorId} />
      {!initialSpeech ? (
        <div className="flash-panel advisor-speech-form__empty" data-tone="info">
          <p>
            You haven&apos;t written a message yet. Add one to appear on the public site.
          </p>
        </div>
      ) : null}
      <label className="input-label" htmlFor="advisor-community-message">
        Message to the community
        <textarea
          id="advisor-community-message"
          maxLength={600}
          name="speech"
          onChange={(event) => setSpeech(event.target.value)}
          placeholder="Write a brief message for students and visitors..."
          rows={6}
          value={speech}
        />
      </label>
      <div
        className="advisor-speech-form__meta"
        style={{
          alignItems: "center",
          color: "var(--muted-foreground)",
          display: "flex",
          flexWrap: "wrap",
          fontSize: "0.78rem",
          gap: "0.5rem 1rem",
          justifyContent: "space-between",
        }}
      >
        <span>{characterCount} / 600</span>
        <span>{lastUpdatedLabel}</span>
      </div>
      <SubmitButton />
    </form>
  );
}
