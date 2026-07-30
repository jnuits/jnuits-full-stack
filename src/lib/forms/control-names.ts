/**
 * Names for public-form controls that are not questions.
 *
 * Question ids must start with a lowercase letter. Leading underscores make
 * these names structurally unreachable from Form Studio labels, so a question
 * can never collide with the honeypot or challenge token.
 */
export const PUBLIC_FORM_CAPTCHA_CONTROL_NAME = "__jnuits_captcha_token";
export const PUBLIC_FORM_HONEYPOT_CONTROL_NAME = "__jnuits_website";
