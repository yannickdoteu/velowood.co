# SiteHeader

The sticky top bar: logo left, up to four nav links, the language switcher and a small primary button right. Height `header-height` (76px), paper at 88% with a blur and a `line` hairline at the bottom.

- Provide: the logo image (`assets/Logos/velowood-logo.png` at 26px tall), nav links (mark the current one with `aria-current="page"`; it gets a `honey` underline), the LanguageSwitcher and one `vw-btn vw-btn--sm`.
- Under 860px the nav links hide; put them in a menu of your own.
- Never put the header on a walnut ground.
