import i18n from "./generated/i18n.json";

export const ROLES = ["rider", "hotel", "partner", "press", "other"] as const;
export type Role = (typeof ROLES)[number];
export const LANGS = Object.keys(i18n) as Array<keyof typeof i18n>;
export type Lang = (typeof LANGS)[number];

export const LIMITS = { name: 100, email: 254, messageMin: 10, messageMax: 5000, token: 2048 } as const;
// Same rule as the front end: something@something.tld, no whitespace.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// C0/C1 control characters except tab and newline (allowed in the message only).
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export interface RawSubmission {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  message?: unknown;
  consent?: unknown;
  website?: unknown;
  lang?: unknown;
  turnstileToken?: unknown;
}

export interface Submission {
  name: string;
  email: string;
  role: Role;
  message: string;
  lang: Lang;
  turnstileToken: string;
}

export type FieldErrors = Partial<Record<"name" | "email" | "role" | "message" | "consent", string>>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function normaliseLang(v: unknown): Lang {
  const s = str(v).toLowerCase();
  return (LANGS as string[]).includes(s) ? (s as Lang) : "en";
}

/** Server-side validation. Never trusts the browser. */
export function validate(raw: RawSubmission): { ok: true; value: Submission } | { ok: false; fields: FieldErrors } {
  const fields: FieldErrors = {};
  // Single-line values: strip control characters and line breaks (they end up in email headers).
  const name = str(raw.name).replace(CONTROL_RE, "").replace(/[\r\n\t]+/g, " ").trim();
  const email = str(raw.email).replace(CONTROL_RE, "").trim();
  const role = str(raw.role);
  const message = str(raw.message).replace(CONTROL_RE, "").replace(/\r\n?/g, "\n").trim();
  const consent = raw.consent === true || raw.consent === "yes" || raw.consent === "on" || raw.consent === "true";

  if (!name) fields.name = "name_required";
  else if (name.length > LIMITS.name) fields.name = "name_too_long";

  if (!email) fields.email = "email_required";
  else if (email.length > LIMITS.email || /[\r\n]/.test(email) || !EMAIL_RE.test(email)) fields.email = "email_invalid";

  if (!(ROLES as readonly string[]).includes(role)) fields.role = "role_invalid";

  if (!message) fields.message = "message_required";
  else if ([...message].length < LIMITS.messageMin) fields.message = "message_too_short";
  else if ([...message].length > LIMITS.messageMax) fields.message = "message_too_long";

  if (!consent) fields.consent = "consent_required";

  if (Object.keys(fields).length) return { ok: false, fields };
  return {
    ok: true,
    value: {
      name,
      email,
      role: role as Role,
      message,
      lang: normaliseLang(raw.lang),
      turnstileToken: str(raw.turnstileToken).slice(0, LIMITS.token),
    },
  };
}
