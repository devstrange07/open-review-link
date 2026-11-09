import "server-only";
import { getServerEnv } from "@/lib/env";
import { AI_PROVIDER_TIMEOUT_MS, classifyProviderError } from "./model-policy";
import { buildSystemInstruction, buildUserPrompt, type PromptInput } from "./prompt";

/**
 * NVIDIA integration.
 *
 * NVIDIA's hosted endpoint (integrate.api.nvidia.com) speaks the OpenAI chat
 * completions dialect, so this adapter is a thin `fetch` rather than an SDK.
 *
 * Two behaviours of hosted models drive the shape of this file:
 *
 *  1. They are reasoning models. Chain-of-thought comes back in
 *     `message.reasoning_content` and is billed against `max_tokens`. With a
 *     small budget the model spends everything thinking and returns
 *     `content: null` with `finish_reason: "length"`. So we ask for a generous
 *     budget and read `content` only — never `reasoning_content`, which is not
 *     a review and would be rejected by the sanitiser anyway.
 *
 *  2. They are slow and variable. A bad pick routinely exceeds ten seconds, so
 *     the call carries an abort signal and a trip past it is classified as a
 *     transport failure, letting the chain fall through to Google.
 *
 * The customer's text is never logged: only codes, model names, and timings.
 */

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Generous on purpose. Reasoning tokens and answer tokens draw from the same
 * budget, and a 30-80 word review is only ~100 answer tokens; the rest is
 * headroom for the model's scratchpad.
 */
const MAX_OUTPUT_TOKENS = 1500;

export type NvidiaAttemptResult =
  | { ok: true; raw: string }
  | { ok: false; kind: "provider"; retryable: boolean; name: string }
  | { ok: false; kind: "invalid_output" };

/** The subset of the OpenAI-shaped response we depend on. */
type ChatCompletion = {
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }>;
};

/**
 * Pull the review out of a chat-completions body.
 *
 * Pure and exported so the "content only, never reasoning" rule is unit-tested
 * without a network call. Returns `null` when there is no usable answer, which
 * the caller maps to `invalid_output` — the provider did respond, so retrying
 * the same request would burn quota for the same result.
 */
export function extractCompletionText(body: unknown): string | null {
  const choices = (body as ChatCompletion | null)?.choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Finish reason, for the failure log. Never the text itself. */
export function completionFinishReason(body: unknown): string {
  const reason = (body as ChatCompletion | null)?.choices?.[0]?.finish_reason;
  return typeof reason === "string" && reason ? reason : "unknown";
}

/** An HTTP-level rejection, carrying a status for `classifyProviderError`. */
class NvidiaHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "NvidiaHttpError";
    this.status = status;
  }
}

/** One provider call. Sanitising is the caller's job. */
export async function attemptNvidiaDraft(
  model: string,
  input: PromptInput,
  startedAt: number,
): Promise<NvidiaAttemptResult> {
  const env = getServerEnv();
  const apiKey = env.NVIDIA_API_KEY;

  // Defensive: the chain only includes this adapter when a key is present.
  if (!apiKey) {
    return { ok: false, kind: "provider", retryable: true, name: "NoApiKey" };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemInstruction(input.locale ?? "en") },
          { role: "user", content: buildUserPrompt(input) },
        ],
        temperature: 0.6,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Nemotron models run a long chain-of-thought by default, and it is
        // billed from the same budget as the answer. With the real (long)
        // system instruction the model can spend the entire budget thinking and
        // return `content: null` with `finish_reason: "length"`. A short rewrite
        // does not need the scratchpad, so switch it off. Templates that do not
        // recognise the flag ignore it.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
    });

    // The body is read before the status check so a provider error message is
    // available for the truncated `detail=` log line below.
    const raw = await response.text();

    if (!response.ok) {
      throw new NvidiaHttpError(response.status, raw.slice(0, 300));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error(
        `[ai] nvidia returned non-JSON model=${model} status=${response.status} ms=${
          Date.now() - startedAt
        }`,
      );
      return { ok: false, kind: "invalid_output" };
    }

    const text = extractCompletionText(parsed);
    if (!text) {
      // Most often `content: null` from a reasoning model that ran out of
      // budget. The finish reason tells the two cases apart at a glance.
      console.warn(
        `[ai] empty completion provider=nvidia model=${model} ms=${
          Date.now() - startedAt
        } finish=${completionFinishReason(parsed)}`,
      );
      return { ok: false, kind: "invalid_output" };
    }

    return { ok: true, raw: text };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    const detail = error instanceof Error ? error.message.slice(0, 300) : "";
    console.error(
      `[ai] attempt failed provider=nvidia model=${model} status=${String(
        status,
      )} name=${name} ms=${Date.now() - startedAt} detail=${detail}`,
    );
    const retryable = classifyProviderError(error) === "retryable";
    return { ok: false, kind: "provider", retryable, name };
  }
}