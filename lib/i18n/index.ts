import { en } from "@/lib/i18n/messages/en";
import { hi } from "@/lib/i18n/messages/hi";
import { gu } from "@/lib/i18n/messages/gu";
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type Messages,
} from "@/lib/i18n/types";

export { DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/i18n/types";
export type { Locale, Messages, StarMeaning } from "@/lib/i18n/types";

const CATALOG: Record<Locale, Messages> = { en, hi, gu };

export const LOCALE_STORAGE_KEY = "qrfb:locale";

export function getMessages(locale: Locale): Messages {
  return CATALOG[locale] ?? CATALOG[DEFAULT_LOCALE];
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Language names for the AI prompt system instruction. */
export function localeLanguageName(locale: Locale): string {
  switch (locale) {
    case "hi":
      return "Hindi";
    case "gu":
      return "Gujarati";
    default:
      return "English";
  }
}
