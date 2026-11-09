"use client";

/**
 * The customer journey.
 *
 *   rate → feedback (optional) → [recovery if ≤3] → choices → [editor?] → done
 *
 * Google review link is available on every step for every rating.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import type { PublicShopConfig } from "@/lib/settings";
import { MAX_FEEDBACK_LENGTH } from "@/lib/validation";
import { FEEDBACK_TOPIC_IDS, type FeedbackTopicId } from "@/lib/feedback-topics";
import { RatingStars } from "./rating-stars";
import { CharacterCounter } from "./character-counter";
import { GoogleReviewLink } from "./google-review-link";
import { ShopHeader } from "./shop-header";
import { Button } from "@/components/shared/button";
import { InlineMessage, LiveAnnouncer } from "@/components/shared/inline-message";
import { PrivacyDisclosure } from "./privacy-disclosure";
import { TopicChips } from "./topic-chips";
import { LanguageSwitcher } from "./language-switcher";
import { LocaleProvider, useLocale } from "./locale-provider";
import { sendAnalyticsEvent } from "./analytics-client";

type Step = "rate" | "feedback" | "recovery" | "choices" | "editor" | "done";

const STORAGE_KEY = "qrfb:draft:v2";

type Draft = {
  step: Step;
  rating: number | null;
  feedbackText: string;
  selectedTopics: FeedbackTopicId[];
  reviewText: string;
  reference: string | null;
  followUpDone: boolean;
};

const EMPTY_DRAFT: Draft = {
  step: "rate",
  rating: null,
  feedbackText: "",
  selectedTopics: [],
  reviewText: "",
  reference: null,
  followUpDone: false,
};

const STEPS: Step[] = ["rate", "feedback", "recovery", "choices", "editor", "done"];

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_DRAFT;
    const candidate = parsed as Partial<Draft>;

    const rating =
      typeof candidate.rating === "number" &&
      Number.isInteger(candidate.rating) &&
      candidate.rating >= 1 &&
      candidate.rating <= 5
        ? candidate.rating
        : null;

    const reviewText =
      typeof candidate.reviewText === "string" ? candidate.reviewText.slice(0, 4000) : "";

    const feedbackText =
      typeof candidate.feedbackText === "string"
        ? candidate.feedbackText.slice(0, MAX_FEEDBACK_LENGTH + 200)
        : "";

    const selectedTopics = Array.isArray(candidate.selectedTopics)
      ? candidate.selectedTopics.filter(
          (topic): topic is FeedbackTopicId =>
            typeof topic === "string" &&
            (FEEDBACK_TOPIC_IDS as readonly string[]).includes(topic),
        )
      : [];

    const reference =
      typeof candidate.reference === "string" && candidate.reference.length > 0
        ? candidate.reference
        : null;

    const followUpDone = candidate.followUpDone === true;

    let step: Step = "rate";
    const claimed =
      typeof candidate.step === "string" && STEPS.includes(candidate.step as Step)
        ? (candidate.step as Step)
        : null;

    if (claimed === "done" && (reference || rating !== null)) step = "done";
    else if (reviewText.trim()) step = claimed === "done" ? "done" : "editor";
    else if (claimed === "choices" && rating !== null) step = "choices";
    else if (claimed === "recovery" && rating !== null && rating <= 3) step = "recovery";
    else if (claimed === "feedback" && rating !== null) step = "feedback";
    else if (claimed === "editor" && reviewText.trim()) step = "editor";
    else if (rating !== null) step = "feedback";

    return {
      step,
      rating,
      feedbackText,
      selectedTopics,
      reviewText,
      reference,
      followUpDone,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode with storage disabled: nothing to do.
  }
}

type Props = { shop: PublicShopConfig };

export function FeedbackFlow({ shop }: Props) {
  return (
    <LocaleProvider>
      <FeedbackFlowInner shop={shop} />
    </LocaleProvider>
  );
}

function FeedbackFlowInner({ shop }: Props) {
  const { locale, messages } = useLocale();

  const [step, setStep] = useState<Step>("rate");
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<FeedbackTopicId[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [followUpDone, setFollowUpDone] = useState(false);

  const [phone, setPhone] = useState("");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySaving, setRecoverySaving] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [refCopyState, setRefCopyState] = useState<"idle" | "copied">("idle");
  const [announcement, setAnnouncement] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  const stepRef = useRef<Step>("rate");
  const draftSaved = useRef(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFeedbackOnEnter = useRef(false);
  const feedbackHeading = useRef<HTMLHeadingElement | null>(null);
  const focusEditorOnEnter = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement | null>(null);
  const focusDoneOnEnter = useRef(false);
  const doneHeading = useRef<HTMLHeadingElement | null>(null);
  const historyDepth = useRef(0);

  const welcomeTitle =
    locale === "en" ? shop.welcomeTitle : messages.welcomeTitleFallback;
  const welcomeMessage =
    locale === "en" ? shop.welcomeMessage : messages.welcomeMessageFallback;

  useEffect(() => {
    const restored = loadDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(restored.step);
    stepRef.current = restored.step;
    setRating(restored.rating);
    setFeedbackText(restored.feedbackText);
    setSelectedTopics(restored.selectedTopics);
    setReviewText(restored.reviewText);
    setReference(restored.reference);
    setFollowUpDone(restored.followUpDone);
    if (restored.reference) draftSaved.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      if (
        !rating &&
        !feedbackText &&
        selectedTopics.length === 0 &&
        !reviewText &&
        !reference
      ) {
        clearDraft();
        return;
      }
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            step,
            rating,
            feedbackText,
            selectedTopics,
            reviewText,
            reference,
            followUpDone,
          } satisfies Draft),
        );
      } catch {
        // Quota or disabled storage.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    step,
    rating,
    feedbackText,
    selectedTopics,
    reviewText,
    reference,
    followUpDone,
  ]);

  const pushStep = useCallback((next: Step) => {
    setStep(next);
    stepRef.current = next;
    try {
      window.history.pushState({ step: next }, "");
      historyDepth.current += 1;
    } catch {
      // Embedded WebViews may refuse pushState.
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      if (historyDepth.current > 0) historyDepth.current -= 1;
      setStep((current) => {
        const order: Step[] = ["rate", "feedback", "recovery", "choices", "editor", "done"];
        const idx = order.indexOf(current);
        let next: Step = "rate";
        if (idx > 0) {
          next = order[idx - 1]!;
          // Skip recovery when going back if rating is high.
          if (next === "recovery" && (rating === null || rating > 3)) {
            next = "feedback";
          }
          if (next === "editor" && !reviewText.trim()) {
            next = "choices";
          }
        }
        stepRef.current = next;
        return next;
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [rating, reviewText]);

  useEffect(() => {
    if (!hydrated) return;
    void sendAnalyticsEvent("page_opened");
  }, [hydrated]);

  function handleRating(next: number) {
    setRating(next);
    void sendAnalyticsEvent("rating_selected");
  }

  function handleStarCommit() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    focusFeedbackOnEnter.current = true;
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (stepRef.current === "rate") pushStep("feedback");
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (step === "feedback" && focusFeedbackOnEnter.current) {
      focusFeedbackOnEnter.current = false;
      feedbackHeading.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (step === "editor" && focusEditorOnEnter.current) {
      focusEditorOnEnter.current = false;
      editorHeading.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (step === "done" && focusDoneOnEnter.current) {
      focusDoneOnEnter.current = false;
      doneHeading.current?.focus();
    }
  }, [step]);

  function toggleTopic(topic: FeedbackTopicId) {
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((t) => t !== topic) : [...current, topic],
    );
    if (generateError) setGenerateError(null);
  }

  const hasAiSignal = useMemo(() => {
    return selectedTopics.length > 0 || feedbackText.trim().length >= 5;
  }, [selectedTopics, feedbackText]);

  const persistFeedback = useCallback(
    async (opts?: {
      followUpConsent?: boolean;
      contactPhone?: string;
    }): Promise<string | null> => {
      if (rating === null) return reference;
      if (draftSaved.current && reference && !opts?.followUpConsent) return reference;

      // Claim the slot before awaiting so overlapping Continue/Finish taps
      // cannot create duplicate rows.
      draftSaved.current = true;
      setSavingFeedback(true);
      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rating,
            feedbackText: feedbackText.trim(),
            topics: selectedTopics,
            consentNoticeVersion: shop.privacyNoticeVersion,
            followUpConsent: opts?.followUpConsent ?? false,
            contactPhone: opts?.contactPhone,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          reference?: string;
          error?: { message?: string };
        } | null;

        if (!response.ok) {
          draftSaved.current = false;
          return null;
        }

        const ref = payload?.reference ?? null;
        if (ref) {
          setReference(ref);
          return ref;
        }
        draftSaved.current = false;
        return null;
      } catch {
        draftSaved.current = false;
        return null;
      } finally {
        setSavingFeedback(false);
      }
    },
    [rating, feedbackText, selectedTopics, shop.privacyNoticeVersion, reference],
  );

  async function leaveFeedbackStep(_mode: "skip" | "continue") {
    if (rating === null) return;
    // Defer save for low ratings until recovery is answered so phone+consent
    // can travel with the same row.
    if (rating <= 3 && !followUpDone) {
      pushStep("recovery");
      return;
    }
    if (!draftSaved.current) await persistFeedback();
    pushStep("choices");
  }

  async function submitRecovery() {
    setRecoveryError(null);
    if (!followUpConsent) {
      setRecoveryError(messages.errorConsentRequired);
      return;
    }
    if (!phone.trim()) {
      setRecoveryError(messages.errorPhoneRequired);
      return;
    }

    setRecoverySaving(true);
    const ref = await persistFeedback({
      followUpConsent: true,
      contactPhone: phone.trim(),
    });
    setRecoverySaving(false);

    if (!ref) {
      setRecoveryError(messages.errorGeneric);
      return;
    }
    setFollowUpDone(true);
    setAnnouncement(messages.recoverySubmitted);
    pushStep("choices");
  }

  async function skipRecovery() {
    setFollowUpDone(true);
    if (!draftSaved.current) await persistFeedback();
    pushStep("choices");
  }

  async function generateReview() {
    if (rating === null || !hasAiSignal) {
      setGenerateError(messages.aiNeedsDetail);
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    if (!draftSaved.current) void persistFeedback();

    try {
      const response = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          feedbackText: feedbackText.trim(),
          topics: selectedTopics,
          locale,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        reviewText?: string;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.reviewText) {
        void sendAnalyticsEvent("ai_generation_failed");
        setGenerateError(payload?.error?.message ?? messages.errorGenerate);
        return;
      }

      void sendAnalyticsEvent("ai_generation_succeeded");
      setReviewText(payload.reviewText);
      focusEditorOnEnter.current = true;
      pushStep("editor");
    } catch {
      void sendAnalyticsEvent("ai_generation_failed");
      setGenerateError(messages.errorGenerate);
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    if (rating === null || !hasAiSignal) return;
    setGenerating(true);
    setEditorError(null);
    try {
      const response = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          feedbackText: feedbackText.trim(),
          topics: selectedTopics,
          locale,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        reviewText?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.reviewText) {
        setEditorError(payload?.error?.message ?? messages.errorGenerate);
        return;
      }
      setReviewText(payload.reviewText);
      setAnnouncement(messages.reviewReady);
    } catch {
      setEditorError(messages.errorGenerate);
    } finally {
      setGenerating(false);
    }
  }

  async function copyAndOpenGoogle() {
    void sendAnalyticsEvent("google_review_clicked");
    window.open(shop.googleReviewUrl, "_blank", "noopener,noreferrer");

    try {
      await navigator.clipboard.writeText(reviewText);
      void sendAnalyticsEvent("review_copied");
      setCopyState("copied");
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
      focusDoneOnEnter.current = true;
      pushStep("done");
    } catch {
      setCopyState("manual");
    }
  }

  async function finishWithoutReview() {
    if (!draftSaved.current) await persistFeedback();
    focusDoneOnEnter.current = true;
    pushStep("done");
  }

  async function copyReference() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setRefCopyState("copied");
      setTimeout(() => setRefCopyState("idle"), 2000);
    } catch {
      // Manual select remains available.
    }
  }

  const ratingSummaryId = "rating-summary";
  const showCompactHeader = step !== "rate";

  return (
    <div
      data-hydrated={hydrated ? "true" : "false"}
      className="mx-auto flex min-h-screen-safe w-full max-w-lg flex-col px-5 pb-safe-lg pt-4"
    >
      <div className="step-item mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ShopHeader
            shop={shop}
            size={showCompactHeader ? "compact" : "default"}
            rating={showCompactHeader ? rating : null}
          />
        </div>
        <LanguageSwitcher />
      </div>

      <LiveAnnouncer message={announcement} />

      {step === "rate" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="welcome-title">
          <div className="step-item mt-6">
            <h1
              id="welcome-title"
              className="text-center text-[length:var(--text-hero)] font-semibold tracking-tight text-pretty"
            >
              {welcomeTitle}
            </h1>
            <p className="mt-2 text-center text-[color:var(--text-muted)] text-pretty">
              {welcomeMessage}
            </p>
          </div>

          <div className="step-item mt-8">
            <p className="mb-3 text-center text-sm font-medium text-[color:var(--text)]">
              {messages.ratingPrompt}
            </p>
            <RatingStars
              value={rating}
              onChange={handleRating}
              onCommit={handleStarCommit}
              describedBy={ratingSummaryId}
              messages={messages}
            />
            <p id={ratingSummaryId} className="sr-only" aria-live="polite">
              {rating !== null
                ? messages.ratingSelected(
                    rating,
                    messages.starMeanings[rating as 1 | 2 | 3 | 4 | 5],
                  )
                : ""}
            </p>
          </div>

          <div className="step-item mt-auto flex flex-col items-center gap-3 pt-10">
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              onNavigate={() => void sendAnalyticsEvent("google_review_clicked")}
            />
            <a
              href="/privacy"
              className="pressable text-xs font-medium text-[color:var(--text-muted)] underline underline-offset-2"
            >
              {messages.privacyLink}
            </a>
          </div>
        </section>
      ) : null}

      {step === "feedback" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="improve-heading">
          <h2
            id="improve-heading"
            ref={feedbackHeading}
            tabIndex={-1}
            className="step-item mt-4 text-xl font-semibold tracking-tight outline-none"
          >
            {messages.improveHeading}
          </h2>
          <p className="step-item mt-1 text-sm text-[color:var(--text-muted)]">
            {messages.improveHint}
          </p>

          <div className="step-item mt-5">
            <TopicChips
              selected={selectedTopics}
              onToggle={toggleTopic}
              messages={messages}
            />
          </div>

          <div className="step-item mt-5">
            <label
              htmlFor="feedback-more"
              className="mb-1.5 block text-sm font-medium text-[color:var(--text)]"
            >
              {messages.tellUsMore}{" "}
              <span className="font-normal text-[color:var(--text-muted)]">
                ({messages.optional})
              </span>
            </label>
            <textarea
              id="feedback-more"
              className="field min-h-28 w-full resize-y"
              value={feedbackText}
              maxLength={MAX_FEEDBACK_LENGTH + 50}
              placeholder={messages.tellUsMorePlaceholder}
              onChange={(event) => setFeedbackText(event.target.value)}
            />
            <div className="mt-1.5 flex justify-end">
              <CharacterCounter length={feedbackText.trim().length} max={MAX_FEEDBACK_LENGTH} />
            </div>
          </div>

          {generateError ? (
            <div className="step-item mt-3">
              <InlineMessage tone="error" className="msg-fade">
                {generateError}
              </InlineMessage>
            </div>
          ) : null}

          <div className="step-item mt-6 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => void leaveFeedbackStep("continue")}
              disabled={savingFeedback}
            >
              {messages.continue}
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => void leaveFeedbackStep("skip")}
            >
              {messages.skip}
            </Button>
          </div>

          <div className="step-item mt-6">
            <PrivacyDisclosure
              shopName={shop.name}
              label={messages.privacyShort(shop.name)}
            />
          </div>
          <div className="step-item mt-4 flex justify-center pb-2">
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              onNavigate={() => void sendAnalyticsEvent("google_review_clicked")}
            />
          </div>
        </section>
      ) : null}

      {step === "recovery" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="recovery-heading">
          <h2
            id="recovery-heading"
            className="step-item mt-4 text-xl font-semibold tracking-tight"
          >
            {messages.recoveryHeading}
          </h2>
          <p className="step-item mt-2 text-sm text-[color:var(--text-muted)] text-pretty">
            {messages.recoveryBody}
          </p>

          <div className="step-item mt-5">
            <label
              htmlFor="recovery-phone"
              className="mb-1.5 block text-sm font-medium"
            >
              {messages.recoveryPhoneLabel}
            </label>
            <input
              id="recovery-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="field w-full"
              placeholder={messages.recoveryPhonePlaceholder}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <label className="step-item mt-4 flex items-start gap-3 text-sm leading-snug">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-[color:var(--brand)]"
              checked={followUpConsent}
              onChange={(event) => setFollowUpConsent(event.target.checked)}
            />
            <span>{messages.recoveryConsent}</span>
          </label>

          {recoveryError ? (
            <div className="step-item mt-3">
              <InlineMessage tone="error" className="msg-fade">
                {recoveryError}
              </InlineMessage>
            </div>
          ) : null}

          <div className="step-item mt-6 flex flex-col gap-2">
            <Button
              type="button"
              loading={recoverySaving}
              onClick={() => void submitRecovery()}
            >
              {messages.recoverySubmit}
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => void skipRecovery()}
            >
              {messages.recoverySkip}
            </Button>
          </div>

          <div className="step-item mt-6 flex justify-center">
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              onNavigate={() => void sendAnalyticsEvent("google_review_clicked")}
            />
          </div>
        </section>
      ) : null}

      {step === "choices" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="choices-heading">
          <h2
            id="choices-heading"
            className="step-item mt-4 text-xl font-semibold tracking-tight"
          >
            {messages.choicesHeading}
          </h2>
          <p className="step-item mt-2 text-sm text-[color:var(--text-muted)] text-pretty">
            {messages.choicesHint}
          </p>

          <div className="step-item mt-6 flex flex-col gap-3">
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              variant="block"
              onNavigate={() => {
                void sendAnalyticsEvent("google_review_clicked");
                void (async () => {
                  if (!draftSaved.current) await persistFeedback();
                  focusDoneOnEnter.current = true;
                  pushStep("done");
                })();
              }}
            />
            <Button
              type="button"
              variant="quiet"
              loading={generating}
              aria-disabled={!hasAiSignal || undefined}
              className={!hasAiSignal ? "opacity-60" : ""}
              onClick={() => {
                if (!hasAiSignal) return;
                void generateReview();
              }}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              {messages.helpWriteReview}
            </Button>
            {!hasAiSignal ? (
              <p className="text-center text-xs text-[color:var(--text-muted)]">
                {messages.aiNeedsDetail}
              </p>
            ) : null}
            <Button
              type="button"
              variant="quiet"
              onClick={() => void finishWithoutReview()}
            >
              {messages.finishWithoutReview}
            </Button>
          </div>

          {generateError ? (
            <div className="step-item mt-4">
              <InlineMessage tone="error" className="msg-fade">
                {generateError}
              </InlineMessage>
            </div>
          ) : null}

          <div className="step-item mt-8">
            <PrivacyDisclosure
              shopName={shop.name}
              label={messages.privacyShort(shop.name)}
            />
          </div>
        </section>
      ) : null}

      {step === "editor" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="editor-heading">
          <h2
            id="editor-heading"
            ref={editorHeading}
            tabIndex={-1}
            className="sr-only outline-none"
          >
            {messages.reviewReady}
          </h2>

          <div className="step-item relative mt-4">
            <textarea
              className="field min-h-40 w-full resize-y"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              aria-label={messages.reviewReady}
            />
            {generating ? (
              <div className="ai-overlay absolute inset-0 flex items-center justify-center rounded-[var(--radius-control)] bg-white/70 backdrop-blur-[2px]">
                <span className="loading-dots" aria-hidden="true" />
                <span className="sr-only">{messages.generating}</span>
              </div>
            ) : null}
          </div>

          <div className="step-item mt-3 flex justify-end">
            <button
              type="button"
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[color:var(--brand-ink)]"
              onClick={() => void regenerate()}
              disabled={generating || !hasAiSignal}
            >
              {generating ? (
                <Loader2 aria-hidden="true" className="spinner size-4" />
              ) : (
                <Sparkles aria-hidden="true" className="size-4" />
              )}
              {generating ? messages.rewriting : messages.rewrite}
            </button>
          </div>

          {editorError ? (
            <div className="step-item mt-2">
              <InlineMessage tone="error" className="msg-fade">
                {editorError}
              </InlineMessage>
            </div>
          ) : null}

          {copyState === "manual" ? (
            <div className="step-item mt-2">
              <InlineMessage tone="error" className="msg-fade">
                {messages.clipboardFallback}
              </InlineMessage>
            </div>
          ) : null}

          {copyState === "copied" ? (
            <div className="step-item mt-2">
              <InlineMessage tone="success" className="msg-pop">
                {messages.copySuccess}
              </InlineMessage>
            </div>
          ) : null}

          <div className="step-item mt-6 flex flex-col gap-2">
            <Button
              type="button"
              variant={copyState === "copied" ? "success" : "primary"}
              onClick={() => void copyAndOpenGoogle()}
            >
              {copyState === "copied" ? (
                <>
                  <Check aria-hidden="true" className="size-4" />
                  {messages.copied}
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="size-4" />
                  {messages.copyOpenGoogle}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                focusDoneOnEnter.current = true;
                pushStep("done");
              }}
            >
              {messages.finishWithoutReview}
            </Button>
          </div>

          <div className="step-item mt-6 flex justify-center">
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              onNavigate={() => void sendAnalyticsEvent("google_review_clicked")}
            />
          </div>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="step-enter flex flex-1 flex-col" aria-labelledby="thanks-heading">
          <h2
            id="thanks-heading"
            ref={doneHeading}
            tabIndex={-1}
            className="step-item mt-6 text-center text-[length:var(--text-hero)] font-semibold tracking-tight outline-none"
          >
            {messages.thankYouTitle}
          </h2>
          <p className="step-item mt-3 text-center text-[color:var(--text-muted)] text-pretty">
            {messages.thankYouBody(shop.name)}
          </p>

          <div className="step-item mt-8 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <h3 className="text-sm font-semibold">{messages.whatHappensNext}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text-muted)] text-pretty">
              {messages.whatHappensNextBody}
            </p>
          </div>

          {reference ? (
            <div className="step-item mt-4 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <p className="text-xs font-medium text-[color:var(--text-muted)]">
                {messages.yourReference}
              </p>
              <p className="mt-1 break-all font-mono text-sm">{reference}</p>
              <button
                type="button"
                className="pressable mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[color:var(--brand-ink)]"
                onClick={() => void copyReference()}
              >
                {refCopyState === "copied" ? (
                  <>
                    <Check aria-hidden="true" className="size-3.5" />
                    {messages.referenceCopied}
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="size-3.5" />
                    {messages.copyReference}
                  </>
                )}
              </button>
            </div>
          ) : null}

          <div className="step-item mt-8 flex flex-col items-center gap-3">
            <p className="text-center text-sm text-[color:var(--text-muted)]">
              {messages.doneGoogleStillAvailable}
            </p>
            <GoogleReviewLink
              href={shop.googleReviewUrl}
              label={messages.leaveGoogleReview}
              variant="block"
              onNavigate={() => void sendAnalyticsEvent("google_review_clicked")}
            />
            <a
              href="/privacy"
              className="pressable text-xs font-medium text-[color:var(--text-muted)] underline underline-offset-2"
            >
              {messages.privacyLink}
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
