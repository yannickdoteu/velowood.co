velowood makes wooden bicycles: frames shaped by hand in a workshop in Greece, for a company based in Belgium. The website follows **biophilic design**: calm, light, natural materials, room to breathe. The look is warm minimalism, modern and precise rather than rustic. Mostly white and brown, with a tiny touch of green.

The first site is a single landing page that introduces the brand, in English, Dutch, French and Greek, with more European languages to follow. It is built as plain HTML or with a simple static site generator. Use the CSS classes in `components/bundle.css` together with `tokens.css`; there is no JavaScript framework.

## Content fundamentals

- **Name.** Always lowercase, like the wordmark: "velowood", also at the start of a sentence.
- **Voice.** Calm, factual, close to nature. Short sentences. We, not "the company"; you for the reader. No exclamation marks, no emoji, no hype ("revolutionary", "game-changing").
- **Claims.** Keep the client's sustainability wording as written: it is careful ("can", "potentially", "depends on how") and backed up. Don't add vague words like "eco-friendly", "green" or "sustainable" on their own. Name the specific fact instead (FSC- or PEFC-certified timber, repairable frame).
- **Casing.** Sentence case for headings and buttons. The eyebrow label is the only uppercase text.
- **Real copy to reuse.** "Ride close to natural life." · "bio — life, philia — friendship. To be close to natural life." · "Biophilia is the innate human tendency to seek connections with nature and other living things." · The five advantages: Renewable resource, Carbon storage, Potentially lower production emissions, Durability and repairability, Responsible local sourcing.
- **Languages.** Write each language in its own name (Ελληνικά, Nederlands). Leave about 30% extra room in layouts for longer German and Greek strings. Both type families cover Greek.

## Visual foundations

**Color.** Paper and walnut carry the brand; honey is the wood.
- Ground every section in `paper`; alternate with `linen` to separate bands. Use `paper-raised` only for cards or fields on linen.
- Set all text in `walnut` (the logo brown, 12.6:1 on paper). Use `ink-muted` for secondary text and `bark` for links.
- Use `honey` (the tree-ring tan) as the accent fill, for the ring motif and for text on walnut. It is never text on light grounds.
- Use `walnut` grounds for one closing panel (Contact) and `walnut-deep` for the footer. On them, text is `on-walnut`, `on-walnut-muted` or `honey`.
- **Green is a teeny accent.** `moss` (or `moss-light` on walnut) appears only as the eyebrow dot, the certification dot and the occasional small icon, never as a fill larger than a badge.
- Hairlines in `line` are decoration only; a control's edge is `walnut`.

**Type.** Two families, both with Greek and Cyrillic.
- `sans` = Manrope, a geometric sans close to the wordmark. It carries everything: `display-xl` (hero only), `display`, `heading-1` to `heading-3`, `lead`, `body`, `small`, `eyebrow`, `button`. Display sizes use weight 500 and tight tracking; headings 3 and below use 600.
- `serif` = Literata italic, the editorial voice: `quote`, `quote-sm`, and one italic word in the hero headline. At most once per screen.
- Body text is 17/28 and stays within `measure` (64ch).
- Load both families from Google Fonts (the `@import` at the top of `bundle.css`). Self-host the files for production.

**Space and layout.** Generous spacing is part of the calm.
- Content sits in `container` (1200px) with `space-8` gutters (`space-4` on mobile).
- Sections get `space-24` vertical padding (`space-16` on mobile); the biophilia quote gets `space-32`.
- Use asymmetric two-column layouts (text left, photo right) and avoid dense grids. Leave whitespace empty.

**Shape.** Soft like the wordmark's terminals.
- Buttons, badges and the language switcher are pills (`radius-pill`). Use `radius-md` for cards and small photos, `radius-lg` for large photos and the walnut panel, `radius-sm` for fields and focus rings.
- Surfaces are flat. The only shadow is `shadow-soft`, for the open language menu or a raised card.

**The tree-ring motif.** Concentric growth rings are the brand's pattern.
- `vw-rings` draws fading rings behind any block; move their centre with `--rings-x` and `--rings-y`.
- Use it behind the biophilia quote and the contact panel. The pillar numerals and badge dots are tiny rings too.
- Keep it to one or two places per page. It should feel like grain, not wallpaper.

**Imagery.** Use real workshop photography: hands, tools, bent wood, natural light (see `assets/Photography`). Large photos have `radius-lg` corners; captions can have a short serif phrase. No stock photos, and no AI renders published as product shots.

**Motion.** Slow and small: 200ms ease for colour changes, a 3px arrow nudge on hover. No parallax and no auto-playing carousels. Respect `prefers-reduced-motion`.

**Focus and states.**
- Keyboard focus is a solid 2px `focus` ring (walnut) at 2px offset on light grounds, and `focus-on-walnut` (honey) on dark grounds. Both are at least 8:1.
- Hover darkens walnut to `walnut-deep`, and outline buttons fill.

## Iconography

There is no icon set yet. The system uses a few inline 16px stroke icons (arrow, chevron) at 1.75 stroke in `currentColor`, rounded caps and joins. If more are needed, use Lucide at the same weight, and keep icons sparse: words first. No emoji.

## Logo

- Use `velowood-logo.png` on light grounds and `velowood-logo-reverse.png` on walnut.
- Use `velowood-ring-mark.png` (the tree-ring "o" on its own) for the favicon and the hero disc.
- Leave clear space equal to the height of the "o" around the logo. Never recolour or redraw it.
- These are rasters made from the supplied JPG; replace them with the vector original before launch.
