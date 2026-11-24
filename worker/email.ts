import type { Env } from "./env";
import i18n from "./generated/i18n.json";
import type { Submission } from "./validate";

/** Escape every user value before it goes into HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const roleLabel = (s: Submission) => i18n.en.roles[s.role];

export function notificationSubject(s: Submission): string {
  return `[velowood website] ${roleLabel(s)} — ${s.name}`;
}

export function notificationText(s: Submission, id: string, createdAt: string): string {
  return [
    "New message from the velowood website contact form.",
    "",
    `Name:     ${s.name}`,
    `Email:    ${s.email}`,
    `Role:     ${roleLabel(s)}`,
    `Language: ${s.lang}`,
    `Received: ${createdAt}`,
    `ID:       ${id}`,
    "",
    "Message:",
    s.message,
    "",
    "Reply to this email to answer the visitor directly.",
  ].join("\n");
}

export function notificationHtml(s: Submission, id: string, createdAt: string): string {
  const row = (k: string, v: string) =>
    `<tr><th align="left" style="padding:4px 16px 4px 0;color:#6e5847;font-weight:600">${k}</th><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#faf7f2;color:#47270e;font:16px/1.6 -apple-system,Segoe UI,sans-serif">
<p style="margin:0 0 16px">New message from the velowood website contact form.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${row("Name", s.name)}${row("Email", s.email)}${row("Role", roleLabel(s))}${row("Language", s.lang)}${row("Received", createdAt)}${row("ID", id)}
</table>
<p style="margin:24px 0 8px;font-weight:600">Message</p>
<div style="white-space:pre-wrap;padding:16px;background:#ffffff;border:1px solid #e4d9c9;border-radius:4px">${escapeHtml(s.message)}</div>
<p style="margin:24px 0 0;color:#6e5847;font-size:14px">Reply to this email to answer the visitor directly.</p>
</body></html>`;
}

/** Notification to the team, via the send_email binding (Email Routing; destination must be verified). */
export async function sendNotification(env: Env, s: Submission, id: string, createdAt: string): Promise<void> {
  await env.NOTIFY_EMAIL.send({
    from: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME },
    to: env.MAIL_TO,
    replyTo: s.email,
    subject: notificationSubject(s),
    text: notificationText(s, id, createdAt),
    html: notificationHtml(s, id, createdAt),
  });
}

function confirmation(s: Submission) {
  const t = (i18n[s.lang] ?? i18n.en).email;
  const text = `${t.confirmGreeting} ${s.name},\n\n${t.confirmBody}\n\n${t.confirmCopyIntro}\n\n${s.message}\n\n— ${t.confirmSignoff}\n`;
  const html = `<!doctype html><html lang="${s.lang}"><body style="margin:0;padding:24px;background:#faf7f2;color:#47270e;font:16px/1.6 -apple-system,Segoe UI,sans-serif">
<p>${escapeHtml(t.confirmGreeting)} ${escapeHtml(s.name)},</p><p>${escapeHtml(t.confirmBody)}</p>
<p style="margin-top:24px;color:#6e5847">${escapeHtml(t.confirmCopyIntro)}</p>
<div style="white-space:pre-wrap;padding:16px;background:#ffffff;border:1px solid #e4d9c9;border-radius:4px">${escapeHtml(s.message)}</div>
<p style="margin-top:24px">— ${escapeHtml(t.confirmSignoff)}</p></body></html>`;
  return { subject: t.confirmSubject, text, html };
}

/**
 * Optional confirmation email to the visitor, behind SEND_CONFIRMATION (default "false").
 * - CONFIRMATION_TRANSPORT="smtp": sends through your own mailbox provider (e.g. Migadu) over SMTP with
 *   Workers TCP sockets. Works on the Workers Free plan.
 * - CONFIRMATION_TRANSPORT="email-service": Cloudflare Email Sending (beta, Workers Paid plan, onboarded domain).
 */
export async function sendConfirmation(env: Env, s: Submission): Promise<void> {
  if (env.SEND_CONFIRMATION !== "true") return;
  const { subject, text, html } = confirmation(s);
  const from = { email: env.CONFIRM_FROM || env.MAIL_FROM, name: "velowood" };

  if (env.CONFIRMATION_TRANSPORT === "email-service") {
    if (!env.CONFIRM_EMAIL) throw new Error("CONFIRM_EMAIL binding missing");
    await env.CONFIRM_EMAIL.send({ from, to: s.email, replyTo: env.MAIL_TO, subject, text, html });
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error("SMTP settings missing");
  const { WorkerMailer, LogLevel } = await import("worker-mailer");
  const port = Number(env.SMTP_PORT || 465);
  const mailer = await WorkerMailer.connect({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    startTls: port !== 465,
    credentials: { username: env.SMTP_USER, password: env.SMTP_PASSWORD },
    authType: "plain",
    logLevel: LogLevel.NONE, // never log addresses or bodies
  });
  try {
    await mailer.send({ from, to: s.email, reply: env.MAIL_TO, subject, text, html });
  } finally {
    await mailer.close();
  }
}
