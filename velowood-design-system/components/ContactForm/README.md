# ContactForm

The contact form that sits inside the walnut Contact panel (see `Contact`). Name, email, role, message and a consent box, then one light button. It works without JavaScript (a normal `POST`) and is enhanced by `site.js` (inline errors, a live success message).

- Provide: a `form.vw-form.vw-form--on-walnut` with `action="/api/contact" method="post"` and `data-contact-form`. Inside, in this order: a `vw-form__status` error summary, a `vw-form__row` with the name and email fields, the role `vw-select`, the message `vw-textarea`, the consent `vw-check`, the honeypot, a hidden `lang` input, the `vw-turnstile` slot, and a `vw-form__actions` row with one `vw-btn vw-btn--light` submit button.
- Each field is a `vw-field`: a `vw-label`, the control (`vw-input`, `vw-select` or `vw-textarea`), an optional `vw-hint`, and a hidden `vw-field__error` that holds an icon and the message. Link the hint and error to the control with `aria-describedby`.
- Use `vw-form--on-walnut` inside the walnut panel. Without it the form uses `walnut` text on light grounds. The text, hint, error and focus colours switch with it (`on-walnut`, `on-walnut-muted`, `error-on-walnut`, `focus-on-walnut`).
- **Errors.** Name the problem and say how to fix it ("Enter your email address."). Errors are never colour alone: they carry an icon, and the control gets `aria-invalid="true"` and a 2px edge. The `vw-form__status` summary has `role="alert"`; move focus to the first invalid field.
- **Success.** Keep an empty `vw-success` element with `role="status"` and `aria-live="polite"` in the page, and fill it on success so it is announced. The heading is "Thank you — we'll be in touch soon." with a short line below it. Hide the form after success.
- **Honeypot.** `vw-hp` is hidden from people and assistive tech (`aria-hidden`, `tabindex="-1"`); bots tend to fill it. Never style it with `display: none`.
- **Spam check.** The `vw-turnstile` slot stays empty until the form scrolls into view, then Cloudflare Turnstile renders there. It needs `script-src` and `frame-src` for `challenges.cloudflare.com`.
- Every string comes from the language file (`form.*` in `src/i18n/<code>.yml`), including the error codes. Leave about 30% extra room for longer Dutch, French and Greek strings.
- Keyboard: Tab order follows the visual order; the button shows a spinner and the `sending` label while the request runs, and is disabled meanwhile.
- See `preview.html` for the form, an error state and the success message.
