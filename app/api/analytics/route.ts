import { recordEvent } from "@/lib/analytics";
import { apiOk, guardOrigin, readJsonBody } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { analyticsEventSchema } from "@/lib/validation";

/**
 * POST /api/analytics
 *
 * Accepts an allowlisted event name and nothing else. `.strict()` on the schema
 * rejects any extra field, so this endpoint cannot be turned into a channel for
 * free text, ratings, or identifiers.
 *
 * Always returns `{ success: true }`. The client is firing this alongside a
 * navigation; a 4xx would only invite a retry storm, and there is nothing the
 * customer could usefully do about it.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  // Cross-site analytics spam is dropped without explanation.
  if (originError) return apiOk({});

  // Validation before the limiter: a malformed event should not consume a
  // legitimate caller's budget, and there is nothing to protect the DB from
  // until the body is known to be a single allowlisted event name.
  const body = await readJsonBody(request);
  if (!body.ok) return apiOk({});

  const parsed = analyticsEventSchema.safeParse(body.data);
  if (!parsed.success) return apiOk({});

  const rate = await checkRateLimit("analytics", request);
  if (!rate.allowed) return apiOk({});

  await recordEvent(parsed.data.eventName);

  return apiOk({});
}
