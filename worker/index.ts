import { handleContact, purgeOldMessages } from "./contact";
import type { Env } from "./env";
import { ROLES } from "./validate";

const TURNSTILE = "https://challenges.cloudflare.com";

/** Security headers for every response the Worker produces (HTML pages and the API). */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
};

function withSecurityHeaders(res: Response, https: boolean): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if (https) out.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return out;
}

/** Fill in the Turnstile site key and, for ?role=hotel links without JavaScript, preselect the role. */
function rewriteHtml(res: Response, env: Env, url: URL): Response {
  const role = url.searchParams.get("role");
  let rw = new HTMLRewriter().on("[data-sitekey]", {
    element(el) {
      el.setAttribute("data-sitekey", env.TURNSTILE_SITE_KEY);
    },
  });
  if (role && (ROLES as readonly string[]).includes(role)) {
    rw = rw.on(`#cf-role option[value="${role}"]`, {
      element(el) {
        el.setAttribute("selected", "");
      },
    });
  }
  return rw.transform(res);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const https = url.protocol === "https:";

    // One canonical host: www → apex.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/contact") {
      const res = withSecurityHeaders(await handleContact(request, env, ctx), https);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    if (url.pathname.startsWith("/api/")) {
      return withSecurityHeaders(Response.json({ ok: false, error: "not_found" }, { status: 404 }), https);
    }

    let res = await env.ASSETS.fetch(request);
    if ((res.headers.get("Content-Type") || "").includes("text/html")) {
      res = rewriteHtml(res, env, url);
    }
    return withSecurityHeaders(res, https);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeOldMessages(env));
  },
} satisfies ExportedHandler<Env>;
