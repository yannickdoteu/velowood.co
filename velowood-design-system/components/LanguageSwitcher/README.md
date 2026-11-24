# LanguageSwitcher

A pill button showing the current language code that opens a menu of languages, each in its own name with its ISO code (English EN, Nederlands NL, Français FR, Ελληνικά EL, Deutsch DE, …).

- Provide: a `vw-lang` wrapper, the `vw-lang__btn` with `aria-expanded`, and a `vw-lang__menu` list of links; mark the current one with `aria-current`.
- Always write each language in its own script and language (Ελληνικά, not "Greek"). Order: EN, NL, FR, EL, then the rest.
- The opening behaviour (click, Escape to close, outside click) is the consumer's script; the preview shows it open.
