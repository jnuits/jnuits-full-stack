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
  const announcement =
    tone === "danger"
      ? "Character limit nearly reached."
      : tone === "warning"
        ? `Approaching the ${maximum} character limit.`
        : "";

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
