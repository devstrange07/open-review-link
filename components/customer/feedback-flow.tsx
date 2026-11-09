"use client";

/**
 * The customer journey.
 *
 * Three steps in one component rather than three routes, because:
 *   - the state (rating, text, draft) must survive moving between them;
 *   - a route change on a flaky connection would refetch the whole page;
 *   - the back gesture still needs to work, which we get from pushState.
 *
 * Shape of the state machine:
 *
 *   rate ──continue──▶ describe ──generate──▶ editor ──copy──▶ Google
 *    │                    │                    │
 *    └── Google link ─────┴────────────────────┘   (always available)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, Sparkles, Loader2 } from "lucide-react";
import type { PublicShopConfig } from "@/lib/settings";
import { MAX_FEEDBACK_LENGTH, MIN_FEEDBACK_LENGTH } from "@/lib/validation";
import { buildCombinedFeedback, startersForRating } from "@/lib/feedback-starters";
import { RatingStars } from "./rating-stars";
import { CharacterCounter } from "./character-counter";
import { GoogleReviewLink } from "./google-review-link";
import { ShopHeader } from "./shop-header";
import { Button } from "@/components/shared/button";
import { InlineMessage, LiveAnnouncer } from "@/components/shared/inline-message";
import { PrivacyDisclosure } from "./privacy-disclosure";
import { QuickFillChips } from "./quick-fill-chips";
import { sendAnalyticsEvent } from "./analytics-client";

type Step = "rate" | "describe" | "editor";

const STORAGE_KEY = "qrfb:draft:v1";

type Draft = {
  step: Step;
  rating: number | null;
  feedbackText: string;
  selectedChips: string[];
  reviewText: string;
};

const EMPTY_DRAFT: Draft = {
  step: "rate",
  rating: null,
  feedbackText: "",
  selectedChips: [],
  reviewText: "",
};

/**
 * Restore a draft from sessionStorage.
 *
 * sessionStorage (not localStorage): the data should die with the tab. Someone
 * leaving a review in a shop does not expect it to reappear a week later on
 * their phone.
 */
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

    // Chips are validated against the ratings tier below, after `rating` is
    // known, so a stale draft can't resurrect a phrase that no longer exists.
    const selectedChips = Array.isArray(candidate.selectedChips)
      ? candidate.selectedChips.filter((chip): chip is string => typeof chip === "string")
      : [];

    // Only restore a step the data can actually support. A draft that claims
    // "editor" with no review text would render an empty screen.
    let step: Step = "rate";
    if (reviewText.trim()) step = "editor";
    else if (rating !== null) step = "describe";
    if (candidate.step === "describe" && rating === null) step = "rate";

    return {
      step,
      rating,
      feedbackText,
      selectedChips,
      reviewText,
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
  const [step, setStep] = useState<Step>("rate");
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [announcement, setAnnouncement] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Refs used to keep callbacks stable without re-subscribing popstate.
  const stepRef = useRef<Step>("rate");
  const draftSaved = useRef(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The brief pause after a star tap so the pop is seen before the step swaps.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only steal focus into the describe step when the customer got there by
  // tapping a star — not on a draft restore, which would yank focus on load.
  const focusDescribeOnEnter = useRef(false);
  const describeHeading = useRef<HTMLHeadingElement | null>(null);
  // Same contract for the editor: the screen carries no visible heading, so
  // focus has to be moved deliberately or it lands on <body> when the describe
  // section unmounts.
  const focusEditorOnEnter = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Draft persistence                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const restored = loadDraft();
    // Restoring persisted state after mount is the one legitimate exception to
    // this rule: sessionStorage does not exist during SSR, so reading it in a
    // lazy initializer would produce a hydration mismatch between the server's
    // "rate" step and the client's restored one. The extra render happens once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(restored.step);
    stepRef.current = restored.step;
    setRating(restored.rating);
    setFeedbackText(restored.feedbackText);
    // Drop any restored chip that is not part of the tier its rating now maps
    // to, so a stale label can never linger after the phrase list changes.
    const validStarters = startersForRating(restored.rating);
    setSelectedChips(
      restored.selectedChips.filter((chip) => validStarters.includes(chip)),
    );
    setReviewText(restored.reviewText);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Debounced so typing doesn't hit storage on every keystroke.
    const timer = setTimeout(() => {
      if (!rating && !feedbackText && selectedChips.length === 0 && !reviewText) {
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
            selectedChips,
            reviewText,
          } satisfies Draft),
        );
      } catch {
        // Quota or disabled storage: the flow still works, just not resiliently.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hydrated, step, rating, feedbackText, selectedChips, reviewText]);

  /* ---------------------------------------------------------------------- */
  /* Back-button support                                                     */
  /*                                                                         */
  /* Each step is a history entry, so the Android back gesture (and browser   */
  /* back button) walks backwards through the flow instead of leaving the     */
  /* page and discarding what the customer typed.                            */
  /*                                                                         */
  /* `historyDepth` matters: a customer who reloads while on the editor has   */
  /* a restored draft but NO history entries of ours. Calling history.back()  */
  /* there would leave the site entirely and lose their text, so we fall back */
  /* to setting the step directly.                                           */
  /* ---------------------------------------------------------------------- */

  const historyDepth = useRef(0);

  const pushStep = useCallback((next: Step) => {
    setStep(next);
    stepRef.current = next;
    try {
      window.history.pushState({ step: next }, "");
      historyDepth.current += 1;
    } catch {
      // Some embedded WebViews refuse pushState. Stepping still works; the
      // browser's Back gesture then leaves the page instead of walking back a
      // step, which is the best available behaviour there.
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      // Any back navigation returns to an earlier step; the exact step is
      // derived from what data exists rather than from the URL, since the URL
      // never changes.
      if (historyDepth.current > 0) historyDepth.current -= 1;
      setStep((current) => {
        const next =
          current === "editor" ? "describe" : current === "describe" ? "rate" : "rate";
        stepRef.current = next;
        return next;
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Step 1 — rating                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!hydrated) return;
    void sendAnalyticsEvent("page_opened");
  }, [hydrated]);

  function handleRating(next: number) {
    setRating(next);
    // The chip set is rating-tailored. If the new rating lands in a different
    // tier, drop any selected chip that no longer belongs there rather than
    // silently keeping a phrase the customer can no longer see.
    const nextStarters = startersForRating(next);
    setSelectedChips((current) => current.filter((chip) => nextStarters.includes(chip)));
    void sendAnalyticsEvent("rating_selected");
  }

  function toggleChip(phrase: string) {
    setSelectedChips((current) =>
      current.includes(phrase)
        ? current.filter((chip) => chip !== phrase)
        : [...current, phrase],
    );
    if (generateError) setGenerateError(null);
  }

  /**
   * A star was picked. This is the customer's decision, so it both moves them on
   * and arms the describe step to take focus. The tiny delay lets the star pop
   * land first; a second pick (or an unmount) cancels the pending advance so two
   * taps can never stack timers or push two history entries.
   */
  function handleStarCommit() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    focusDescribeOnEnter.current = true;
    // The `aria-live` paragraph under the stars already reads the selection out,
    // so the separate announcer stays quiet here to avoid saying it twice.
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (stepRef.current === "rate") pushStep("describe");
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // When the describe step arrives from a star tap, move focus to its heading so
  // keyboard and screen-reader users land on the new content instead of being
  // left on a control that no longer exists.
  useEffect(() => {
    if (step === "describe" && focusDescribeOnEnter.current) {
      focusDescribeOnEnter.current = false;
      describeHeading.current?.focus();
    }
  }, [step]);

  // Mirror of the rule above for the editor, which is entered only after a
  // successful generate or a draft restore. A restore must not steal focus on
  // load, so the flag is armed by generate() alone.
  useEffect(() => {
    if (step === "editor" && focusEditorOnEnter.current) {
      focusEditorOnEnter.current = false;
      editorHeading.current?.focus();
    }
  }, [step]);

  // The editor entrance is a one-shot: it is only armed by a successful
  // generate, and the editor section remounts each time it is entered, so no
  // reset is needed here.

  /* ---------------------------------------------------------------------- */
  /* Step 2 — describe + generate                                            */
  /* ---------------------------------------------------------------------- */

  const combinedFeedback = buildCombinedFeedback(selectedChips, feedbackText).trim();
  const combinedLength = combinedFeedback.length;
  const canGenerate =
    rating !== null &&
    combinedLength >= MIN_FEEDBACK_LENGTH &&
    combinedLength <= MAX_FEEDBACK_LENGTH;

  /**
   * Persist the customer's feedback, then generate.
   *
   * Sharing is implicit: asking for a review is the decision to share. Order
   * still matters — we save first so a provider outage never costs the shop the
   * feedback the customer just wrote. The save is awaited briefly but a failure
   * never blocks generation.
   */
  const persistFeedback = useCallback(async () => {
    if (rating === null || draftSaved.current) return;
    const text = combinedFeedback.trim();
    if (!text) return;
    draftSaved.current = true;

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          feedbackText: text,
          consentNoticeVersion: shop.privacyNoticeVersion,
        }),
      });

      if (!response.ok) {
        // Allow a retry on the next generate press: this was not a success.
        draftSaved.current = false;
      }
    } catch {
      draftSaved.current = false;
    }
  }, [rating, combinedFeedback, shop.privacyNoticeVersion]);

  const generate = useCallback(async () => {
    if (!canGenerate || rating === null || generating) return;

    setGenerating(true);
    setGenerateError(null);
    setEditorError(null);

    void persistFeedback();

    try {
      const response = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, feedbackText: combinedFeedback }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const parsed = payload as
        | { success: true; reviewText: string }
        | { success: false; error: { code: string; message: string } }
        | null;

      if (!response.ok || !parsed || parsed.success !== true) {
        const message =
          parsed && parsed.success === false
            ? parsed.error.message
            : "Review generation is temporarily unavailable.";

        void sendAnalyticsEvent("ai_generation_failed");
        setGenerateError(message);
        return;
      }

      setReviewText(parsed.reviewText);
      void sendAnalyticsEvent("ai_generation_succeeded");
      focusEditorOnEnter.current = true;
      pushStep("editor");
    } catch {
      void sendAnalyticsEvent("ai_generation_failed");
      setGenerateError(
        "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, rating, combinedFeedback, generating, persistFeedback, pushStep]);

  /* ---------------------------------------------------------------------- */
  /* Step 3 — editor                                                         */
  /* ---------------------------------------------------------------------- */

  const regenerate = useCallback(async () => {
    if (rating === null || generating) return;
    setGenerating(true);
    setEditorError(null);

    try {
      const response = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, feedbackText: combinedFeedback }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = payload as
        | { success: true; reviewText: string }
        | { success: false; error: { message: string } }
        | null;

      if (!response.ok || !parsed || parsed.success !== true) {
        void sendAnalyticsEvent("ai_generation_failed");
        // Keep the existing draft on screen: a failed regeneration must not
        // destroy text the customer may have already edited.
        setEditorError(
          parsed && parsed.success === false
            ? parsed.error.message
            : "We couldn't generate a new version. Your current review is still here.",
        );
        return;
      }

      setReviewText(parsed.reviewText);
      setCopyState("idle");
      void sendAnalyticsEvent("ai_generation_succeeded");
      setAnnouncement("New review generated.");
    } catch {
      void sendAnalyticsEvent("ai_generation_failed");
      setEditorError("We couldn't reach the server. Your current review is still here.");
    } finally {
      setGenerating(false);
    }
  }, [rating, combinedFeedback, generating]);

  const copyAndOpenGoogle = useCallback(async () => {
    const text = reviewText.trim();
    if (!text) return;

    // Two effects from one tap: the text goes to the clipboard and the Google
    // review page opens. The tab is opened FIRST and synchronously inside the
    // gesture — awaiting the clipboard spends the user activation, and mobile
    // Safari/Chrome block a popup spawned after an await. Opening first also
    // means a clipboard rejection never strands the customer without Google.
    void sendAnalyticsEvent("google_review_clicked");
    try {
      window.open(shop.googleReviewUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Popup blocked outright. The plain link is still on the rate and
      // describe steps, so the customer is never without a route to Google.
    }

    // Clipboard API is only available in secure contexts. If it's missing or
    // rejects, we do NOT claim success — we show the manual path instead.
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      void sendAnalyticsEvent("review_copied");
    } catch {
      setCopyState("manual");
    }

    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  }, [reviewText, shop.googleReviewUrl]);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  function goToGoogle() {
    void sendAnalyticsEvent("google_review_clicked");
  }

  /* ---------------------------------------------------------------------- */
  /* Derived view data                                                       */
  /* ---------------------------------------------------------------------- */

  const ratingLabel = useMemo(() => {
    if (rating === null) return "";
    return rating === 1 ? "1 star" : `${rating} stars`;
  }, [rating]);

  const starters = useMemo(() => startersForRating(rating), [rating]);

  const ratingSummaryId = "selected-rating-summary";
  const privacyId = "privacy-disclosure";
  const quickFillId = "quick-fill-hint";

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="min-h-screen-safe flex flex-col"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <main id="main" className="pb-safe-lg mx-auto w-full max-w-md flex-1 px-5 pt-8">
        <ShopHeader shop={shop} />

        {step === "rate" ? (
          <section key="rate" className="step-enter mt-8">
            <h1 className="step-item text-center text-[1.75rem] leading-tight font-semibold tracking-tight text-pretty">
              {shop.welcomeTitle}
            </h1>
            <p className="step-item mt-2 text-center text-[0.9375rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
              {shop.welcomeMessage}
            </p>

            <div className="step-item mt-12">
              {/* sr-only: five full-size stars are the prompt. Kept in the
                  document because it also names the group for assistive tech. */}
              <p id="rating-prompt" className="sr-only">
                How was your experience with us?
              </p>
              <RatingStars
                value={rating}
                onChange={handleRating}
                onCommit={handleStarCommit}
                describedBy={ratingSummaryId}
              />
              {/* Announced, not displayed. The row of stars already shows the
                  selection; a visible restatement of it just adds a line of
                  text under the thing being looked at. */}
              <p id={ratingSummaryId} aria-live="polite" className="sr-only">
                {rating === null ? "" : `You selected ${ratingLabel}`}
              </p>
            </div>

            <div className="step-item mt-8 flex flex-col items-center gap-3 border-t border-[color:var(--border)] pt-8">
              <GoogleReviewLink href={shop.googleReviewUrl} onNavigate={goToGoogle} />
              <a
                id={privacyId}
                href="/privacy"
                className="text-center text-xs text-[color:var(--text-muted)] underline underline-offset-2 hover:text-[color:var(--text)]"
              >
                Privacy notice
              </a>
            </div>
          </section>
        ) : null}

        {step === "describe" ? (
          <section key="describe" className="step-enter mt-8">
            <div className="step-item mb-6 flex flex-col items-center gap-1">
              <p id={ratingSummaryId} className="text-sm text-[color:var(--text-muted)]">
                You rated us {ratingLabel}
              </p>
              <div aria-hidden="true" className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className="text-lg leading-none"
                    style={{
                      color:
                        rating !== null && star <= rating
                          ? "var(--brand)"
                          : "var(--border)",
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <h2
              ref={describeHeading}
              tabIndex={-1}
              className="step-item text-xl font-semibold tracking-tight text-pretty outline-none"
            >
              Tell us about your experience.
            </h2>

            <div className="step-item mt-5">
              {/* sr-only: it names the chip group for assistive tech; on screen
                  the chips are self-evidently a set of openers. */}
              <p id={quickFillId} className="sr-only">
                Quick things you can say
              </p>
              <QuickFillChips
                starters={starters}
                selected={selectedChips}
                onToggle={toggleChip}
                labelledBy={quickFillId}
                disabled={generating}
              />
            </div>

            <div className="step-item mt-4">
              <label htmlFor="feedback" className="sr-only">
                Your feedback
              </label>
              <textarea
                id="feedback"
                value={feedbackText}
                onChange={(event) => {
                  setFeedbackText(event.target.value);
                  if (generateError) setGenerateError(null);
                }}
                rows={5}
                maxLength={MAX_FEEDBACK_LENGTH}
                placeholder="What went well? What could have been better?"
                aria-describedby="feedback-count"
                className="field resize-none"
                // The counter below is the authoritative limit display; a native
                // maxLength alone gives no feedback before the hard stop.
                enterKeyHint="done"
              />
              <div className="mt-1.5 flex justify-end">
                <span id="feedback-count">
                  {/* Counts the combined text, because that is what is sent and
                      what the minimum applies to. */}
                  <CharacterCounter
                    length={combinedLength}
                    max={MAX_FEEDBACK_LENGTH}
                    min={MIN_FEEDBACK_LENGTH}
                  />
                </span>
              </div>
            </div>

            <div className="step-item mt-4">
              <PrivacyDisclosure shopName={shop.name} />
            </div>

            {generateError ? (
              <div className="mt-4">
                <InlineMessage tone="error">{generateError}</InlineMessage>
              </div>
            ) : null}

            <div className="step-item mt-6">
              <Button
                fullWidth
                loading={generating}
                loadingLabel="Writing your review"
                onClick={() => void generate()}
                aria-disabled={!canGenerate}
                className={!canGenerate ? "opacity-50" : ""}
              >
                {generating ? "Writing your review" : "Help me write a review"}
              </Button>
            </div>

            <div className="step-item mt-5 flex flex-col items-center gap-2 border-t border-[color:var(--border)] pt-5">
              <GoogleReviewLink href={shop.googleReviewUrl} onNavigate={goToGoogle} />
            </div>
          </section>
        ) : null}

        {step === "editor" ? (
          <section key="editor" className="step-enter mt-4">
            {/* The screen's only heading, and its focus target on entry. There is
                deliberately no visible title: the filled box IS the state, and a
                "your review is ready" line above it only delays the text the
                customer came for. */}
            <h2 ref={editorHeading} tabIndex={-1} className="sr-only outline-none">
              Your review is ready
            </h2>

            <div>
              <label htmlFor="review" className="sr-only">
                Your review
              </label>
              <div className="relative">
                <textarea
                  id="review"
                  value={reviewText}
                  onChange={(event) => {
                    setReviewText(event.target.value);
                    if (copyState !== "idle") setCopyState("idle");
                    if (editorError) setEditorError(null);
                  }}
                  rows={7}
                  // Reserve the space up front so the response landing doesn't
                  // shift the copy button out from under the customer's thumb.
                  className="field min-h-[11rem] resize-none"
                  aria-describedby="review-count"
                  aria-busy={generating}
                />
                {generating ? (
                  <div
                    className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-white/70 backdrop-blur-[1px]"
                    aria-hidden="true"
                  >
                    <span className="loading-dots text-[color:var(--brand-ink)]">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                ) : null}
              </div>
              {/* One row, two affordances: the rewrite action sits where the
                  customer is already looking, and the counter keeps its corner.
                  Nothing new is added to the screen's height. */}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <Button
                  variant="quiet"
                  aria-label="Write it differently"
                  title="Write it differently"
                  aria-disabled={generating || undefined}
                  onClick={() => void regenerate()}
                  // No size utility: the shared Button's own padding and 3.25rem
                  // min-height already give this a 52px tap target. Forcing a
                  // width would fight that padding inside a border-box and
                  // squeeze the icon out of its content box.
                  className="shrink-0"
                  icon={
                    generating ? (
                      <Loader2 aria-hidden="true" className="spinner size-4" />
                    ) : (
                      <Sparkles aria-hidden="true" className="size-4" />
                    )
                  }
                />
                <span id="review-count">
                  <CharacterCounter length={reviewText.length} max={800} />
                </span>
              </div>
            </div>

            {editorError ? (
              <div className="mt-4">
                <InlineMessage tone="error">{editorError}</InlineMessage>
              </div>
            ) : null}

            {copyState === "manual" ? (
              <div className="mt-4">
                <InlineMessage tone="info">
                  Your browser blocked clipboard access. Select the text above and copy it
                  manually.
                </InlineMessage>
              </div>
            ) : null}

            {copyState === "copied" ? (
              <div className="mt-4">
                <InlineMessage tone="success" className="msg-pop">
                  Review copied — paste it into the Google review box.
                </InlineMessage>
              </div>
            ) : null}

            <div className="mt-6">
              <Button
                fullWidth
                variant={copyState === "copied" ? "success" : "primary"}
                onClick={() => void copyAndOpenGoogle()}
                icon={
                  copyState === "copied" ? (
                    <Check aria-hidden="true" className="size-5" />
                  ) : (
                    <Copy aria-hidden="true" className="size-5" />
                  )
                }
                disabled={!reviewText.trim()}
              >
                {copyState === "copied" ? "Copied" : "Copy & open Google Reviews"}
              </Button>
            </div>
          </section>
        ) : null}
      </main>

      <LiveAnnouncer message={announcement} />
    </div>
  );
}
