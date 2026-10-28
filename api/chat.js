/* nourhan-portfolio · api/chat.js
 * ============================================================
 * POST /api/chat — the AI Recruiter backend (Vercel Serverless).
 *
 * WHY THIS EXISTS
 *   The Gemini API key must never reach the browser. This function
 *   is the only place it is read, from a server-side environment
 *   variable, and it is the only thing the frontend can call.
 *
 * CONTRACT
 *   Request  { message: string, history?: [{role, text}, ...] }
 *   Success  { reply: string }
 *   Failure  { error: string, code: string }   (never a stack trace)
 *
 * RESEARCH NOTE (verified 2026-10)
 *   Endpoint:   POST https://generativelanguage.googleapis.com/v1beta/
 *               models/{MODEL}:generateContent
 *   Auth:       x-goog-api-key header
 *   Body:       { systemInstruction: {parts:[{text}]}, contents:[...],
 *                 generationConfig:{...} }
 *   Model name: configurable via GEMINI_MODEL; default gemini-3.5-flash.
 *
 * ZERO DEPENDENCIES — uses the built-in global fetch (Node 18+ on
 * Vercel). No npm install, no bundled SDK, no lockfile churn.
 * ============================================================ */

'use strict';

const { buildSystemPrompt } = require('./_prompt.js');
const KNOWLEDGE = require('./_knowledge.js');
const rateLimit = require('./_rate-limit.js');

/* ---- limits -------------------------------------------------- */
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 8; // user+assistant pairs kept for context
const MAX_HISTORY_CHARS = 6000; // cumulative cap on history text
const MAX_OUTPUT_TOKENS = 700;
const UPSTREAM_TIMEOUT_MS = 20000;

const DEFAULT_MODEL = 'gemini-3.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

/* ---- helpers ------------------------------------------------- */

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  /* The chat response is per-visitor and must never be cached. */
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function fail(res, status, code, message) {
  send(res, status, { error: message, code: code });
}

/* Read and parse the JSON body with a hard size ceiling, so a huge
   or malformed payload can never reach the model call. */
function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) {
      /* Vercel's Node parser usually pre-parses JSON into req.body. */
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body));
        } catch (e) {
          return resolve(null);
        }
      }
      return resolve(req.body);
    }
    let raw = '';
    let tooBig = false;
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 20000) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', function () {
      if (tooBig) return resolve(null);
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve(null);
      }
    });
    req.on('error', function () {
      resolve(null);
    });
  });
}

/* Normalise the history the client sent: keep only user/model roles,
   trim, cap the number of turns and the total characters. Anything
   unexpected is dropped rather than passed to the model. */
function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  const clean = [];
  for (let i = 0; i < input.length; i++) {
    const turn = input[i];
    if (!turn || typeof turn !== 'object') continue;
    const role = turn.role === 'assistant' || turn.role === 'model'
      ? 'model'
      : turn.role === 'user'
        ? 'user'
        : null;
    const text = typeof turn.text === 'string' ? turn.text.trim() : '';
    if (!role || !text) continue;
    clean.push({ role: role, text: text });
  }
  /* Keep the most recent turns only. */
  const trimmed = clean.slice(-MAX_HISTORY_TURNS * 2);

  /* Enforce the cumulative character cap from the end backwards. */
  let total = 0;
  const bounded = [];
  for (let j = trimmed.length - 1; j >= 0; j--) {
    const len = trimmed[j].text.length;
    if (total + len > MAX_HISTORY_CHARS) break;
    total += len;
    bounded.unshift(trimmed[j]);
  }
  return bounded;
}

/* Map sanitized history to the Gemini `contents` shape. */
function toContents(history, message) {
  const contents = [];
  history.forEach(function (turn) {
    contents.push({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    });
  });
  contents.push({ role: 'user', parts: [{ text: message }] });
  return contents;
}

/* Pull the first text part out of a Gemini response, defensively. */
function extractText(data) {
  if (!data || !Array.isArray(data.candidates) || !data.candidates.length) {
    return '';
  }
  const candidate = data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  if (!Array.isArray(parts)) return '';
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && typeof parts[i].text === 'string') out += parts[i].text;
  }
  return out.trim();
}

