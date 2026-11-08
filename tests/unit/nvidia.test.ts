import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * NVIDIA adapter tests.
 *
 * No live key and no network: `fetch` is stubbed for every case. The real API
 * confirmed two behaviours these tests pin down — reasoning text arrives in a
 * separate field, and it is billed against the same `max_tokens` budget as the
 * answer, so a tight budget yields `content: null` with `finish_reason:
 * "length"`.
 */

const ENV_KEYS = [
  "NVIDIA_API_KEY",
  "NVIDIA_MODEL",
  "GEMINI_API_KEY",
  "AI_MODEL",
  "AI_FALLBACK_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

/** A minimal but valid env so `getServerEnv()` parses. */
const BASE_ENV: Record<string, string> = {
  NVIDIA_API_KEY: "nvapi-test-placeholder",
  NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
  GEMINI_API_KEY: "gemini-test-placeholder",
  AI_MODEL: "gemini-2.5-flash",
  AI_FALLBACK_MODEL: "gemini-2.5-flash-lite",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-placeholder-0000000000",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder-00000000",
  NEXT_PUBLIC_APP_URL: "https://shop.example.com",
};

const PROMPT_INPUT = {
  rating: 4,
  feedbackText: "The staff were friendly but the queue was slow.",
  shopName: "Green Grocers",
};

/** Fresh modules each test so the `getServerEnv()` cache and client hold no state. */
async function loadModules() {
  vi.resetModules();
  const nvidia = await import("@/lib/ai/nvidia");
  const provider = await import("@/lib/ai/provider");
  return { ...nvidia, ...provider };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completion(options: {
  content?: string | null;
  reasoning?: string | null;
  finishReason?: string;
}) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: options.content ?? null,
          reasoning_content: options.reasoning ?? null,
        },
        finish_reason: options.finishReason ?? "stop",
      },
    ],
    usage: { prompt_tokens: 40, completion_tokens: 80, total_tokens: 120 },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, BASE_ENV);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("extractCompletionText", () => {
  it("returns the message content", async () => {
    const { extractCompletionText } = await loadModules();
    expect(
      extractCompletionText(completion({ content: "The staff were friendly." })),
    ).toBe("The staff were friendly.");
  });

  it("returns null when content is null, even if reasoning is present", async () => {
    // The real failure mode: a reasoning model spends the whole budget
    // thinking and ships content: null.
    const { extractCompletionText } = await loadModules();
    expect(
      extractCompletionText(
        completion({ content: null, reasoning: "Let me think about this...", finishReason: "length" }),
      ),
    ).toBeNull();
  });

  it("never falls back to reasoning_content", async () => {
    const { extractCompletionText } = await loadModules();
    const result = extractCompletionText(
      completion({ content: null, reasoning: "A draft the model was still refining." }),
    );
    expect(result).toBeNull();
  });

  it("treats whitespace-only content as empty", async () => {
    const { extractCompletionText } = await loadModules();
    expect(extractCompletionText(completion({ content: "   \n  " }))).toBeNull();
  });

  it("survives a malformed body", async () => {
    const { extractCompletionText } = await loadModules();
    expect(extractCompletionText({})).toBeNull();
    expect(extractCompletionText(null)).toBeNull();
    expect(extractCompletionText("nope")).toBeNull();
    expect(extractCompletionText({ choices: [] })).toBeNull();
  });
});

