import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { escapeHtml, notificationHtml } from "../worker/email";
import { purgeOldMessages } from "../worker/contact";
import type { Env } from "../worker/env";

type IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const req = (input: string, init?: RequestInit) => new Request(input, init) as unknown as IncomingRequest;

const ORIGIN = "https://velowood.co";
const URL_ = `${ORIGIN}/api/contact`;
let ipCounter = 0;

const valid = () => ({
  name: "Ada Rider",
  email: "ada@example.com",
  role: "hotel",
  message: "Hello, we would like to know more about your bicycles.",
  consent: true,
  website: "",
  lang: "nl",
  turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
});

interface Sent { from: unknown; to: unknown; replyTo: unknown; subject: string; text: string; html: string }

function makeEnv(overrides: Partial<Env> = {}) {
  const sent: Sent[] = [];
  const NOTIFY_EMAIL = { send: vi.fn(async (m: Sent) => { sent.push(m); return { messageId: "test" }; }) } as unknown as SendEmail;
  return { env: { ...env, NOTIFY_EMAIL, ...overrides } as Env, sent };
}

function mockTurnstile(success = true, extra: Record<string, unknown> = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const u = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (u.includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
      return Response.json(success ? { success: true, hostname: "example.com", "error-codes": [], ...extra } : { success: false, "error-codes": ["invalid-input-response"] });
    }
    throw new Error(`Unexpected fetch: ${u}`);
  });
}

