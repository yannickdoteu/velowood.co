// Builds responsive images, logos, favicons and the Open Graph image from velowood-design-system/assets.
// Output: src/img/** (committed) and src/_data/images.json (manifest used by the templates).
// Never publishes concept-frame-render.jpg (AI render, mood reference only).
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "velowood-design-system/assets";
const OUT = "src/img";
const PAPER = "#faf7f2";
const manifest = {};

await mkdir(OUT, { recursive: true });

/** Crop a photo to an aspect ratio and export AVIF, WebP and JPG at several widths. */
async function photo(name, file, ratio, widths) {
  const input = sharp(path.join(SRC, "Photography", file));
  const meta = await input.metadata();
  // Largest crop of the requested ratio that fits the source.
  let cw = meta.width, ch = Math.round(meta.width / ratio);
  if (ch > meta.height) { ch = meta.height; cw = Math.round(meta.height * ratio); }
  const left = Math.round((meta.width - cw) / 2), top = Math.round((meta.height - ch) / 2);
  const ws = widths.filter((w) => w <= cw);
  if (!ws.includes(cw) && ws.length < widths.length) ws.push(cw);
  const entry = { width: cw, height: ch, ratio, avif: [], webp: [], jpg: [] };
  for (const w of ws) {
    const h = Math.round(w / ratio);
    const base = sharp(path.join(SRC, "Photography", file)).extract({ left, top, width: cw, height: ch }).resize(w, h);
    const stem = `${name}-${w}`;
    await base.clone().avif({ quality: 52, effort: 6 }).toFile(`${OUT}/${stem}.avif`);
    await base.clone().webp({ quality: 74 }).toFile(`${OUT}/${stem}.webp`);
    await base.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/${stem}.jpg`);
    entry.avif.push({ w, src: `/img/${stem}.avif` });
    entry.webp.push({ w, src: `/img/${stem}.webp` });
    entry.jpg.push({ w, src: `/img/${stem}.jpg` });
  }
  entry.fallback = entry.jpg[entry.jpg.length - 1].src;
  entry.width = ws[ws.length - 1];
  entry.height = Math.round(entry.width / ratio);
  manifest[name] = entry;
}

/** Logos: raster PNGs exported at 1x/2x/3x of their display height as PNG + WebP. */
// TODO(vector-logo): replace these rasters with the vector logo when the client sends it.
async function logo(name, file, displayHeight) {
  const src = path.join(SRC, "Logos", file);
  const meta = await sharp(src).metadata();
  const entry = { height: displayHeight, width: Math.round((meta.width / meta.height) * displayHeight), png: [], webp: [] };
  for (const x of [1, 2, 3]) {
    const h = displayHeight * x;
    const stem = `${name}-${h}`;
    const img = sharp(src).resize({ height: h });
    await img.clone().png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/${stem}.png`);
    await img.clone().webp({ quality: 90, alphaQuality: 90 }).toFile(`${OUT}/${stem}.webp`);
    entry.png.push({ x, src: `/img/${stem}.png` });
    entry.webp.push({ x, src: `/img/${stem}.webp` });
  }
  manifest[name] = entry;
}

await photo("hero", "craft-templates.jpg", 4 / 5, [400, 575]);
await photo("workshop", "workshop-fitting-graded.jpg", 4 / 3, [560, 840, 1121]);
await photo("sanding", "craft-sanding.jpg", 1, [400, 718]);
await logo("logo", "velowood-logo.png", 26);
await logo("logo-reverse", "velowood-logo-reverse.png", 24);

// Hero disc: the ring mark at 128px (2x = 256px, the source size).
const ring = path.join(SRC, "Logos", "velowood-ring-mark.png");
await sharp(ring).resize(128).webp({ quality: 90 }).toFile(`${OUT}/ring-128.webp`);
await sharp(ring).resize(256).webp({ quality: 90 }).toFile(`${OUT}/ring-256.webp`);
await sharp(ring).resize(256).png({ palette: true }).toFile(`${OUT}/ring-256.png`);
manifest.ring = { width: 128, height: 128, webp: ["/img/ring-128.webp 1x", "/img/ring-256.webp 2x"], png: "/img/ring-256.png" };

// Favicons from the ring mark. Apple touch icons are shown on a paper square (iOS fills transparency with black).
await mkdir("src/static", { recursive: true });
await sharp(ring).resize(32).png().toFile("src/static/favicon-32.png");
await sharp({ create: { width: 180, height: 180, channels: 4, background: PAPER } })
  .composite([{ input: await sharp(ring).resize(148).png().toBuffer(), gravity: "center" }])
  .png().toFile("src/static/apple-touch-icon.png");
const icoSizes = await Promise.all([16, 32, 48].map((s) => sharp(ring).resize(s).png().toBuffer()));
await writeFile("src/static/favicon.ico", await pngToIco(icoSizes));

// Open Graph / Twitter image, 1200×630: paper ground, logo left, the hero photo right.
const photoBuf = await sharp(path.join(SRC, "Photography", "craft-templates.jpg")).resize(630, 630).toBuffer();
const logoBuf = await sharp(path.join(SRC, "Logos", "velowood-logo.png")).resize({ width: 440 }).toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: PAPER } })
  .composite([
    { input: photoBuf, left: 570, top: 0 },
    { input: logoBuf, left: 65, top: Math.round((630 - logoMeta.height) / 2) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("src/static/og-image.jpg");

await writeFile("src/_data/images.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("images: done", Object.keys(manifest).join(", "));