describe("attemptNvidiaDraft", () => {
  it("posts an OpenAI-shaped request with a generous token budget", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(completion({ content: "I liked the friendly staff." })),
    );
    const { attemptNvidiaDraft } = await loadModules();

    const result = await attemptNvidiaDraft(
      "nvidia/nemotron-3.5-lightning-30b-a3b",
      PROMPT_INPUT,
      Date.now(),
    );

    expect(result).toEqual({ ok: true, raw: "I liked the friendly staff." });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
    // Reasoning is billed here, so the budget must leave room for an answer.
    expect(body.max_tokens).toBeGreaterThanOrEqual(1000);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain(PROMPT_INPUT.feedbackText);
  });

  it("sends the key as a bearer token and never in the body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(completion({ content: "Fine." })));
    const { attemptNvidiaDraft } = await loadModules();

    await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe(`Bearer ${BASE_ENV.NVIDIA_API_KEY}`);
    expect(String(init.body)).not.toContain(BASE_ENV.NVIDIA_API_KEY);
  });

  it("reports invalid_output when the model returns no content", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(completion({ content: null, reasoning: "thinking", finishReason: "length" })),
    );
    const { attemptNvidiaDraft } = await loadModules();

    const result = await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());
    expect(result).toEqual({ ok: false, kind: "invalid_output" });
  });

  it("classifies a 429 as a retryable provider error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "rate limited" }, 429));
    const { attemptNvidiaDraft } = await loadModules();

    const result = await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());
    expect(result).toMatchObject({ ok: false, kind: "provider", retryable: true });
  });

  it("classifies a 400 as fatal", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad request" }, 400));
    const { attemptNvidiaDraft } = await loadModules();

    const result = await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());
    expect(result).toMatchObject({ ok: false, kind: "provider", retryable: false });
  });

  it("classifies a timeout as retryable", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);
    const { attemptNvidiaDraft } = await loadModules();

    const result = await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());
    expect(result).toMatchObject({ ok: false, kind: "provider", retryable: true });
  });

  it("does not log the customer's text on failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    const { attemptNvidiaDraft } = await loadModules();

    await attemptNvidiaDraft("model", PROMPT_INPUT, Date.now());

    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .join(" ");
    expect(logged).not.toContain(PROMPT_INPUT.feedbackText);
  });
});

describe("resolveProviders", () => {
  it("puts NVIDIA first when a key is present", async () => {
    const { resolveProviders } = await loadModules();
    const names = resolveProviders().map((provider) => provider.name);
    expect(names).toEqual(["nvidia", "google"]);
  });

  it("is Google-only without an NVIDIA key", async () => {
    delete process.env.NVIDIA_API_KEY;
    const { resolveProviders } = await loadModules();
    const names = resolveProviders().map((provider) => provider.name);
    expect(names).toEqual(["google"]);
  });

  it("treats a blank NVIDIA key as absent", async () => {
    process.env.NVIDIA_API_KEY = "   ";
    const { resolveProviders } = await loadModules();
    expect(resolveProviders().map((provider) => provider.name)).toEqual(["google"]);
  });
});

describe("requestReviewDraft", () => {
  it("returns the NVIDIA draft without consulting Google", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(completion({ content: "I liked the friendly staff." })),
    );
    const { requestReviewDraft } = await loadModules();

    const result = await requestReviewDraft(PROMPT_INPUT);

    expect(result).toEqual({ ok: true, raw: "I liked the friendly staff." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Google when NVIDIA fails at the provider level", async () => {
    // NVIDIA returns a 503; Google is stubbed through the SDK-less path, so we
    // assert the chain advanced by observing the second attempt's error code.
    fetchMock.mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));
    const { requestReviewDraft } = await loadModules();

    const result = await requestReviewDraft(PROMPT_INPUT);

    // Google cannot reach a real key in this sandbox, so the request ultimately
    // fails — but the retry log proves NVIDIA was not the last word.
    expect(result.ok).toBe(false);
    const warned = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(warned).toContain("retrying");
    expect(warned).toContain("next=google");
  });

  it("does not retry after unusable NVIDIA content", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(completion({ content: null, finishReason: "length" })),
    );
    const { requestReviewDraft } = await loadModules();

    const result = await requestReviewDraft(PROMPT_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_INVALID_OUTPUT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not advance to Google after a fatal NVIDIA error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad request" }, 400));
    const { requestReviewDraft } = await loadModules();

    const result = await requestReviewDraft(PROMPT_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_PROVIDER_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks a provider name or key in the failure message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 400));
    const { requestReviewDraft } = await loadModules();

    const result = await requestReviewDraft(PROMPT_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toMatch(/nvidia|gemini|google|nvapi/i);
      expect(result.error.message).not.toContain(BASE_ENV.NVIDIA_API_KEY);
    }
  });
});