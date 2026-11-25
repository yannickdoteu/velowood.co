# velowood.co

The velowood website: a one-page, static landing page in English (Dutch, French and Greek are prepared but switched off), with a contact form. It is built with [Eleventy](https://www.11ty.dev/) and served by a single Cloudflare Worker, which serves `dist/` as static assets and handles `POST /api/contact`. Everything runs on the Workers Free plan.

The look and the copy rules live in [`velowood-design-system/`](velowood-design-system/README.md).

## Quick start

```bash
npm ci
cp .dev.vars.example .dev.vars   # Cloudflare's test Turnstile keys, for local use only
npm run db:migrate:local         # creates the local D1 database
npm run dev                      # builds the site and starts wrangler on http://localhost:8787
```

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `dist/` and writes `worker/generated/i18n.json` |
| `npm run dev` | Build, then `wrangler dev` |
| `npm test` | Runs the Worker and site tests (needs a build first, so `dist/` exists) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run images` / `npm run fonts` | Regenerate responsive images and self-hosted fonts |
| `npm run db:migrate:remote` | Applies D1 migrations in production |
| `npm run deploy` | Build, then `wrangler deploy` |

## Languages

Every visible string lives in `src/i18n/<code>.yml`; templates contain no copy. English (`en.yml`) is the source and is served at `/`. The Dutch, French and Greek files are parked in `src/i18n-disabled/` until the copy has been reviewed; move one back into `src/i18n/` to switch it on (it then appears at `/nl/`, `/fr/` or `/el/`, and the language menu returns). The menu is hidden while only one language is live. They still need the newer `site.tagline` and `hywood` keys.

To add a language, copy `en.yml` to `<code>.yml`, set `meta` (`code`, `order`, `path`, `hreflang`, `ogLocale`, `name`), translate the values and rebuild. The language menu, `hreflang` links, sitemap, thank-you and error pages, the translated confirmation email and the Worker's redirects all pick it up. All language files must have exactly the same keys. Keep `velowood` lowercase and follow the voice rules in the design system.

## Contact form

`src/_includes/partials/contact.njk` posts to `/api/contact` (see `worker/`). It works with and without JavaScript:

- With JavaScript, `src/js/site.js` validates in place and shows the success message.
- Without it, the Worker redirects (303) to the translated `/<lang>/thanks/` or `/<lang>/error/<code>/` page.
- The Worker checks the origin, a honeypot, Cloudflare Turnstile and a per-IP rate limit, stores the message in D1 (deleted after 180 days by a cron), emails the team and sends the sender a confirmation in their language.

Secrets (the Turnstile secret key and so on) are set with `wrangler secret`; `.dev.vars` is only for local development and is not committed.

## Performance and accessibility

Lighthouse (v12, run against the local `wrangler dev` server, 25 November 2026, **before** the hero, logo and hywood changes of the same day, with Dutch, French and Greek still live; rerun it for current numbers):

| Page | Mobile (perf / a11y / best practices / SEO) | Desktop |
| --- | --- | --- |
| `/` (en) | 95 / 100 / 100 / 100 (LCP 1.9 s) | 100 / 100 / 100 / 100 |
| `/nl/` | 99 / 100 / 100 / 100 (LCP 1.8 s) | 100 / 100 / 100 / 100 |
| `/fr/` | 99 / 100 / 100 / 100 (LCP 1.8 s) | 100 / 100 / 100 / 100 |
| `/el/` | 98 / 100 / 100 / 100 (LCP 2.0 s) | 100 / 100 / 100 / 100 |

To run it again (reports go to `lighthouse/`, which is git-ignored):

```bash
npm run dev   # in one terminal
npx lighthouse http://localhost:8787/ --output=html --output=json --output-path=lighthouse/en-mobile
npx lighthouse http://localhost:8787/ --preset=desktop --output=html --output=json --output-path=lighthouse/en-desktop
```

Local numbers leave out network and CDN effects, so check the deployed site too.

## Layout

```
src/            pages (.njk), partials, CSS, JS, i18n, images, fonts
worker/         the Worker: contact API, validation, email, security headers
migrations/     D1 schema
test/           Vitest tests, run in the Workers runtime
velowood-design-system/   tokens, components and their READMEs/previews
```
