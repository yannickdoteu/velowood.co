Translations kept out of the build until the copy has been reviewed (eleventy.config.js only reads `src/i18n/`).
To bring a language back: move its `.yml` file to `src/i18n/` and rebuild. The files lack the newer `site.tagline` and `hywood` keys and
still contain the old English-only contact title; add those keys first (copy them from `en.yml` and translate).
