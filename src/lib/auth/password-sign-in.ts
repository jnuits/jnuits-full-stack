import "server-only";

import { isCaptchaRequired } from "@/lib/security/captcha";

type PasswordSignInPayloadInput = {
  captchaToken?: null | string;
  email: string;
  password: string;
};

export function buildPasswordSignInPayload({
  captchaToken,
  email,
  password,
}: PasswordSignInPayloadInput) {
  const token = captchaToken?.trim();

  if (isCaptchaRequired() && token) {
    return {
      email,
      options: {
        captchaToken: token,
      },
      password,
    };
  }

  return {
    email,
    password,
  };
}
