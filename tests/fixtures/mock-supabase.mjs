#!/usr/bin/env node
/**
 * Minimal Supabase REST stand-in, for running the customer-journey E2E suite
 * without a real database.
 *
 * Usage: node tests/fixtures/mock-supabase.mjs [port]
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

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
  privacy_notice_version: "v2",
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

  if (url.pathname === "/__received" && req.method === "GET") {
    return send(res, 200, { feedback: received });
  }
  if (url.pathname === "/__reset" && req.method === "POST") {
    received.length = 0;
    return send(res, 200, { ok: true });
  }

  if (url.pathname.startsWith("/auth/v1/")) {
    return send(res, 401, { message: "no session" });
  }

  if (url.pathname === "/rest/v1/business_settings" && req.method === "GET") {
    return send(res, 200, shop);
  }

  if (url.pathname === "/rest/v1/feedback_submissions" && req.method === "POST") {
    const body = await readBody(req);
    const row = {
      id: randomUUID(),
      public_reference: `qrfb_${randomUUID().replaceAll("-", "")}`,
      ...(body && typeof body === "object" ? body : {}),
    };
    received.push({ table: "feedback_submissions", body: row });
    // Supabase .select().single() expects Prefer: return=representation.
    return send(res, 201, row);
  }

  if (url.pathname === "/rest/v1/analytics_events" && req.method === "POST") {
    const body = await readBody(req);
    received.push({ table: "analytics_events", body });
    res.writeHead(201, { "content-type": "application/json" });
    return res.end("");
  }

  if (url.pathname === "/rest/v1/admin_users" && req.method === "GET") {
    return send(res, 200, []);
  }

  return send(res, 404, { message: "not found in fixture", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-supabase] shop slug: ${shop.slug}`);
});
