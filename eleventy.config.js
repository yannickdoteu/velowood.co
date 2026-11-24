import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import * as yaml from "js-yaml";

const DS = "velowood-design-system";

/** Load every translation file in src/i18n, sorted by meta.order. Adding de.yml adds /de/. */
export function loadLanguages() {
  return readdirSync("src/i18n")
    .filter((f) => f.endsWith(".yml"))
    .map((f) => yaml.load(readFileSync(`src/i18n/${f}`, "utf8")))
    .sort((a, b) => a.meta.order - b.meta.order);
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

/** One stylesheet: design-system tokens + components (base), self-hosted fonts, then page CSS. */
function buildCss() {
  const bundle = readFileSync(`${DS}/components/bundle.css`, "utf8")
    .replace(/@import url\([^)]*fonts\.googleapis[^)]*\);\s*/, "") // fonts are self-hosted instead
    .replace(/\/\* -{10} preview helpers[\s\S]*$/, ""); // preview-only helpers
  const css = minifyCss(
    [readFileSync(`${DS}/tokens.css`, "utf8"), readFileSync("src/css/fonts.css", "utf8"), bundle, readFileSync("src/css/page.css", "utf8")].join("\n"),
  );
  return css;
}

function hashed(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 10);
}

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yml", (contents) => yaml.load(contents));

  const languages = loadLanguages();
  eleventyConfig.addGlobalData("languages", languages);

  // Data the Worker needs at runtime: supported languages and the translated confirmation email.
  mkdirSync("worker/generated", { recursive: true });
  writeFileSync(
    "worker/generated/i18n.json",
    JSON.stringify(
      Object.fromEntries(languages.map((l) => [l.meta.code, { path: l.meta.path, email: l.email, roles: l.form.roles }])),
      null,
      2,
    ) + "\n",
  );

  // Hashed, minified CSS and JS so they can be cached for a year.
  eleventyConfig.addGlobalData("assets", () => {
    const css = buildCss();
    const js = readFileSync("src/js/site.js", "utf8");
    const cssName = `/css/site.${hashed(css)}.css`;
    const jsName = `/js/site.${hashed(js)}.js`;
    mkdirSync("dist/css", { recursive: true });
    mkdirSync("dist/js", { recursive: true });
    writeFileSync(`dist${cssName}`, css);
    writeFileSync(`dist${jsName}`, js);
    return { css: cssName, js: jsName };
  });
  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");
  eleventyConfig.addWatchTarget(`${DS}/`);

  eleventyConfig.addPassthroughCopy({ "src/img": "img", "src/fonts": "fonts", "src/static": "/" });

  // URL of a page (home, privacy, thanks, error/<code>, 404) in a given language.
  eleventyConfig.addFilter("pageUrl", (lang, key) => {
    const base = lang.meta.path;
    if (key === "home") return base;
    if (key === "404") return `${base}404.html`;
    return `${base}${key}/`;
  });
  eleventyConfig.addFilter("srcset", (list) => list.map((i) => `${i.src} ${i.w}w`).join(", "));
  eleventyConfig.addFilter("xset", (list) => list.map((i) => `${i.src} ${i.x}x`).join(", "));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v).replace(/</g, "\\u003c"));

  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
