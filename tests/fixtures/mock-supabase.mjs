#!/usr/bin/env node
/**
 * Minimal Supabase REST stand-in, for running the customer-journey E2E suite
 * without a real database.
 *
 * It implements exactly the surface the app touches:
 *   GET  /rest/v1/business_settings?select=...&id=eq.1   -> one shop row
 *   POST /rest/v1/feedback_submissions                   -> 201
 *   POST /rest/v1/analytics_events                       -> 201
 *
 * This is a test fixture, not a product. It is never imported by app code and
 * is not wired into any deployment. It exists so the E2E suite can assert on
 * real rendering of real shop data instead of skipping the whole journey.
 *
 * Usage: node tests/fixtures/mock-supabase.mjs [port]
 */

import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 54321);
const BUSINESS_ID = 1;

const shop = {
  id: BUSINESS_ID,
  name: "Green Grocers",
  slug: "shop",
  logo_url: null,
  primary_color: "#245C44",
  welcome_title: "Thank you for visiting!",
  welcome_message: "We'd love to hear about your experience.",
  google_review_url: "https://g.page/r/e2e-test/review",
  privacy_notice_version: "v1",
  contact_email: "owner@example.com",
  contact_address: "12 Market Road, Pune",
  created_at: new Date("2026-01-01T00:00:00Z").toISOString(),
  updated_at: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const received = [];

function send(res, status, body, contentType = "application/json") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  // Test introspection: lets a spec assert a row was actually persisted.
  if (url.pathname === "/__received" && req.method === "GET") {
    return send(res, 200, { feedback: received });
  }
  if (url.pathname === "/__reset" && req.method === "POST") {
    received.length = 0;
    return send(res, 200, { ok: true });
  }

  if (url.pathname.startsWith("/auth/v1/")) {
    // No session in the fixture; the app must treat this as unauthenticated.
    return send(res, 401, { message: "no session" });
  }

  if (url.pathname === "/rest/v1/business_settings" && req.method === "GET") {
    // Honour the id filter the client sends; anything else gets the row too,
    // since this fixture only models a single-business deployment.
    return send(res, 200, shop);
  }

  if (url.pathname === "/rest/v1/feedback_submissions" && req.method === "POST") {
    const body = await readBody(req);
    received.push({ table: "feedback_submissions", body });
    // PostgREST returns 201 with no body unless Prefer: return=representation.
    res.writeHead(201, { "content-type": "application/json" });
    return res.end("");
  }

  if (url.pathname === "/rest/v1/analytics_events" && req.method === "POST") {
    const body = await readBody(req);
    received.push({ table: "analytics_events", body });
    res.writeHead(201, { "content-type": "application/json" });
    return res.end("");
  }

  if (url.pathname === "/rest/v1/admin_users" && req.method === "GET") {
    // Empty result: nobody is allowlisted in the fixture.
    return send(res, 200, []);
  }

  return send(res, 404, { message: "not found in fixture", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-supabase] shop slug: ${shop.slug}`);
});
