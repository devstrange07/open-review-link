import type { FeedbackTopicId } from "@/lib/feedback-topics";

export const LOCALES = ["en", "hi", "gu"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type StarMeaning = 1 | 2 | 3 | 4 | 5;

export type Messages = {
  localeName: string;
  languageSwitcherLabel: string;
  ratingPrompt: string;
  ratingSelected: (n: number, label: string) => string;
  starMeanings: Record<StarMeaning, string>;
  starAriaLabel: (n: number, label: string) => string;
  privacyLink: string;
  privacyShort: (shopName: string) => string;
  improveHeading: string;
  improveHint: string;
  tellUsMore: string;
  tellUsMorePlaceholder: string;
  topics: Record<FeedbackTopicId, string>;
  skip: string;
  continue: string;
  choicesHeading: string;
  choicesHint: string;
  leaveGoogleReview: string;
  helpWriteReview: string;
  finishWithoutReview: string;
  aiNeedsDetail: string;
  reviewReady: string;
  rewrite: string;
  rewriting: string;
  copyOpenGoogle: string;
  copied: string;
  copySuccess: string;
  clipboardFallback: string;
  generating: string;
  thankYouTitle: string;
  thankYouBody: (shopName: string) => string;
  whatHappensNext: string;
  whatHappensNextBody: string;
  yourReference: string;
  copyReference: string;
  referenceCopied: string;
  recoveryHeading: string;
  recoveryBody: string;
  recoveryPhoneLabel: string;
  recoveryPhonePlaceholder: string;
  recoveryConsent: string;
  recoverySubmit: string;
  recoverySubmitted: string;
  recoverySkip: string;
  doneGoogleStillAvailable: string;
  errorGeneric: string;
  errorGenerate: string;
  errorPrivacyUpdated: string;
  errorPhoneRequired: string;
  errorPhoneInvalid: string;
  errorConsentRequired: string;
  welcomeTitleFallback: string;
  welcomeMessageFallback: string;
  characterCounter: (current: number, max: number) => string;
  optional: string;
  googleReviewAria: string;
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
