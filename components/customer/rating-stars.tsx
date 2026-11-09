"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { Messages, StarMeaning } from "@/lib/i18n";

/**
 * Five-star rating with visible meaning labels.
 *
 * Implemented as a radiogroup because that is what it is: one choice from five.
 * Keyboard: arrows move and select, Home/End jump to the ends, digits 1-5
 * select directly. Roving tabindex means Tab enters and leaves the group once.
 */

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  /**
   * Fired only on a genuine pick (tap, click, Enter/Space) — never for arrow-key
   * navigation, so a keyboard user can move through the row without the caller
   * acting on every step.
   */
  onCommit?: (rating: number) => void;
  describedBy?: string;
  disabled?: boolean;
  messages: Messages;
};

export function RatingStars({
  value,
  onChange,
  onCommit,
  describedBy,
  disabled,
  messages,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

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
      aria-label={messages.ratingPrompt}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      className="flex items-start justify-center gap-0.5 sm:gap-1"
      onPointerLeave={() => setHovered(null)}
    >
      {([1, 2, 3, 4, 5] as const).map((star) => {
        const meaning = messages.starMeanings[star as StarMeaning];
        const isSelected = value !== null && star <= value;
        const isExact = value === star;
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
            aria-label={messages.starAriaLabel(star, meaning)}
            tabIndex={star === focusable ? 0 : -1}
            disabled={disabled}
            onClick={() => pick(star)}
            onKeyDown={(event) => handleKeyDown(event, star)}
            onPointerEnter={() => {
              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                setHovered(star);
              }
            }}
            className="pressable relative flex min-w-[3.25rem] flex-col items-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1 disabled:cursor-not-allowed sm:min-w-[3.5rem]"
          >
            <span className="relative grid size-14 place-items-center">
              {pulse === star ? (
                <span
                  aria-hidden="true"
                  className="star-ring pointer-events-none absolute inset-0 rounded-full"
                />
              ) : null}
              <Star
                aria-hidden="true"
                strokeWidth={active ? 2.5 : 1.5}
                className="size-9 star-glyph"
                style={{
                  color: active ? "var(--brand)" : "var(--text-muted)",
                  fill: active ? "var(--brand)" : "transparent",
                  animation: pulse === star ? "star-pop 260ms var(--ease-back)" : undefined,
                }}
              />
            </span>
            <span
              className={`star-label max-w-[3.5rem] text-center text-[0.625rem] leading-tight sm:text-[0.6875rem] ${
                isExact
                  ? "font-semibold text-[color:var(--brand-ink)]"
                  : "font-medium text-[color:var(--text-muted)]"
              }`}
            >
              {meaning}
            </span>
          </button>
        );
      })}
    </div>
  );
}
