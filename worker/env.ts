export interface Env {
  /** The built static site (./dist). */
  ASSETS: Fetcher;
  /** D1 database holding contact_messages (rows are deleted after 180 days by the cron trigger). */
  DB: D1Database;
  /** Workers Rate Limiting binding, keyed by visitor IP. */
  CONTACT_RATE_LIMITER: RateLimit;
  /** send_email binding restricted to the verified destination address (Email Routing, free on every plan). */
  NOTIFY_EMAIL: SendEmail;
  /** Optional, unrestricted send_email binding for confirmations (needs Email Sending, Workers Paid). */
  CONFIRM_EMAIL?: SendEmail;

  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  /** Comma-separated hostnames that Turnstile tokens must come from, e.g. "velowood.co,www.velowood.co". Empty = skip. */
  TURNSTILE_EXPECTED_HOSTNAMES?: string;
  /** Local development only: override the siteverify URL (e.g. a relay in a sandbox without DNS). Leave unset in production. */
  TURNSTILE_VERIFY_URL?: string;

  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
  MAIL_TO: string;

  /** "true" turns on the visitor confirmation email. Off by default. */
  SEND_CONFIRMATION?: string;
  /** "smtp" (free: your mailbox provider over SMTP, e.g. Migadu) or "email-service" (Cloudflare Email Sending, Workers Paid). */
  CONFIRMATION_TRANSPORT?: string;
  CONFIRM_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
}