async function post(body: unknown, opts: { env?: Env; ip?: string; type?: string; origin?: string | null; accept?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": opts.type ?? "application/json",
    "CF-Connecting-IP": opts.ip ?? `203.0.113.${++ipCounter}`,
    Accept: opts.accept ?? "application/json",
  };
  if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
  const request = req(URL_, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, opts.env ?? makeEnv().env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function rowCount() {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages").first<{ n: number }>();
  return r?.n ?? 0;
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM contact_messages");
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/contact", () => {
  it("accepts a valid submission, stores it and sends the notification", async () => {
    mockTurnstile(true);
    const { env: e, sent } = makeEnv();
    const res = await post(valid(), { env: e });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = await env.DB.prepare("SELECT * FROM contact_messages").first<Record<string, string>>();
    expect(row).toMatchObject({ lang: "nl", role: "hotel", name: "Ada Rider", email: "ada@example.com", email_status: "sent" });
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "steph@velowood.co",
      replyTo: "ada@example.com",
      subject: "[velowood website] Hotel — Ada Rider",
      from: { email: "website@forms.velowood.co", name: "velowood website" },
    });
    expect(sent[0].text).toContain("Hello, we would like to know more");
    expect(res.headers.get("Content-Security-Policy")).toContain("challenges.cloudflare.com");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("escapes every user value in the HTML email", async () => {
    mockTurnstile(true);
    const { env: e, sent } = makeEnv();
    const res = await post({ ...valid(), name: '<img src=x onerror="alert(1)">', message: "<script>alert('x')</script> and more text" }, { env: e });
    expect(res.status).toBe(200);
    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].html).not.toContain("<img src=x");
    expect(sent[0].html).toContain("&lt;script&gt;");
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(notificationHtml({ ...valid(), role: "press", lang: "en" } as never, "id", "now")).toContain("Press");
  });

  it("accepts form-encoded posts without JavaScript and redirects to the translated thank-you page", async () => {
    mockTurnstile(true);
    const form = new URLSearchParams({ name: "Bo", email: "bo@example.be", role: "rider", message: "A message long enough.", consent: "yes", website: "", lang: "fr", "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX" });
    const res = await post(form.toString(), { type: "application/x-www-form-urlencoded", accept: "text/html" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/fr/thanks/`);
    expect(await rowCount()).toBe(1);
  });

  it("returns field errors for invalid input, and stores nothing", async () => {
    mockTurnstile(true);
    const res = await post({ name: " ", email: "not-an-email", role: "ceo", message: "short", consent: false, lang: "en", turnstileToken: "x" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      error: "validation",
      fields: { name: "name_required", email: "email_invalid", role: "role_invalid", message: "message_too_short", consent: "consent_required" },
    });
    expect(await rowCount()).toBe(0);
  });

  it("enforces the length limits", async () => {
    mockTurnstile(true);
    const res = await post({ ...valid(), name: "x".repeat(101), message: "y".repeat(5001) });
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(body.fields).toEqual({ name: "name_too_long", message: "message_too_long" });
  });

  it("redirects no-JS validation errors to the translated error page", async () => {
    const form = new URLSearchParams({ name: "", email: "", role: "rider", message: "", lang: "el" });
    const res = await post(form.toString(), { type: "application/x-www-form-urlencoded", accept: "text/html" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/el/error/invalid/`);
  });

  it("silently succeeds when the honeypot is filled, without storing or sending", async () => {
    const fetchSpy = mockTurnstile(true);
    const { env: e, sent } = makeEnv();
    const res = await post({ ...valid(), website: "https://spam.example" }, { env: e });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await rowCount()).toBe(0);
    expect(sent).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rate-limits repeated submissions from one IP", async () => {
    mockTurnstile(true);
    const ip = "198.51.100.77";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await post(valid(), { ip })).status);
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
    const res = await post(valid(), { ip });
    expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
    // Another IP is not affected.
    expect((await post(valid())).status).toBe(200);
  });

  it("rejects a failed Turnstile check", async () => {
    mockTurnstile(false);
    const { env: e, sent } = makeEnv();
    const res = await post(valid(), { env: e });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(await rowCount()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("rejects a missing Turnstile token without calling siteverify", async () => {
    const fetchSpy = mockTurnstile(true);
    const res = await post({ ...valid(), turnstileToken: "" });
    expect(await res.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects tokens issued for another hostname when hostnames are configured", async () => {
    mockTurnstile(true, { hostname: "evil.example" });
    const { env: e } = makeEnv({ TURNSTILE_EXPECTED_HOSTNAMES: "velowood.co" });
    const res = await post(valid(), { env: e });
    expect(await res.json()).toEqual({ ok: false, error: "verification_failed" });
  });

  it("keeps the message and reports send_failed when the email cannot be sent", async () => {
    mockTurnstile(true);
    const failing = { send: vi.fn(async () => { throw Object.assign(new Error("boom"), { code: "E_DELIVERY_FAILED" }); }) } as unknown as SendEmail;
    const logSpy = vi.spyOn(console, "log");
    const { env: e } = makeEnv({ NOTIFY_EMAIL: failing });
    const res = await post(valid(), { env: e });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "send_failed" });
    const row = await env.DB.prepare("SELECT email_status FROM contact_messages").first<{ email_status: string }>();
    expect(row?.email_status).toBe("failed");
    // Logs never contain the visitor's email address or message.
    const logged = logSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("know more");
  });

  it("only accepts POST, JSON or form data, and the site's own origin", async () => {
    const ctx = createExecutionContext();
    const get = await worker.fetch(req(URL_, { method: "GET" }), makeEnv().env, ctx);
    expect(get.status).toBe(405);
    expect((await post("<x/>", { type: "text/xml" })).status).toBe(415);
    expect((await post(valid(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(valid(), { origin: null })).status).toBe(403);
    expect((await post("{not json")).status).toBe(400);
  });
});

describe("site", () => {
  it("serves HTML with security headers and the Turnstile site key filled in", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(req(`${ORIGIN}/?role=hotel`), makeEnv().env, ctx);
    expect(res.status).toBe(200);
    for (const h of ["Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "Permissions-Policy"]) {
      expect(res.headers.get(h)).toBeTruthy();
    }
    const html = await res.text();
    expect(html).toContain('data-sitekey="1x00000000000000000000AA"');
    expect(html).toMatch(/<option value="hotel" selected/);
  });

  it("redirects www to the apex", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(req("https://www.velowood.co/nl/?x=1"), makeEnv().env, ctx);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://velowood.co/nl/?x=1");
  });
});

describe("retention cron", () => {
  it("deletes messages older than 180 days and keeps newer ones", async () => {
    const old = new Date(Date.now() - 181 * 864e5).toISOString();
    const recent = new Date(Date.now() - 179 * 864e5).toISOString();
    for (const [id, at] of [["old", old], ["recent", recent]]) {
      await env.DB.prepare("INSERT INTO contact_messages (id, created_at, lang, role, name, email, message, email_status) VALUES (?, ?, 'en', 'rider', 'n', 'e@x.co', 'message!!', 'sent')").bind(id, at).run();
    }
    expect(await purgeOldMessages(env)).toBe(1);
    const ids = (await env.DB.prepare("SELECT id FROM contact_messages").all<{ id: string }>()).results.map((r) => r.id);
    expect(ids).toEqual(["recent"]);
  });
});
