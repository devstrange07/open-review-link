"use client";

type Props = {
  length: number;
  max: number;
  /** Below this the AI generate button stays disabled. */
  min?: number;
};

/**
 * Character counter.
 *
 * Quiet until it matters. Tabular numerals so the digit count doesn't reflow
 * the layout on every keystroke, which would make the whole line shimmer while
 * typing.
 */
export function CharacterCounter({ length, max, min = 0 }: Props) {
  const over = length > max;
  const remaining = max - length;
  const nearLimit = remaining <= 100;

  const state = over ? "over" : nearLimit ? "near" : "normal";
  const colour =
    state === "over"
      ? "var(--danger)"
      : state === "near"
        ? "var(--text-muted)"
        : "var(--text-muted)";

  return (
    <p
      className="tabular text-[0.8125rem]"
      style={{ color: colour }}
      // Announced only when the limit is crossed, not on every keystroke.
      aria-live={over ? "polite" : "off"}
    >
      {over ? (
        <>{Math.abs(remaining)} characters over the limit</>
      ) : (
        <>
          {length} / {max}
          {length < min && min > 0 ? (
            <span className="text-[color:var(--text-muted)]">
              {" "}
              · at least {min} needed
            </span>
          ) : null}
        </>
      )}
    </p>
  );
}
