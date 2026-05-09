import "server-only";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/auth/session";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

export type ContactSettings = {
  email_primary: string;
  email_university: string;
  email_legacy: string;
  phone_primary: string;
  phone_secondary: string;
  address: string;
  founded_date: string;
  hours_sat: string;
  hours_sun: string;
  hours_mon: string;
  hours_tue: string;
  hours_wed: string;
  hours_thu: string;
  hours_fri: string;
};

export type ContactSettingKey = keyof ContactSettings;

export type ContactSettingRow = {
  key: ContactSettingKey;
  value: string;
  label: string;
  description: null | string;
  input_type: "email" | "tel" | "text";
  group_name: "email" | "general" | "hours" | "location" | "phone";
  sort_order: number;
  is_public: boolean;
  updated_at: null | string;
};

export const CONTACT_SETTING_DEFAULTS: ContactSettings = {
  email_primary: "info@jnuits.org.bd",
  email_university: "itsociety@association.jnu.ac.bd",
  email_legacy: "jnuitsbd@gmail.com",
  phone_primary: "+880 1721-129467",
  phone_secondary: "+880 1567-934536",
  address: "9, 10 Chittaranjan Ave, Dhaka 1100, Bangladesh",
  founded_date: "November 11, 2015",
  hours_sat: "Closed",
  hours_sun: "8:00 AM – 4:00 PM",
  hours_mon: "8:00 AM – 4:00 PM",
  hours_tue: "8:00 AM – 4:00 PM",
  hours_wed: "8:00 AM – 4:00 PM",
  hours_thu: "8:00 AM – 4:00 PM",
  hours_fri: "Closed",
};

export const CONTACT_SETTING_DEFAULT_ROWS: ContactSettingRow[] = [
  {
    key: "email_primary",
    value: CONTACT_SETTING_DEFAULTS.email_primary,
    label: "Primary Email",
    description: "Main contact email shown on contact page",
    input_type: "email",
    group_name: "email",
    sort_order: 1,
    is_public: true,
    updated_at: null,
  },
  {
    key: "email_university",
    value: CONTACT_SETTING_DEFAULTS.email_university,
    label: "University Email",
    description: "Official JnU authority email (CC)",
    input_type: "email",
    group_name: "email",
    sort_order: 2,
    is_public: true,
    updated_at: null,
  },
  {
    key: "email_legacy",
    value: CONTACT_SETTING_DEFAULTS.email_legacy,
    label: "Legacy Email",
    description: "Old Gmail address (CC/archive)",
    input_type: "email",
    group_name: "email",
    sort_order: 3,
    is_public: true,
    updated_at: null,
  },
  {
    key: "phone_primary",
    value: CONTACT_SETTING_DEFAULTS.phone_primary,
    label: "Primary Phone",
    description: "Main organisational contact number",
    input_type: "tel",
    group_name: "phone",
    sort_order: 1,
    is_public: true,
    updated_at: null,
  },
  {
    key: "phone_secondary",
    value: CONTACT_SETTING_DEFAULTS.phone_secondary,
    label: "Secondary Phone",
    description: "Secondary contact number",
    input_type: "tel",
    group_name: "phone",
    sort_order: 2,
    is_public: true,
    updated_at: null,
  },
  {
    key: "address",
    value: CONTACT_SETTING_DEFAULTS.address,
    label: "Office Address",
    description: "Physical address shown on contact page",
    input_type: "text",
    group_name: "location",
    sort_order: 1,
    is_public: true,
    updated_at: null,
  },
  {
    key: "founded_date",
    value: CONTACT_SETTING_DEFAULTS.founded_date,
    label: "Founded Date",
    description: "Founding date displayed publicly",
    input_type: "text",
    group_name: "location",
    sort_order: 2,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_sat",
    value: CONTACT_SETTING_DEFAULTS.hours_sat,
    label: "Saturday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 1,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_sun",
    value: CONTACT_SETTING_DEFAULTS.hours_sun,
    label: "Sunday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 2,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_mon",
    value: CONTACT_SETTING_DEFAULTS.hours_mon,
    label: "Monday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 3,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_tue",
    value: CONTACT_SETTING_DEFAULTS.hours_tue,
    label: "Tuesday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 4,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_wed",
    value: CONTACT_SETTING_DEFAULTS.hours_wed,
    label: "Wednesday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 5,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_thu",
    value: CONTACT_SETTING_DEFAULTS.hours_thu,
    label: "Thursday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 6,
    is_public: true,
    updated_at: null,
  },
  {
    key: "hours_fri",
    value: CONTACT_SETTING_DEFAULTS.hours_fri,
    label: "Friday Hours",
    description: null,
    input_type: "text",
    group_name: "hours",
    sort_order: 7,
    is_public: true,
    updated_at: null,
  },
];

