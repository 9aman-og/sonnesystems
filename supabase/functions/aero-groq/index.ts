/*
 * Aero cloud-safe reasoning gateway.
 *
 * The deployment requires Supabase JWT verification. It accepts only the
 * current prompt, never the Lyfe context pack, Gmail, memory, imported files,
 * or conversation history. GROQ_API_KEY and AERO_ALLOWED_EMAILS are hosted
 * Edge Function secrets and must never be added to the browser bundle.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_BODY_BYTES = 16_000;
const MAX_PROMPT_CHARS = 4_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 20;
const ALLOWED_ORIGINS = new Set([
  "https://sonnesystems.com",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:8773",
  "http://localhost:4173",
]);

const ACTION_TYPES = [
  "add_task", "complete_task", "add_note", "add_doc", "log_work",
  "add_goal", "add_education", "add_project", "memory_upsert", "memory_forget",
];

const responseSchema = {
  name: "aero_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      bubbles: {
        type: "array",
        maxItems: 4,
        items: { type: "string", maxLength: 1_000 },
      },
      actions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ACTION_TYPES },
            title: { type: ["string", "null"] },
            name: { type: ["string", "null"] },
            body: { type: ["string", "null"] },
            text: { type: ["string", "null"] },
            claim: { type: ["string", "null"] },
            query: { type: ["string", "null"] },
            scope: { type: ["string", "null"] },
            memoryType: { type: ["string", "null"] },
            due: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            hours: { type: ["number", "null"] },
            area: { type: ["string", "null"] },
            priority: { type: ["string", "null"] },
          },
          required: [
            "type", "title", "name", "body", "text", "claim", "query",
            "scope", "memoryType", "due", "date", "hours", "area", "priority",
          ],
        },
      },
      assumption: { type: ["string", "null"] },
    },
    required: ["bubbles", "actions", "assumption"],
  },
};

const systemPrompt = `You are the cloud-safe reasoning specialist used by Aero inside Lyfe.
Lead with the answer. Be concise, natural, and precise. Never claim access to Lyfe, Gmail, notes, tasks, memory, files, accounts, browsing, or previous conversations. You receive only the current prompt and date.

You may propose reversible Lyfe changes using the response actions array. The local Aero action engine validates every action and the user must approve it. Never claim an action has already happened. Never propose sending messages, spending money, publishing, deleting external data, or other irreversible external actions.

Use memory_upsert only when the user explicitly asks Aero to remember something. If information is missing and materially changes the answer, ask one focused question. Keep bubbles under four short paragraphs.`;

const buckets = new Map<string, number[]>();

function headers(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://sonnesystems.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(origin: string | null, status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: headers(origin) });
}

function text(value: unknown, max = 1_000) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function claimsFromAuthorization(value: string | null) {
  try {
    const token = String(value || "").replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    const claims = JSON.parse(decoded);
    return claims && claims.sub ? claims : null;
  } catch (_) {
    return null;
  }
}

function allowedEmail(email: unknown) {
  const allowlist = String(Deno.env.get("AERO_ALLOWED_EMAILS") || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(String(email || "").trim().toLowerCase());
}

function withinRateLimit(subject: string) {
  const now = Date.now();
  const recent = (buckets.get(subject) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= REQUESTS_PER_WINDOW) return false;
  recent.push(now);
  buckets.set(subject, recent);
  return true;
}

async function opaqueUserId(subject: string) {
  const bytes = new TextEncoder().encode(subject);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "aero_" + Array.from(digest.slice(0, 12)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanResult(value: unknown) {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const bubbles = Array.isArray(raw.bubbles)
    ? raw.bubbles.map((item) => text(item, 1_000)).filter(Boolean).slice(0, 4)
    : [];
  const actions = Array.isArray(raw.actions)
    ? raw.actions.filter((item) => {
      return item && typeof item === "object" && ACTION_TYPES.includes(String((item as Record<string, unknown>).type || ""));
    }).slice(0, 8)
    : [];
  return {
    bubbles: bubbles.length ? bubbles : ["I need one more detail."],
    actions,
    assumption: text(raw.assumption, 500) || "",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });
    return new Response("ok", { headers: headers(origin) });
  }
  if (req.method !== "POST") return json(origin, 405, { error: "method_not_allowed" });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });

  const claims = claimsFromAuthorization(req.headers.get("authorization"));
  if (!claims || !allowedEmail(claims.email)) return json(origin, 403, { error: "not_allowed" });
  if (!withinRateLimit(String(claims.sub))) return json(origin, 429, { error: "rate_limited" });

  const declaredSize = Number(req.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return json(origin, 413, { error: "request_too_large" });

  let rawBody = "";
  let payload: Record<string, unknown>;
  try {
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) return json(origin, 413, { error: "request_too_large" });
    payload = JSON.parse(rawBody);
  } catch (_) {
    return json(origin, 400, { error: "invalid_json" });
  }

  const prompt = text(payload.prompt, MAX_PROMPT_CHARS);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || "")) ? String(payload.date) : new Date().toISOString().slice(0, 10);
  const kind = text(payload.kind, 40) || "general";
  if (!prompt) return json(origin, 400, { error: "prompt_required" });

  const groqKey = String(Deno.env.get("GROQ_API_KEY") || "");
  if (!groqKey) return json(origin, 503, { error: "provider_not_configured" });

  const model = String(Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let upstream: Response;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Date: ${date}\nIntent family: ${kind}\n\n${prompt}` },
        ],
        response_format: { type: "json_schema", json_schema: responseSchema },
        reasoning_effort: kind === "research" || kind === "general" ? "medium" : "low",
        max_completion_tokens: 1_200,
        user: await opaqueUserId(String(claims.sub)),
      }),
    });
  } catch (_) {
    return json(origin, 503, { error: "provider_unavailable" });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    console.error("Aero Groq upstream status", upstream.status);
    return json(origin, upstream.status === 429 ? 429 : 503, {
      error: upstream.status === 429 ? "provider_rate_limited" : "provider_unavailable",
    });
  }

  try {
    const completion = await upstream.json();
    const content = completion?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(String(content || "{}"));
    return json(origin, 200, {
      result: cleanResult(parsed),
      provider: "groq",
      model: text(completion?.model || model, 120),
      usage: {
        input: Number(completion?.usage?.prompt_tokens || 0),
        output: Number(completion?.usage?.completion_tokens || 0),
      },
    });
  } catch (_) {
    return json(origin, 502, { error: "invalid_provider_response" });
  }
});
