"use client";

import { LOCALES } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";
import { useLocale } from "./locale-provider";

/**
 * Compact locale control for the top corner of the customer journey.
 * English / Hindi / Gujarati — changes the whole journey copy, not just labels.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, messages } = useLocale();

  return (
    <div className="flex items-center justify-end gap-1">
      <label htmlFor="locale-select" className="sr-only">
        {messages.languageSwitcherLabel}
      </label>
      <select
        id="locale-select"
        value={locale}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        className="pressable rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1.5 text-[0.8125rem] font-medium text-[color:var(--text)]"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {getMessages(code).localeName}
          </option>
        ))}
      </select>
    </div>
  );
}
