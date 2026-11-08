import "server-only";
import { getServerEnv, hasNvidiaEnv } from "@/lib/env";
import { attemptGeminiDraft } from "./gemini";
import { attemptNvidiaDraft } from "./nvidia";
import type { PromptInput } from "./prompt";

/**
 * Provider policy: NVIDIA first, Google as the fallback.
 *
 * Adapters know how to talk to one vendor. Only this module knows the order,
 * the retry rules, and the codes that leave the building. Keeping the policy
 * here means swapping or adding a provider never touches the route.
 *
 * Reliability model: NVIDIA gets one attempt, then Google gets at most two
 * (its primary and fallback model names). The chain only advances past a
 * provider when the failure was at the provider — a network drop, a timeout, a
 * 429/5xx, or a retired model name. A provider that answers with unusable
 * content ends the request immediately: retrying the same prompt against the
 * same model would spend quota for the same result.
 *
 * The cap matters because the customer-facing limiter is checked once at the
 * route boundary, so these internal retries never spend the customer's own
 * budget — which would be an easy way to fan a bad provider day into a quota
 * storm.
 */

/** The same ceiling as before the split: no unbounded retry loops. */
const MAX_PROVIDER_ATTEMPTS = 2;

export type GenerateFailure = {
  code: "AI_PROVIDER_ERROR" | "AI_INVALID_OUTPUT";
  message: string;
};

export type GenerateResult =
  { ok: true; text: string } | { ok: false; error: GenerateFailure };

/** The outcome of a single provider call. */
export type ProviderAttempt =
  | { ok: true; raw: string }
  | { ok: false; kind: "provider"; retryable: boolean; name: string }
  | { ok: false; kind: "invalid_output" };

/**
 * A provider plus the model names to try, in order.
 *
 * Exposed as a plain function rather than a class so the whole chain is a value
 * that is easy to read and to test.
 */
export type Provider = {
  name: "nvidia" | "google";
  models: readonly string[];
  attempt(model: string, input: PromptInput, startedAt: number): Promise<ProviderAttempt>;
};

/**
 * Build the chain for this process.
 *
 * With no NVIDIA key the chain is Google-only, which is also the shape the E2E
 * suite runs with. Resolved per call rather than cached so a test that flips the
 * environment sees the change.
 */
export function resolveProviders(): Provider[] {
  const env = getServerEnv();
  const providers: Provider[] = [];

  if (hasNvidiaEnv()) {
    providers.push({
      name: "nvidia",
      models: [env.NVIDIA_MODEL],
      attempt: attemptNvidiaDraft,
    });
  }

  providers.push({
    name: "google",
    // De-duplicated: an operator who sets both names to the same model should
    // get one retry, not two identical calls.
    models: [env.AI_MODEL, env.AI_FALLBACK_MODEL].filter(
      (model, index, all) => all.indexOf(model) === index,
    ),
    attempt: attemptGeminiDraft,
  });

  return providers;
}

/**
 * Ask the chain for a draft, returning the raw text on success.
 *
 * Flattens every provider into one attempt list (provider, model) so the
 * `MAX_PROVIDER_ATTEMPTS` ceiling applies across vendors, not per vendor.
 */
export async function requestReviewDraft(
  input: PromptInput,
): Promise<{ ok: true; raw: string } | { ok: false; error: GenerateFailure }> {
  const startedAt = Date.now();

  const attempts = resolveProviders()
    .flatMap((provider) =>
      provider.models.map((model) => ({ provider, model })),
    )
    .slice(0, MAX_PROVIDER_ATTEMPTS);

  let lastProviderName = "unknown";

  for (let index = 0; index < attempts.length; index += 1) {
    const { provider, model } = attempts[index]!;
    const result = await provider.attempt(model, input, startedAt);

    if (result.ok) return { ok: true, raw: result.raw };

    if (result.kind === "invalid_output") {
      // The model answered; the content was unusable. Retrying would waste
      // quota on the same outcome, so surface it as-is.
      return {
        ok: false,
        error: {
          code: "AI_INVALID_OUTPUT",
          message: "We could not generate a review from that text. Please try again.",
        },
      };
    }

    lastProviderName = `${provider.name}:${result.name}`;
    const hasFallback = index < attempts.length - 1;
    if (!result.retryable || !hasFallback) break;

    console.warn(
      `[ai] retrying after=${provider.name}/${model} next=${
        attempts[index + 1]!.provider.name
      }/${attempts[index + 1]!.model} ms=${Date.now() - startedAt}`,
    );
  }

  console.error(
    `[ai] provider call failed name=${lastProviderName} ms=${Date.now() - startedAt}`,
  );
  return {
    ok: false,
    error: {
      code: "AI_PROVIDER_ERROR",
      message: "Review generation is temporarily unavailable.",
    },
  };
}