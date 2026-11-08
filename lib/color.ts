/**
 * Brand colour derivation.
 *
 * The shop picks one hex in admin. From that single value we derive a small
 * usable palette that is guaranteed to be readable as text on white:
 *
 *   --brand       the raw choice, used for fills and decoration
 *   --brand-ink   darkened until it clears 4.5:1 on white, used for text/links
 *   --brand-soft  a tint for backgrounds
 *   --on-brand    black or white, whichever reads better on --brand fills
 *
 * Only pure functions here so this is unit-testable without a DOM.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(input: string): Rgb | null {
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** Darken in sRGB space by scaling toward black. Predictable and cheap. */
export function darken(color: Rgb, factor: number): Rgb {
  const f = Math.min(1, Math.max(0, factor));
  return { r: color.r * f, g: color.g * f, b: color.b * f };
}

/**
 * Darken until the colour clears `target` contrast against `against`.
 * Steps by 4% so we land on a colour close to the original rather than
 * collapsing to black.
 */
export function ensureContrast(color: Rgb, against: Rgb, target = 4.5): Rgb {
  if (contrastRatio(color, against) >= target) return color;
  let factor = 0.96;
  while (factor > 0) {
    const candidate = darken(color, factor);
    if (contrastRatio(candidate, against) >= target) return candidate;
    factor -= 0.04;
  }
  return BLACK;
}

/** Pick black or white text for a coloured fill. */
export function readableOn(background: Rgb): Rgb {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? BLACK
    : WHITE;
}

export type BrandPalette = {
  brand: string;
  ink: string;
  soft: string;
  onBrand: string;
};

/**
 * Build the CSS custom properties injected on the customer page.
 * Falls back to the spec's default green when the stored value is unusable.
 */
export function buildBrandPalette(input: string | null | undefined): BrandPalette {
  const parsed = (input && parseHex(input)) || parseHex("#245C47")!;
  const ink = ensureContrast(parsed, WHITE, 4.5);
  const soft = {
    r: parsed.r + (255 - parsed.r) * 0.92,
    g: parsed.g + (255 - parsed.g) * 0.92,
    b: parsed.b + (255 - parsed.b) * 0.92,
  };

  return {
    brand: toHex(parsed),
    ink: toHex(ink),
    soft: toHex(soft),
    onBrand: toHex(readableOn(parsed)),
  };
}

/** Used by the admin form to reject unusable brand colours before saving. */
export function validateBrandColor(input: string): {
  ok: boolean;
  reason?: string;
} {
  const parsed = parseHex(input);
  if (!parsed) return { ok: false, reason: "Enter a hex colour like #245C47." };
  // Reject colours so light that no darkening keeps them recognisable as
  // themselves — the derived ink would be an unrelated dark grey.
  if (relativeLuminance(parsed) > 0.93) {
    return {
      ok: false,
      reason: "That colour is too light to read on a white background.",
    };
  }
  return { ok: true };
}
