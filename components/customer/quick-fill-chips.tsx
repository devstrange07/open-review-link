"use client";

/**
 * Quick-fill chips.
 *
 * Tapping a chip writes a ready-made phrase into the feedback box; tapping it
 * again removes it. No typing required to send a real review, and every chip is
 * the customer's own words once it lands in the box — editable and deletable.
 *
 * Implemented as toggle buttons with `aria-pressed` rather than checkbox inputs
 * styled as pills: the semantics that matter here are "this phrase is currently
 * in your text", which is exactly what a pressed toggle expresses, and it keeps
 * the tap target a full-size control instead of a 20px box.
 *
 * Motion is deliberately minimal. These appear once, on entry, so a short
 * staggered rise reads as one motion; the press feedback comes from the shared
 * `.pressable` scale, which is the same feedback every other control gives.
 */

type Props = {
  starters: readonly string[];
  selected: readonly string[];
  onToggle: (phrase: string) => void;
  /** id of the visible label, so the group is named by real on-screen text. */
  labelledBy?: string;
  disabled?: boolean;
};

export function QuickFillChips({
  starters,
  selected,
  onToggle,
  labelledBy,
  disabled,
}: Props) {
  const selectedSet = new Set(selected);

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {starters.map((starter, index) => {
        const isSelected = selectedSet.has(starter);
        return (
          <button
            key={starter}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onToggle(starter)}
            // The rise is decorative and short; the per-index delay (capped so a
            // long list never feels slow) makes the set arrive as one motion.
            className="chip pressable chip-enter rounded-full border px-3.5 py-2 text-left text-[0.8125rem] font-medium"
            style={{
              animationDelay: `${Math.min(index, 6) * 40}ms`,
              borderColor: isSelected
                ? "color-mix(in oklab, var(--brand) 45%, var(--border))"
                : "var(--border)",
              backgroundColor: isSelected ? "var(--brand-soft)" : "var(--surface)",
              color: isSelected ? "var(--brand-ink)" : "var(--text)",
            }}
          >
            {starter}
          </button>
        );
      })}
    </div>
  );
}
