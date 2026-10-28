/* nourhan-portfolio · api/_rate-limit.js
 * ============================================================
 * A small fixed-window rate limiter for the chat endpoint.
 *
 * WHY IN-MEMORY IS ACCEPTABLE HERE
 *   Vercel runs each serverless instance in its own short-lived
 *   process, so this Map is per-instance and resets on cold start:
 *   it is a burst guard, not a hard global quota. It reliably stops
 *   the realistic abuse case — one client hammering the endpoint —
 *   without adding Redis or another dependency. The real cost
 *   ceiling is the provider's own usage limit, which should be set
 *   in the Google AI Studio / Cloud console as well.
 *
 * KEYED BY IP
 *   Vercel sets x-forwarded-for; we take the first hop. Behind a
 *   different proxy, adjust clientKey().
 * ============================================================ */

'use strict';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 12; // per IP per window
const MAX_ENTRIES = 5000; // bound the Map so it cannot grow forever

const hits = new Map(); // ip -> { count, resetAt }

function clientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length) return real;
  const sock = req.socket && req.socket.remoteAddress;
  return sock || 'unknown';
}

/* Returns { ok: true } or { ok: false, retryAfter: seconds }. */
function check(req) {
  const now = Date.now();
  const key = clientKey(req);

  /* Opportunistic sweep: drop expired entries when the Map is big,
     so a long-lived warm instance does not leak. */
  if (hits.size > MAX_ENTRIES) {
    hits.forEach(function (entry, k) {
      if (entry.resetAt <= now) hits.delete(k);
    });
    if (hits.size > MAX_ENTRIES) hits.clear();
  }

  let entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

module.exports = { check: check, clientKey: clientKey, MAX_REQUESTS: MAX_REQUESTS };
