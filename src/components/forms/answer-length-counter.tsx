"use client";

import {
  characterCountAnnouncement,
  characterCountLabel,
  characterCounterTone,
} from "@/lib/ui/character-limit";

/**
 * The public form's character counter. Task 2.4.
 *
 * Shares its thresholds, its label and its announcement with the Studio's
 * counter through `@/lib/ui/character-limit`, and shares none of its classes:
 * the public surface is on semantic tokens (13.1c) and admin has its own
 * `notice-editor-counter` family. One rule, two skins.
 *
 * Two decisions worth arguing with:
 *
 * **The count is hidden until it matters.** Admin shows `0 / 500` from the
 * first render, which is right there: an operator is authoring against a limit
 * they chose. A respondent did not choose it, and `0 / 160` under "Full name"
 * is clutter that teaches nothing. So the visible count appears at the warning
 * threshold, which is the point at which the browser's silent hard stop stops
 * being hypothetical.
 *
 * **The live region is always mounted, even while it is empty.** Rendering it
 * only at the threshold would mean it arrives with its announcement already
 * inside it, and several screen readers announce only *mutations* to a region
 * that already existed -- the #91 finding behind task 2.2's success half. An
 * empty region that later fills is the shape that actually speaks.
 */
const COUNT_CLASS = "mt-1 text-sm leading-6";

const TONE_CLASS = {
  // No semantic warning token exists yet; decision 8 is open and 13.3a is where
  // it gets settled. Weight rather than an invented colour, so nothing here has
  // to be unpicked when that decision lands.
  danger: "font-medium text-destructive",
  muted: "text-muted-foreground",
  warning: "font-medium text-foreground",
} as const;

export function AnswerLengthCounter({
  current,
  id,
  maximum,
}: {
  current: number;
  id: string;
  maximum: number;
}) {
  const tone = characterCounterTone(current, maximum);

  return (
    <>
      {tone === "muted" ? null : (
        <p className={`${COUNT_CLASS} ${TONE_CLASS[tone]}`} id={id}>
          {characterCountLabel(current, maximum)}
        </p>
      )}
      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {characterCountAnnouncement(current, maximum)}
      </span>
    </>
  );
}
