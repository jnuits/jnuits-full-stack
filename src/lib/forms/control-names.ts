/**
 * Names for public-form controls that are not questions.
 *
 * Question ids must start with a lowercase letter. Leading underscores make
 * these names structurally unreachable from Form Studio labels, so a question
 * can never collide with the honeypot or challenge token.
 */
export const PUBLIC_FORM_CAPTCHA_CONTROL_NAME = "__jnuits_captcha_token";
export const PUBLIC_FORM_HONEYPOT_CONTROL_NAME = "__jnuits_website";

/**
 * The hidden control carrying a telephone question's dial code. Task 2.6.
 *
 * Derived from the question's own id rather than a fixed name, because a form
 * may ask for more than one number. The `__` prefix is the same guarantee the
 * two names above rely on: a question id cannot begin with an underscore, so
 * this can never be mistaken for an answer or collide with one.
 *
 * `toAnswers` composes the submitted answer from this and the visible national
 * number, so this name never reaches the request body.
 */
export function phoneDialControlName(fieldId: string) {
  return `__jnuits_dial_${fieldId}`;
}
