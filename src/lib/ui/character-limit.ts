/**
 * The behaviour of a character counter, with no opinion about how it looks.
 *
 * Two surfaces render one of these now — the Studio's help text field and the
 * notice editor's summary — and task 2.4 adds a third on the public form. The
 * public form is on semantic tokens and bans inline `var(--` (13.1c); admin has
 * its own healthy `notice-editor-counter` family. So the *presentation* legitimately
 * differs and the *rule* must not: this module is the rule, and each surface
 * supplies its own classes.
 *
 * That split is what 13.3b asks for. A single component with a `className` prop
 * would have worked too, and is worse: it invites one surface to pass the other
 * surface's classes.
 */

export type CharacterCounterTone = "danger" | "muted" | "warning";

/**
 * Proportional, not absolute.
 *
 * The original thresholds were hardcoded at 800 and 950 against a 1 000
 * character cap, so against the Studio's 500 cap the escalation was dead code
 * and against a 160 character short answer it would never have fired at all.
 */
export function characterCounterTone(length: number, maximum: number): CharacterCounterTone {
  const ratio = maximum > 0 ? length / maximum : 1;

  if (ratio >= 0.95) return "danger";
  if (ratio >= 0.8) return "warning";
  return "muted";
}

/**
 * The visible count.
 *
 * "characters" is spelled out rather than left as a bare `25 / 500`, because
 * this string is also read aloud as part of the control's description and a
 * bare ratio does not say what is being counted.
 */
export function characterCountLabel(current: number, maximum: number) {
  return `${current} / ${maximum} characters`;
}

/**
 * What a live region should say, or an empty string when it should stay quiet.
 *
 * Keyed to the tone rather than to the count, so the announcement fires when a
 * threshold is crossed and not on every keystroke. An assertive count would be
 * unusable; silence until 80% is the point.
 */
export function characterCountAnnouncement(current: number, maximum: number) {
  const tone = characterCounterTone(current, maximum);

  if (tone === "danger") {
    return "Character limit nearly reached.";
  }

  if (tone === "warning") {
    return `Approaching the ${maximum} character limit.`;
  }

  return "";
}
