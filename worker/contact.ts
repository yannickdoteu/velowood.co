import { sendConfirmation, sendNotification } from "./email";
import type { Env } from "./env";
import i18n from "./generated/i18n.json";
import { type FieldErrors, normaliseLang, type RawSubmission, validate } from "./validate";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 32 * 1024;

type ErrorCode =
  | "validation"
  | "verification_failed"
  | "rate_limited"
  | "send_failed"
  | "server_error"
  | "invalid_request"
  | "forbidden_origin"
  | "method_not_allowed"
  | "unsupported_media_type";

/** Which no-JS error page each error code redirects to. */
const ERROR_PAGE: Record<ErrorCode, string> = {
  validation: "invalid",
  invalid_request: "invalid",
  verification_failed: "verification",
  rate_limited: "rate_limited",
  send_failed: "send_failed",
  server_error: "server",
  forbidden_origin: "server",
  method_not_allowed: "server",
  unsupported_media_type: "server",
};

/** Structured, PII-free log line. Never pass names, emails or message bodies here. */
function log(event: string, data: Record<string, string | number | boolean> = {}) {
  console.log(JSON.stringify({ event, ...data }));
}

interface Ctx {
  wantsJson: boolean;
  lang: string;
}

function langPath(lang: string) {
  return (i18n as Record<string, { path: string }>)[lang]?.path ?? "/";
}

function ok(ctx: Ctx, url: URL): Response {
  if (ctx.wantsJson) return Response.json({ ok: true });
  return Response.redirect(new URL(`${langPath(ctx.lang)}thanks/`, url).toString(), 303);
}

function fail(ctx: Ctx, url: URL, status: number, error: ErrorCode, extra: { fields?: FieldErrors } = {}): Response {
  if (ctx.wantsJson) return Response.json({ ok: false, error, ...extra }, { status });
  return Response.redirect(new URL(`${langPath(ctx.lang)}error/${ERROR_PAGE[error]}/`, url).toString(), 303);
}

async function parseBody(request: Request, type: "json" | "form"): Promise<RawSubmission | null> {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  if (type === "json") {
    try {
      const data = JSON.parse(raw);
      return data && typeof data === "object" && !Array.isArray(data) ? (data as RawSubmission) : null;
    } catch {
      return null;
    }
  }
  const p = new URLSearchParams(raw);
  return {
    name: p.get("name") ?? "",
    email: p.get("email") ?? "",
    role: p.get("role") ?? "",
    message: p.get("message") ?? "",
    consent: p.get("consent") ?? "",
    website: p.get("website") ?? "",
    lang: p.get("lang") ?? "",
    turnstileToken: p.get("cf-turnstile-response") ?? "",
  };
}

export async function verifyTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  body.append("idempotency_key", crypto.randomUUID());
  try {
    const res = await fetch(env.TURNSTILE_VERIFY_URL || SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      log("turnstile_http_error", { status: res.status });
      return false;
    }
    const outcome = (await res.json()) as { success: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
    if (!outcome.success) {
      log("turnstile_rejected", { codes: (outcome["error-codes"] ?? []).join(",") });
      return false;
    }
    const expected = (env.TURNSTILE_EXPECTED_HOSTNAMES ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    if (expected.length && !expected.includes(outcome.hostname ?? "")) {
      log("turnstile_hostname_mismatch");
      return false;
    }
    if (expected.length && outcome.action && outcome.action !== "contact") {
      log("turnstile_action_mismatch");
      return false;
    }
    return true;
  } catch (e) {
    log("turnstile_unreachable", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return false;
  }
}

export async function handleContact(request: Request, env: Env, exec: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const type = contentType === "application/json" ? "json" : contentType === "application/x-www-form-urlencoded" ? "form" : null;
  const accept = request.headers.get("Accept") || "";
  const ctx: Ctx = { wantsJson: type !== "form" || accept.includes("application/json"), lang: "en" };

  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  // Only accept submissions from the site itself.
  const origin = request.headers.get("Origin");
  if (!origin || origin !== url.origin) {
    log("contact_rejected", { reason: "origin" });
    return fail(ctx, url, 403, "forbidden_origin");
  }
  if (!type) return Response.json({ ok: false, error: "unsupported_media_type" }, { status: 415 });

  const raw = await parseBody(request, type);
  if (!raw) return fail(ctx, url, 400, "invalid_request");
  ctx.lang = normaliseLang(raw.lang);

  // Honeypot filled: pretend everything went fine, store and send nothing.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    log("contact_honeypot");
    return ok(ctx, url);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  const { success: allowed } = await env.CONTACT_RATE_LIMITER.limit({ key: `contact:${ip ?? "unknown"}` });
  if (!allowed) {
    log("contact_rate_limited");
    return fail(ctx, url, 429, "rate_limited");
  }

  const result = validate(raw);
  if (!result.ok) return fail(ctx, url, 422, "validation", { fields: result.fields });
  const s = result.value;

  if (!(await verifyTurnstile(env, s.turnstileToken, ip))) return fail(ctx, url, 403, "verification_failed");

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO contact_messages (id, created_at, lang, role, name, email, message, email_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
    )
      .bind(id, createdAt, s.lang, s.role, s.name, s.email, s.message)
      .run();
  } catch (e) {
    log("db_insert_failed", { id, error: e instanceof Error ? e.name : "unknown" });
    return fail(ctx, url, 500, "server_error");
  }

  let emailStatus: "sent" | "failed" = "sent";
  try {
    await sendNotification(env, s, id, createdAt);
  } catch (e) {
    emailStatus = "failed";
    log("email_failed", { id, code: String((e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown")) });
  }
  try {
    await env.DB.prepare("UPDATE contact_messages SET email_status = ? WHERE id = ?").bind(emailStatus, id).run();
  } catch {
    log("db_update_failed", { id });
  }

  if (emailStatus === "failed") return fail(ctx, url, 502, "send_failed");

  log("contact_received", { id, lang: s.lang, role: s.role });
  if (env.SEND_CONFIRMATION === "true") {
    exec.waitUntil(sendConfirmation(env, s).catch(() => log("confirmation_failed", { id })));
  }
  return ok(ctx, url);
}

/** Cron: delete messages older than 180 days (GDPR storage limit). */
export async function purgeOldMessages(env: Env): Promise<number> {
  const res = await env.DB.prepare(
    "DELETE FROM contact_messages WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-180 days')",
  ).run();
  const deleted = res.meta.changes ?? 0;
  log("purge_old_messages", { deleted });
  return deleted;
}
