/**
 * Moves focus to an element and brings it into view.
 *
 * Extracted from `public-form-screen.tsx` for issue #134, which needs the same
 * treatment on the confirmation screen. The reason it was already one function
 * rather than one copy per effect applies just as well across two files: two
 * copies would eventually disagree about the scroll, and the one nobody
 * re-read would be the one that was wrong.
 *
 * `preventScroll` followed by an explicit `scrollIntoView` rather than letting
 * the focus scroll happen: the default puts the element hard against the edge
 * of the viewport, which on a phone can leave the message beside it off screen.
 *
 * The `scrollIntoView` guard is not defensive noise. jsdom does not implement
 * the method, so without the check every component test of a screen using this
 * throws where it should have failed an assertion, and the throw reads like a
 * broken test rather than a broken screen.
 */
export function focusAndReveal(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  element.focus({ preventScroll: true });

  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ block: "center" });
  }
}
