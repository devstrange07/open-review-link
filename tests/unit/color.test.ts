import { describe, expect, it } from "vitest";
import {
  buildBrandPalette,
  contrastRatio,
  ensureContrast,
  parseHex,
  readableOn,
  relativeLuminance,
  toHex,
  validateBrandColor,
} from "@/lib/color";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

describe("parseHex", () => {
  it("parses 6-digit hex with and without the hash", () => {
    expect(parseHex("#245C47")).toEqual({ r: 36, g: 92, b: 71 });
    expect(parseHex("245C47")).toEqual({ r: 36, g: 92, b: 71 });
  });

  it("expands 3-digit hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("rejects malformed input", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("#gggggg")).toBeNull();
    expect(parseHex("rgb(0,0,0)")).toBeNull();
  });
});

describe("toHex", () => {
  it("round-trips", () => {
    expect(toHex({ r: 36, g: 92, b: 71 })).toBe("#245c47");
  });

  it("clamps out-of-range channels", () => {
    expect(toHex({ r: 300, g: -5, b: 128 })).toBe("#ff0080");
  });
});

describe("contrast", () => {
  it("gives 21:1 for black on white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("gives 1:1 for a colour against itself", () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("computes luminance ordering correctly", () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
  });
});

describe("ensureContrast", () => {
  it("leaves an already-readable colour alone", () => {
    const dark = parseHex("#111111")!;
    expect(ensureContrast(dark, WHITE, 4.5)).toEqual(dark);
  });

  it("darkens until it clears 4.5:1 on white", () => {
    // A pale yellow that is unreadable as text.
    const pale = parseHex("#FFE97A")!;
    expect(contrastRatio(pale, WHITE)).toBeLessThan(4.5);
    const fixed = ensureContrast(pale, WHITE, 4.5);
    expect(contrastRatio(fixed, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("always terminates with a readable result", () => {
    for (const hex of ["#FFEE00", "#00FF00", "#FFFF00", "#E0E0E0", "#7FFFD4"]) {
      const fixed = ensureContrast(parseHex(hex)!, WHITE, 4.5);
      expect(contrastRatio(fixed, WHITE), hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("readableOn", () => {
  it("picks white text on a dark brand", () => {
    expect(readableOn(parseHex("#245C47")!)).toEqual(WHITE);
  });

  it("picks black text on a light brand", () => {
    expect(readableOn(parseHex("#F5E6A8")!)).toEqual(BLACK);
  });
});

describe("buildBrandPalette", () => {
  it("produces four usable values for the default colour", () => {
    const palette = buildBrandPalette("#245C47");
    expect(palette.brand).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.ink).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.soft).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.onBrand).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("guarantees ink clears 4.5:1 on white for a light brand", () => {
    const palette = buildBrandPalette("#FFD400");
    const ink = parseHex(palette.ink)!;
    expect(contrastRatio(ink, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the raw brand colour as chosen", () => {
    const palette = buildBrandPalette("#1A73E8");
    expect(palette.brand).toBe("#1a73e8");
  });

  it("falls back to the spec default when given junk", () => {
    for (const bad of [null, undefined, "", "not-a-colour", "#12345"]) {
      const palette = buildBrandPalette(bad);
      expect(palette.brand).toBe("#245c47");
    }
  });
});

describe("validateBrandColor", () => {
  it("accepts a normal brand colour", () => {
    expect(validateBrandColor("#245C47").ok).toBe(true);
  });

  it("rejects a malformed value", () => {
    const result = validateBrandColor("green");
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects colours too light to derive readable text from", () => {
    expect(validateBrandColor("#FFFFFF").ok).toBe(false);
    expect(validateBrandColor("#FAFAFA").ok).toBe(false);
  });
});
