import { describe, expect, it } from "vitest";
import { isSameOrigin, readJsonBody, MAX_BODY_BYTES } from "@/lib/http";

function jsonRequest(
  body: string,
  headers: Record<string, string> = { "content-type": "application/json" },
): Request {
  return new Request("https://shop.example.com/api/feedback", {
    method: "POST",
    headers,
    body,
  });
}

describe("readJsonBody", () => {
  it("parses a well-formed JSON body", async () => {
    const result = await readJsonBody(jsonRequest('{"rating":5}'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ rating: 5 });
  });

  it("rejects a non-JSON content type before reading", async () => {
    const request = new Request("https://shop.example.com/api/feedback", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: '{"rating":5}',
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(415);
  });

  it("rejects a body declared larger than the cap", async () => {
    const oversized = JSON.stringify({ feedbackText: "x".repeat(MAX_BODY_BYTES) });
    const result = await readJsonBody(jsonRequest(oversized));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rejects an undersized-but-actually-huge body", async () => {
    // No content-length header at all; the byte check must still catch it.
    const oversized = JSON.stringify({ feedbackText: "x".repeat(MAX_BODY_BYTES + 10) });
    const request = new Request("https://shop.example.com/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rejects malformed JSON", async () => {
    const result = await readJsonBody(jsonRequest("{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("rejects an empty body", async () => {
    const result = await readJsonBody(jsonRequest(""));
    expect(result.ok).toBe(false);
  });

  it("accepts a body with a charset suffix on the content type", async () => {
    const result = await readJsonBody(
      jsonRequest('{"a":1}', { "content-type": "application/json; charset=utf-8" }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("isSameOrigin", () => {
  it("allows a request with no origin and no cross-site signal", () => {
    const request = new Request("https://shop.example.com/api/analytics", {
      method: "POST",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("allows a same-origin request", () => {
    const request = new Request("https://shop.example.com/api/analytics", {
      method: "POST",
      headers: { origin: "https://shop.example.com" },
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects a foreign origin", () => {
    const request = new Request("https://shop.example.com/api/analytics", {
      method: "POST",
      headers: { origin: "https://evil.example.net" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects a cross-site fetch signal even without an Origin header", () => {
    const request = new Request("https://shop.example.com/api/analytics", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("treats a same-site subrequest as allowed", () => {
    const request = new Request("https://shop.example.com/api/analytics", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(isSameOrigin(request)).toBe(true);
  });
});
