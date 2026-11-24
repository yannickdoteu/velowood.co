export default {
  url: "https://velowood.co",
  email: "steph@velowood.co",
  // Error pages for the no-JavaScript form fallback (the Worker redirects to /<lang>/error/<code>/).
  errorCodes: ["invalid", "verification", "rate_limited", "send_failed", "server"],
  // Turnstile site key placeholder; the Worker replaces it at request time with the TURNSTILE_SITE_KEY variable.
  turnstilePlaceholder: "__TURNSTILE_SITE_KEY__",
};
