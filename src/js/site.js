/* velowood — the only script on the site: language menu, mobile menu, contact form. No dependencies. */
(() => {
  "use strict";
  const doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");

  /** A disclosure (button + panel) that closes on Escape and outside click. */
  function disclosure(button, panel, { onToggle, show, hide } = {}) {
    const isOpen = () => button.getAttribute("aria-expanded") === "true";
    const set = (open, focusButton) => {
      button.setAttribute("aria-expanded", String(open));
      (open ? show : hide)(panel);
      if (onToggle) onToggle(open);
      if (!open && focusButton) button.focus();
    };
    button.addEventListener("click", () => set(!isOpen()));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) set(false, true);
    });
    document.addEventListener("click", (e) => {
      if (isOpen() && !panel.contains(e.target) && !button.contains(e.target)) set(false);
    });
    return { close: () => isOpen() && set(false) };
  }

  // ---------- language switcher ----------
  const lang = document.querySelector("[data-lang-switcher]");
  if (lang) {
    disclosure(lang.querySelector("button"), lang.querySelector("ul"), {
      show: (el) => { el.hidden = false; },
      hide: (el) => { el.hidden = true; },
    });
  }

  // ---------- mobile nav ----------
  const menuBtn = document.querySelector(".vw-menu-btn");
  const nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.hidden = false;
    const label = menuBtn.querySelector(".vw-visually-hidden");
    const menu = disclosure(menuBtn, nav, {
      show: (el) => el.setAttribute("data-open", ""),
      hide: (el) => el.removeAttribute("data-open"),
      onToggle: (open) => { label.textContent = menuBtn.dataset[open ? "labelClose" : "labelOpen"]; },
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) menu.close(); });
    window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => { if (e.matches) menu.close(); });
  }

  // ---------- contact form ----------
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const i18n = JSON.parse(document.getElementById("contact-i18n").textContent);
  const status = document.getElementById("form-status");
  const success = document.getElementById("form-success");
  const submit = form.querySelector('button[type="submit"]');
  const roleSelect = form.elements.role;
  const ROLES = Array.from(roleSelect.options, (o) => o.value);
  const FIELDS = ["name", "email", "role", "message", "consent"];
  // Same rule as the Worker: something@something.tld, no spaces.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  form.noValidate = true; // we show our own, translated messages

  // Preselect "Hotel" from the hotels section, and from ?role=hotel.
  const preselect = new URLSearchParams(location.search).get("role");
  if (preselect && ROLES.includes(preselect)) roleSelect.value = preselect;
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      roleSelect.value = link.dataset.roleLink;
      document.getElementById("contact").scrollIntoView({ block: "start" });
      form.elements.name.focus({ preventScroll: true });
    });
  });

  // Turnstile: load the script only when the form comes near the viewport.
  const widget = document.getElementById("cf-turnstile");
  let turnstileRequested = false;
  let widgetId = null;
  function loadTurnstile() {
    if (turnstileRequested) return;
    turnstileRequested = true;
    window.vwTurnstileReady = () => {
      widgetId = window.turnstile.render(widget, {
        sitekey: widget.dataset.sitekey,
        theme: "light",
        size: "flexible",
        action: "contact",
        language: widget.dataset.language,
      });
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=vwTurnstileReady";
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadTurnstile(); }
    }, { rootMargin: "300px 0px" });
    io.observe(form);
  } else {
    loadTurnstile();
  }
  form.addEventListener("focusin", loadTurnstile, { once: true });

  function fieldEl(name) { return form.elements[name]; }
  function errorEl(name) { return document.getElementById(`cf-${name}-error`); }

  function setFieldError(name, code) {
    const input = fieldEl(name);
    const err = errorEl(name);
    if (!input || !err) return;
    if (code) {
      err.querySelector("span").textContent = i18n.errors[code] || i18n.errors.invalid_request;
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
    } else {
      err.hidden = true;
      err.querySelector("span").textContent = "";
      input.removeAttribute("aria-invalid");
    }
  }

  /** Show a message at the top of the form, with an icon; optionally with the mailto fallback. */
  function setStatus(code, withMail) {
    if (!code) { status.hidden = true; status.replaceChildren(); return; }
    const icon = document.querySelector("#cf-name-error svg").cloneNode(true);
    const p = document.createElement("p");
    p.textContent = (i18n.errors[code] || i18n.errorSummary) + (withMail ? " " : "");
    if (withMail) {
      const a = document.createElement("a");
      a.href = `mailto:${i18n.email}`;
      a.textContent = i18n.email;
      p.append(a, ".");
    }
    status.replaceChildren(icon, p);
    status.hidden = false;
  }

  function validate(data) {
    const errors = {};
    const name = data.name.trim();
    const email = data.email.trim();
    const message = data.message.trim();
    if (!name) errors.name = "name_required";
    else if (name.length > 100) errors.name = "name_too_long";
    if (!email) errors.email = "email_required";
    else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "email_invalid";
    if (!ROLES.includes(data.role)) errors.role = "role_invalid";
    if (!message) errors.message = "message_required";
    else if (message.length < 10) errors.message = "message_too_short";
    else if (message.length > 5000) errors.message = "message_too_long";
    if (!data.consent) errors.consent = "consent_required";
    return errors;
  }

  function showErrors(errors) {
    FIELDS.forEach((f) => setFieldError(f, errors[f]));
    const first = FIELDS.find((f) => errors[f]);
    if (first) {
      setStatus(null);
      const p = document.createElement("p");
      p.textContent = i18n.errorSummary;
      status.replaceChildren(document.querySelector("#cf-name-error svg").cloneNode(true), p);
      status.hidden = false;
      fieldEl(first).focus();
    }
    return Boolean(first);
  }

  // Clear a field's error as soon as it is fixed.
  form.addEventListener("input", (e) => {
    const name = e.target.name;
    if (!FIELDS.includes(name) || e.target.getAttribute("aria-invalid") !== "true") return;
    const err = validate(read())[name];
    if (!err) setFieldError(name, null);
  });

  function read() {
    const fd = new FormData(form);
    return {
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      role: String(fd.get("role") || ""),
      message: String(fd.get("message") || ""),
      consent: fd.get("consent") === "yes",
      website: String(fd.get("website") || ""),
      lang: String(fd.get("lang") || ""),
      turnstileToken: String(fd.get("cf-turnstile-response") || ""),
    };
  }

  function busy(on) {
    submit.disabled = on;
    submit.setAttribute("aria-busy", String(on));
    submit.querySelector(".vw-btn__label").textContent = submit.dataset[on ? "busyLabel" : "label"];
  }

  function resetTurnstile() {
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = read();
    if (showErrors(validate(data))) return;
    if (!data.turnstileToken) {
      loadTurnstile();
      setStatus("verification_pending");
      status.focus?.();
      return;
    }
    busy(true);
    setStatus(null);
    let result;
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
        credentials: "same-origin",
      });
      result = await res.json().catch(() => ({ ok: false, error: "server_error" }));
    } catch {
      result = { ok: false, error: "network_error" };
    }
    busy(false);

    if (result.ok) {
      const tpl = document.getElementById("form-success-tpl");
      success.replaceChildren(tpl.content.cloneNode(true));
      success.hidden = false;
      form.hidden = true;
      success.focus();
      return;
    }
    if (result.error === "validation" && result.fields) {
      showErrors(result.fields);
      return;
    }
    resetTurnstile();
    const withMail = ["send_failed", "server_error", "network_error"].includes(result.error);
    setStatus(i18n.errors[result.error] ? result.error : "server_error", withMail);
    submit.focus();
  });
})();