/* ---- the handler -------------------------------------------- */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed', 'Use POST.');
  }

  /* 1. rate limit ------------------------------------------------ */
  const limit = rateLimit.check(req);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return fail(
      res,
      429,
      'rate_limited',
      'Too many messages. Please wait a moment and try again.'
    );
  }

  /* 2. body ------------------------------------------------------ */
  const body = await readBody(req);
  if (!body || typeof body !== 'object') {
    return fail(res, 400, 'bad_request', 'Invalid request body.');
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return fail(res, 400, 'empty_message', 'Please type a question.');
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return fail(
      res,
      400,
      'message_too_long',
      'Please keep your question under ' + MAX_MESSAGE_CHARS + ' characters.'
    );
  }

  const history = sanitizeHistory(body.history);

  /* 3. credentials ---------------------------------------------- */
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    /* Honest configuration error — never fake an answer. */
    console.error('[ai-recruiter] GEMINI_API_KEY is not set');
    return fail(
      res,
      503,
      'not_configured',
      'The AI Recruiter is not configured yet. Please use the contact details instead.'
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  /* 4. call the model ------------------------------------------- */
  const payload = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(KNOWLEDGE.KNOWLEDGE_TEXT) }],
    },
    contents: toContents(history, message),
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(API_BASE + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === 'AbortError';
    console.error('[ai-recruiter] upstream fetch failed:', aborted ? 'timeout' : err && err.message);
    return fail(
      res,
      502,
      aborted ? 'timeout' : 'upstream_unreachable',
      'The assistant is temporarily unavailable. Please try again shortly.'
    );
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    /* Read the provider error for the server log only — never for the
       client. A bad key or an unavailable model must not leak detail. */
    let detail = '';
    try {
      detail = await upstream.text();
    } catch (e) {
      detail = '';
    }
    console.error(
      '[ai-recruiter] provider error',
      upstream.status,
      detail.slice(0, 400)
    );
    if (upstream.status === 429) {
      /* Free-tier quota wall. The assistant is rationed, not broken, so
         instead of a dead "busy" bubble the visitor gets a real, factual
         answer drawn from the SAME verified knowledge that grounds the
         model. Only this status degrades; every other error passes through
         honest and short. See pickFallback() at the bottom of this file. */
      return send(res, 200, { reply: pickFallback(message) });
    }
    return fail(
      res,
      502,
      'provider_error',
      'The assistant could not answer that right now. Please try again shortly.'
    );
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return fail(res, 502, 'bad_upstream_response', 'The assistant returned an unreadable response.');
  }

  const reply = extractText(data);
  if (!reply) {
    /* Usually a safety block or an empty candidate. Say so honestly. */
    /* A 200 with an honest "no answer" is friendlier than an error for
       this case, so the panel shows a normal assistant bubble. */
    return send(res, 200, {
      reply:
        "I couldn't answer that one. Try rephrasing, or use the contact " +
        'details below to ask directly.',
    });
  }

  return send(res, 200, { reply: reply });
};

/* ============================================================
 * Graceful degrade for the free-tier quota wall (429 only).
 *
 * The free Gemini tier is capped at ~20 requests/day per project. When the
 * provider answers 429 RESOURCE_EXHAUSTED the assistant is not broken — it
 * is rationed — so instead of a dead "busy" bubble the visitor gets a real,
 * factual answer drawn from the SAME verified knowledge that grounds the
 * model (api/_knowledge.js). Nothing is invented: these are the very facts
 * the model would have been handed.
 *
 * This runs ONLY on a provider 429. A valid model reply always wins, so the
 * moment the quota resets the real AI answers again with no code change.
 * ============================================================ */
function pickFallback(message) {
  const q = String(message || '').toLowerCase();
  const has = (words) => words.some((w) => q.indexOf(w) !== -1);

  if (has(['contact', 'email', 'reach', 'hire', 'phone', 'whatsapp', 'linkedin', 'github', 'connect', 'to reach'])) {
    return (
      'You can reach Nourhan directly:\n\n' +
      '- Email: ' + KNOWLEDGE.PROFILE.email + '\n' +
      '- Phone: ' + KNOWLEDGE.PROFILE.phone + '\n' +
      '- LinkedIn: ' + KNOWLEDGE.PROFILE.links.linkedin + '\n' +
      '- GitHub: ' + KNOWLEDGE.PROFILE.links.github
    );
  }

  if (has(['project', 'built', 'build', 'tcg', 'vault', 'hatar', 'social culture', 'agency'])) {
    const lines = ['Here is the verified project work on record:'];
    KNOWLEDGE.PROJECTS.forEach(function (p) {
      lines.push('');
      lines.push('**' + p.name + '** — ' + p.kind);
      lines.push(p.overview);
      lines.push('Stack: ' + p.stack.join(', '));
    });
    return lines.join('\n');
  }

  if (has(['skill', 'stack', 'technolog', 'tech', 'know', 'good at', 'expert'])) {
    const S = KNOWLEDGE.SKILLS;
    return (
      'Nourhan\u2019s strongest areas are:\n\n' +
      '- Frontend: ' + S.frontend.join(', ') + '\n' +
      '- Backend: ' + S.backend.join(', ') + '\n' +
      '- E-Commerce: ' + S.ecommerce.join(', ') + '\n' +
      '- Security: ' + S.security.join(', ')
    );
  }

  if (has(['experience', 'work', 'job', 'career', 'freelance', 'role'])) {
    const lines = ['Her documented experience:'];
    KNOWLEDGE.EXPERIENCE.forEach(function (e) {
      lines.push('');
      lines.push('**' + e.role + '** — ' + e.company + ' (' + e.period + ')');
      e.points.forEach(function (pt) {
        lines.push('- ' + pt);
      });
    });
    return lines.join('\n');
  }

  if (has(['education', 'degree', 'study', 'university', 'language'])) {
    return (
      'Education on record:\n\n- ' + KNOWLEDGE.EDUCATION_AND_LANGUAGES.join('\n- ')
    );
  }

  /* No keyword matched — offer a map of what IS answerable, and be honest
     that the live model is resting. */
  return (
    'I can answer from Nourhan\u2019s verified portfolio. Try asking about:\n\n' +
    '- Her strongest technical skills\n' +
    '- A specific project (e.g. TCG Vault or Social Culture)\n' +
    '- Her professional experience\n' +
    '- Her education\n' +
    '- How to contact her\n\n' +
    '(The live AI is momentarily rate-limited on the free tier; these answers ' +
    'come from the same verified facts it uses.)'
  );
}
