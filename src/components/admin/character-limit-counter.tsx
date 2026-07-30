"use client";

import { useEffect, useRef, useState } from "react";

export type CharacterCounterTone = "danger" | "muted" | "warning";

export function characterCounterTone(length: number, maximum: number): CharacterCounterTone {
  const ratio = maximum > 0 ? length / maximum : 1;

  if (ratio >= 0.95) return "danger";
  if (ratio >= 0.8) return "warning";
  return "muted";
}

export function CharacterLimitCounter({
  current,
  id,
  maximum,
}: {
  current: number;
  id: string;
  maximum: number;
}) {
  const tone = characterCounterTone(current, maximum);
  const previousTone = useRef(tone);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (tone === previousTone.current) return;

    previousTone.current = tone;
    setAnnouncement(
      tone === "danger"
        ? `Character limit nearly reached. ${maximum - current} characters remain.`
        : tone === "warning"
          ? `Approaching the ${maximum} character limit.`
          : ""
    );
  }, [current, maximum, tone]);

  return (
    <>
      <small
        className={`notice-editor-counter notice-editor-counter--${tone}`}
        id={id}
      >
        {current} / {maximum} characters
      </small>
      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {announcement}
      </span>
    </>
  );
}
