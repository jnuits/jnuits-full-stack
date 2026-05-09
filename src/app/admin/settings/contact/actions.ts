"use server";

import { updateContactSetting } from "@/lib/contact-settings";

export async function saveContactSetting(key: string, value: string) {
  await updateContactSetting(key, value);
}
