import {
  characterCountAnnouncement,
  characterCountLabel,
  characterCounterTone,
  type CharacterCounterTone,
} from "@/lib/ui/character-limit";

/**
 * The admin presentation of a character counter, on admin's own class family.
 *
 * The rule lives in `@/lib/ui/character-limit` and is shared with the public
 * form's counter, which cannot use these classes: the public surface is on
 * semantic tokens per 13.1c. Same behaviour, two skins, one implementation of
 * the thresholds and the announcement.
 */
export type { CharacterCounterTone };
export { characterCounterTone };

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

  return (
    <>
      <small
        className={`notice-editor-counter notice-editor-counter--${tone}`}
        id={id}
      >
        {characterCountLabel(current, maximum)}
      </small>
      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {characterCountAnnouncement(current, maximum)}
      </span>
    </>
  );
}
