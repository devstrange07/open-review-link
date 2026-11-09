import { describe, expect, it } from "vitest";
import { FEEDBACK_TOPIC_IDS } from "@/lib/feedback-topics";
import { LOCALES, getMessages } from "@/lib/i18n";
import { getPrivacyCopy } from "@/lib/i18n/privacy";

describe("i18n catalogs", () => {
  it("exposes the same topic keys in every locale", () => {
    for (const locale of LOCALES) {
      const topics = getMessages(locale).topics;
      for (const id of FEEDBACK_TOPIC_IDS) {
        expect(topics[id]?.length).toBeGreaterThan(0);
      }
    }
  });

  it("exposes star meanings 1–5 in every locale", () => {
    for (const locale of LOCALES) {
      const meanings = getMessages(locale).starMeanings;
      for (const n of [1, 2, 3, 4, 5] as const) {
        expect(meanings[n]?.length).toBeGreaterThan(0);
      }
    }
  });

  it("has privacy copy for every locale", () => {
    for (const locale of LOCALES) {
      const copy = getPrivacyCopy(locale);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.sections.length).toBeGreaterThan(5);
    }
  });
});
