/**
 * Pure provider policy helpers.
 *
 * Deliberately free of the `server-only` guard and of any SDK import, so the
 * retry and thinking decisions can be unit-tested without a live provider or a
 * server context. `lib/ai/gemini.ts` is the only consumer in application code.
 */

/**
 * How long a single provider call may take before it is abandoned.
 *
 * Shared by every adapter so a slow provider cannot outlive the route's budget.
 * A provider that trips this is treated as a transport failure and the chain
 * moves on.
 *
 * 30s is measured, not guessed. With thinking disabled an NVIDIA NIM
 * (nemotron-3.5-lightning) draft lands between ~2s and ~16s depending on input
 * length and how warm the model is — the original 15s cap aborted successful
 * requests at the top of that range. Google answers in well under a second, so
 * this budget only ever binds the primary.
 */
export const AI_PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Whether the model accepts an explicit thinking budget.
 *
 * The 2.5 non-lite models do; `-lite` variants and older names reject the
 * field, so sending it there would turn a working model into a 400.
 */
export function supportsThinkingControl(model: string): boolean {
  const name = model.toLowerCase();
  return name.includes("2.5") && !name.includes("lite");
}

/**
 * Classify a provider error for retry purposes.
 *
 * Retryable: the call never produced an answer (network drop, timeout, 429,
 * 5xx, or a retired/unknown model name). Fatal: anything the caller's request
 * caused, where a second identical call would fail the same way.
 */
export function classifyProviderError(error: unknown): "retryable" | "fatal" {
  // Timeouts and network failures carry no status; they are worth one retry.
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "retryable";
  }

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  if (typeof status !== "number") {
    // No status at all: treat as a transport failure and allow one retry.
    return "retryable";
  }

  if (status === 429 || status === 408 || status >= 500) return "retryable";
  // 404 = the model name is retired or wrong; the fallback is exactly the cure.
  if (status === 404) return "retryable";
  return "fatal";
}
