/**
 * Quick-filler phrases.
 *
 * The point of these is to let a customer send a real, specific review without
 * typing a single word. Each phrase is a short, complete thought in the
 * customer's own voice, so the text they end up sharing still reads as theirs —
 * the chips are a vocabulary, not a script.
 *
 * Tone follows the rating, but the split is deliberately about *what the
 * customer wants to say*, not about steering them:
 *   - 4-5 stars: appreciation, the things a happy customer actually mentions.
 *   - 1-3 stars: constructive complaints, so an unhappy customer is not handed a
 *     list of compliments to tick.
 *
 * Six per tier, kept short so a two-column grid fills the phone width without
 * wrapping into a tall wall of pills.
 *
 * Nothing here is sent on its own: a tapped chip is merged with whatever the
 * customer typed, and the combined text is editable in the box before anything
 * leaves the page.
 */

export const APPRECIATIVE_STARTERS = [
  "Friendly, helpful staff",
  "Quick service",
  "Fair prices",
  "Clean and organised",
  "Found what I needed",
  "Worth coming back",
] as const;

export const CONSTRUCTIVE_STARTERS = [
  "Long wait",
  "Staff could listen more",
  "Items unavailable",
  "Prices felt high",
  "Hard to find things",
  "Service felt rushed",
] as const;

/**
 * The set that matches the rating. 4-5 stars get appreciation, 1-3 stars get
 * constructive points. A null rating (should not occur on this step) falls back
 * to constructive phrasing, since a blank box is worse than a usable one.
 */
export function startersForRating(rating: number | null): readonly string[] {
  if (rating !== null && rating >= 4) return APPRECIATIVE_STARTERS;
  return CONSTRUCTIVE_STARTERS;
}

/** Add a full stop when a fragment has no terminal punctuation of its own. */
function ensureTerminal(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?…]["')\]]?$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Merge the selected phrases with whatever the customer typed into one block.
 *
 * The typed text comes first — it is the customer's own words and should lead —
 * then each selected phrase as its own sentence. Pure and order-stable, so it
 * can be unit-tested without a DOM. Selection order is preserved so the text
 * reads in the order the chips were tapped.
 */
export function buildCombinedFeedback(
  selected: readonly string[],
  typed: string,
): string {
  const parts: string[] = [];
  if (typed.trim()) parts.push(typed.trim());
  for (const phrase of selected) {
    if (phrase.trim()) parts.push(phrase.trim());
  }
  if (parts.length === 0) return "";
  return parts.map(ensureTerminal).join(" ");
}