const defaultRowByKey = new Map<ContactSettingKey, ContactSettingRow>(
  CONTACT_SETTING_DEFAULT_ROWS.map((row) => [row.key, row]),
);

const groupOrder = new Map<string, number>([
  ["email", 1],
  ["phone", 2],
  ["location", 3],
  ["hours", 4],
  ["general", 5],
]);

function isContactSettingKey(value: string): value is ContactSettingKey {
  return Object.prototype.hasOwnProperty.call(CONTACT_SETTING_DEFAULTS, value);
}

function asContactSettingRow(value: unknown): null | ContactSettingRow {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  if (!record) {
    return null;
  }

  const key = typeof record.key === "string" ? record.key : null;

  if (!key || !isContactSettingKey(key)) {
    return null;
  }

  const fallback = defaultRowByKey.get(key);

  if (!fallback) {
    return null;
  }

  return {
    ...fallback,
    value: typeof record.value === "string" ? record.value : fallback.value,
    label: typeof record.label === "string" ? record.label : fallback.label,
    description:
      typeof record.description === "string" || record.description === null
        ? record.description
        : fallback.description,
    input_type:
      record.input_type === "email" ||
      record.input_type === "tel" ||
      record.input_type === "text"
        ? record.input_type
        : fallback.input_type,
    group_name:
      record.group_name === "email" ||
      record.group_name === "general" ||
      record.group_name === "hours" ||
      record.group_name === "location" ||
      record.group_name === "phone"
        ? record.group_name
        : fallback.group_name,
    sort_order:
      typeof record.sort_order === "number" ? record.sort_order : fallback.sort_order,
    is_public:
      typeof record.is_public === "boolean" ? record.is_public : fallback.is_public,
    updated_at:
      typeof record.updated_at === "string" || record.updated_at === null
        ? record.updated_at
        : fallback.updated_at,
  };
}

function mergeWithDefaults(rows: ContactSettingRow[]) {
  const merged = new Map<ContactSettingKey, ContactSettingRow>(
    CONTACT_SETTING_DEFAULT_ROWS.map((row) => [row.key, row]),
  );

  for (const row of rows) {
    merged.set(row.key, row);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const groupCompare =
      (groupOrder.get(a.group_name) ?? 99) - (groupOrder.get(b.group_name) ?? 99);

    return groupCompare || a.sort_order - b.sort_order || a.label.localeCompare(b.label);
  });
}

function rowsToSettings(rows: ContactSettingRow[]): ContactSettings {
  return rows.reduce<ContactSettings>(
    (accumulator, row) => ({
      ...accumulator,
      [row.key]: row.value,
    }),
    { ...CONTACT_SETTING_DEFAULTS },
  );
}

export async function getContactSettingRows(options?: { includePrivate?: boolean }) {
  try {
    const supabase = asFlexibleClient(await createClient());
    let query = supabase
      .from("contact_settings" as string)
      .select(
        "key, value, label, description, input_type, group_name, sort_order, is_public, updated_at",
      )
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true });

    if (!options?.includePrivate) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    if (error || !Array.isArray(data)) {
      return CONTACT_SETTING_DEFAULT_ROWS;
    }

    return mergeWithDefaults(
      data
        .map((row) => asContactSettingRow(row))
        .filter((row): row is ContactSettingRow => Boolean(row)),
    );
  } catch {
    return CONTACT_SETTING_DEFAULT_ROWS;
  }
}

export async function getContactSettings(): Promise<ContactSettings> {
  return rowsToSettings(await getContactSettingRows());
}

export async function updateContactSetting(key: string, value: string): Promise<void> {
  if (!isContactSettingKey(key)) {
    throw new Error("Unknown contact setting.");
  }

  const auth = await requireAdminPermission("admin.settings.write", {
    fallbackPath: "/admin/settings/contact",
  });
  const fallback = defaultRowByKey.get(key);

  if (!fallback) {
    throw new Error("Unknown contact setting.");
  }

  const supabase = asFlexibleClient(await createClient());
  const { error } = await supabase
    .from("contact_settings" as string)
    .upsert({
      key,
      value,
      label: fallback.label,
      description: fallback.description,
      input_type: fallback.input_type,
      group_name: fallback.group_name,
      sort_order: fallback.sort_order,
      is_public: fallback.is_public,
      updated_at: new Date().toISOString(),
      updated_by: auth.user?.id ?? null,
    }, { onConflict: "key" });

  if (error) {
    throw new Error(error.message || "Unable to update contact setting.");
  }

  revalidatePath("/contact");
  revalidatePath("/admin/settings/contact");
}
