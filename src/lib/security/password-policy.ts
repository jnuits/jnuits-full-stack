export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

// This is deliberately small and maintainable. It blocks the most predictable
// choices without claiming to be a breached-password database.
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "admin123456",
  "password123",
  "password1234",
  "qwerty123456",
  "welcome12345",
  "letmein12345",
  "iloveyou12345",
  "jnuits123456",
]);

type PasswordPolicyContext = {
  email?: string | null;
};

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function getPasswordPolicyError(
  password: string,
  context: PasswordPolicyContext = {}
) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const normalizedPassword = normalized(password);

  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    return "Choose a password that is not commonly used.";
  }

  if (/^(.)\1+$/.test(password)) {
    return "Choose a password with more than one repeated character.";
  }

  const emailLocalPart = context.email
    ?.trim()
    .toLocaleLowerCase("en-US")
    .split("@", 1)[0];

  if (emailLocalPart && emailLocalPart.length >= 3 && normalizedPassword.includes(emailLocalPart)) {
    return "Do not include your email name in the password.";
  }

  return null;
}

export function meetsPasswordPolicy(
  password: string,
  context: PasswordPolicyContext = {}
) {
  return getPasswordPolicyError(password, context) === null;
}