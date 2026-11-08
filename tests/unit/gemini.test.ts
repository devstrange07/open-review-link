import { describe, expect, it } from "vitest";
import { classifyProviderError, supportsThinkingControl } from "@/lib/ai/model-policy";

describe("classifyProviderError", () => {
  it("treats a timeout as retryable", () => {
    const error = new Error("aborted");
    error.name = "TimeoutError";
    expect(classifyProviderError(error)).toBe("retryable");
  });

  it("treats a 429 as retryable", () => {
    expect(classifyProviderError(Object.assign(new Error("rate"), { status: 429 }))).toBe(
      "retryable",
    );
  });

  it("treats a 5xx as retryable", () => {
    expect(
      classifyProviderError(Object.assign(new Error("upstream"), { status: 503 })),
    ).toBe("retryable");
  });

  it("treats a 404 (retired model name) as retryable", () => {
    // The fallback model is exactly the cure for a retired primary name.
    expect(
      classifyProviderError(Object.assign(new Error("no model"), { status: 404 })),
    ).toBe("retryable");
  });

  it("treats an error with no status as retryable (transport failure)", () => {
    expect(classifyProviderError(new Error("socket hang up"))).toBe("retryable");
  });

  it("treats a 400 as fatal: a second identical call fails the same way", () => {
    expect(
      classifyProviderError(Object.assign(new Error("bad request"), { status: 400 })),
    ).toBe("fatal");
  });

  it("treats a 403 as fatal", () => {
    expect(
      classifyProviderError(Object.assign(new Error("forbidden"), { status: 403 })),
    ).toBe("fatal");
  });
});

describe("supportsThinkingControl", () => {
  it("enables thinking control for 2.5 non-lite models", () => {
    expect(supportsThinkingControl("gemini-2.5-flash")).toBe(true);
    expect(supportsThinkingControl("gemini-2.5-pro")).toBe(true);
  });

  it("does not enable it for lite variants", () => {
    expect(supportsThinkingControl("gemini-2.5-flash-lite")).toBe(false);
  });

  it("does not enable it for other model families", () => {
    expect(supportsThinkingControl("gemini-2.0-flash")).toBe(false);
    expect(supportsThinkingControl("gemini-1.5-pro")).toBe(false);
  });
});
