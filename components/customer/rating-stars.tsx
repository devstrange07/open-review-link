"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

/**
 * Five-star rating.
 *
 * Implemented as a radiogroup because that is what it is: one choice from five.
 * A row of buttons with no group semantics would leave a screen reader user
 * with five unrelated buttons and no idea one is selected.
 *
 * Keyboard: arrows move and select, Home/End jump to the ends, digits 1-5
 * select directly. Roving tabindex means Tab enters and leaves the group once
 * rather than five times.
 */

const RATING_LABELS: Record<number, string> = {
  1: "1 star",
  2: "2 stars",
  3: "3 stars",
  4: "4 stars",
  5: "5 stars",
};

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  /**
   * Fired only on a genuine pick (tap, click, Enter/Space) — never for arrow-key
   * navigation, so a keyboard user can move through the row without the caller
   * acting on every step. This is the "the customer chose" signal.
   */
  onCommit?: (rating: number) => void;
  /** Announced under the group; gives the rating a name without colour. */
  describedBy?: string;
  disabled?: boolean;
};

export function RatingStars({
  value,
  onChange,
  onCommit,
  describedBy,
  disabled,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  // The star that was just picked. Drives a one-shot pop + ring so the tap
  // reads as acknowledged before the caller may move the customer on. Kept in
  // state rather than derived from `value` so it never replays when the step
  // remounts with a rating already set (draft restore, Back navigation).
  const [pulse, setPulse] = useState<number | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  // While tabbing, only the selected star (or the first) is reachable.
  const focusable = value ?? 1;

  function commit(rating: number) {
    if (disabled) return;
    onChange(rating);
  }

  function pick(rating: number) {
    if (disabled) return;
    commit(rating);
    setPulse(rating);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(null), 320);
    onCommit?.(rating);
  }

  function moveFocus(rating: number) {
    commit(rating);
    buttons.current[rating - 1]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent, current: number) {
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 5) {
      event.preventDefault();
      moveFocus(digit);
      return;
    }

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        moveFocus(Math.min(5, current + 1));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        moveFocus(Math.max(1, current - 1));
        break;
      case "Home":
        event.preventDefault();
        moveFocus(1);
        break;
      case "End":
        event.preventDefault();
        moveFocus(5);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="How was your experience with us?"
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      className="flex items-center justify-center gap-1"
      // Hover preview is purely decorative; clear it when the pointer leaves
      // the group so a half-swept row never looks selected.
      onPointerLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isSelected = value !== null && star <= value;
        const isPreview = value === null && hovered !== null && star <= hovered;
        const active = isSelected || isPreview;

        return (
          <button
            key={star}
            ref={(node) => {
              buttons.current[star - 1] = node;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={RATING_LABELS[star]}
            tabIndex={star === focusable ? 0 : -1}
            disabled={disabled}
            onClick={() => pick(star)}
            onKeyDown={(event) => handleKeyDown(event, star)}
            onPointerEnter={() => {
              // Only preview on devices with a real pointer; on touch this fires
              // during a scroll and leaves a phantom highlight behind.
              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                setHovered(star);
              }
            }}
            className="pressable relative grid size-14 place-items-center rounded-full disabled:cursor-not-allowed"
          >
            {/* One-shot ring on the star that was just picked. Sits behind the
                glyph and unmounts after the pop, so it never replays on a draft
                restore or when the step remounts. */}
            {pulse === star ? (
              <span
                aria-hidden="true"
                className="star-ring pointer-events-none absolute inset-0 rounded-full"
              />
            ) : null}
            <Star
              aria-hidden="true"
              // Stroke weight and fill both change, so selection is legible
              // without relying on colour (and stays legible in greyscale).
              strokeWidth={active ? 2.5 : 1.5}
              className="size-9 transition-colors duration-150"
              style={{
                color: active ? "var(--brand)" : "var(--text-muted)",
                fill: active ? "var(--brand)" : "transparent",
                // Pop only the star that was just picked, and only once per pick.
                // 260ms so it finishes inside the 300ms advance window.
                animation: pulse === star ? "star-pop 260ms var(--ease-back)" : undefined,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
