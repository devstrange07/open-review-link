import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/lib/env";
import { SYSTEM_INSTRUCTION, buildUserPrompt, type PromptInput } from "./prompt";
import {
  AI_PROVIDER_TIMEOUT_MS,
  classifyProviderError,
  supportsThinkingControl,
} from "./model-policy";
import type { ProviderAttempt } from "./provider";

/**
 * Gemini integration.
 *
 * Server-only. The API key never leaves this process. The customer's text is
 * never logged: on failure we log a code and a duration, nothing else.
 *
 * This module owns the mechanics of one Google call (including the thinking
 * budget and the fallback model name); the decision of *when* to try Google in
 * the first place belongs to `lib/ai/provider.ts`, which chains it behind
 * NVIDIA.
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getServerEnv().GEMINI_API_KEY });
  }
  return client;
}

/**
 * One provider call. Returns the raw text; sanitising is the caller's job so
 * the boundary between "provider unwell" and "provider returned something
 * unusable" stays explicit.
 */
export async function attemptGeminiDraft(
  model: string,
  input: PromptInput,
  startedAt: number,
): Promise<ProviderAttempt> {
  try {
    const response = await getClient().models.generateContent({
      model,
      contents: buildUserPrompt(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        // A 30-80 word review is well under 400 tokens; the cap bounds cost if
        // the model decides to ramble.
        maxOutputTokens: 400,
        responseMimeType: "text/plain",
        // Disable thinking where supported: a short rewrite does not benefit
        // from it, and it is the dominant source of latency on 2.5 models.
        ...(supportsThinkingControl(model)
          ? { thinkingConfig: { thinkingBudget: 0 } }
          : {}),
        abortSignal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
      },
    });

    const text = response.text;
    if (!text || !text.trim()) {
      console.warn(
        `[ai] empty completion provider=google model=${model} ms=${
          Date.now() - startedAt
        } finish=${String(response.candidates?.[0]?.finishReason ?? "unknown")}`,
      );
      return { ok: false, kind: "invalid_output" };
    }

    return { ok: true, raw: text };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    // This is the line to read when drafting fails. The status separates the
    // causes that look identical to the customer: 403 is an account or project
    // restriction (billing, key scope), 400 is a parameter the model rejected
    // after a model swap, and 429/5xx are quota or an outage the fallback
    // covers. Without it, "provider call failed name=ApiError" is the whole
    // story and a config problem is indistinguishable from an incident.
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    // The provider's own message, never the request: the API echoes its
    // complaint (billing, unsupported parameter) but not the prompt. Truncated
    // so a verbose error body cannot fill the log.
    const detail = error instanceof Error ? error.message.slice(0, 300) : "";
    console.error(
      `[ai] attempt failed provider=google model=${model} status=${String(
        status,
      )} name=${name} ms=${Date.now() - startedAt} detail=${detail}`,
    );
    const retryable = classifyProviderError(error) === "retryable";
    return { ok: false, kind: "provider", retryable, name };
  }
}

export { classifyProviderError, supportsThinkingControl };