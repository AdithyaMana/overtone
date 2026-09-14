#!/usr/bin/env node
/* Embed a local display font into index.html as a @font-face data URI.
 *
 *   node tools/embed-font.js ARCADE_R.TTF
 *   npm run font -- ARCADE_R.TTF
 *
 * Why a data URI: the Artifact host's CSP serves font files from
 * fonts.gstatic.com and nowhere else, so a font from any other source has to
 * travel inside the page itself. This is the documented route.
 *
 * The page already asks for "ArcadeLocal" first in --f-display, with a Google
 * Fonts face behind it — so before you run this the game looks close, and
 * after you run it the game looks exactly right. Re-running replaces the
 * embedded face; passing --clear removes it.
 *
 * Licensing is yours to check: embedding a font in a published page
 * redistributes it, which many free-for-personal-use faces do not permit.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "index.html");
const START = "/* --- arcade-font-start --- */";
const END = "/* --- arcade-font-end --- */";

const MIME = { ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2" };

function main() {
  const arg = process.argv[2];
  let html = fs.readFileSync(FILE, "utf8");
  const s = html.indexOf(START), e = html.indexOf(END);
  if (s < 0 || e < 0) {
    console.error("index.html has no arcade-font slot — expected " + START);
    process.exit(1);
  }

  if (arg === "--clear") {
    html = html.slice(0, s + START.length) + "\n" + html.slice(e);
    fs.writeFileSync(FILE, html);
    console.log("embedded font removed; the page falls back to the web face");
    return;
  }

  const src = path.resolve(ROOT, arg || "ARCADE_R.TTF");
  if (!fs.existsSync(src)) {
    console.error("Font not found: " + src);
    console.error("\nDrop the .ttf next to index.html and run again, e.g.");
    console.error("  npm run font -- ARCADE_R.TTF");
    process.exit(1);
  }

  const ext = path.extname(src).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    console.error("Unsupported font type " + ext + " — use ttf, otf, woff or woff2");
    process.exit(1);
  }

  const bytes = fs.readFileSync(src);
  const b64 = bytes.toString("base64");
  const face = "\n@font-face{\n"
    + '  font-family: "ArcadeLocal";\n'
    + "  font-style: normal;\n"
    + "  font-weight: 400;\n"
    + "  font-display: block;\n"
    + '  src: url(data:' + mime + ";base64," + b64 + ') format("' + ext.slice(1) + '");\n'
    + "}\n";

  html = html.slice(0, s + START.length) + face + html.slice(e);
  fs.writeFileSync(FILE, html);

  const kb = n => (n / 1024).toFixed(0) + "KB";
  console.log("embedded " + path.basename(src) + " (" + kb(bytes.length)
    + " raw, " + kb(b64.length) + " as base64)");
  console.log("index.html is now " + kb(Buffer.byteLength(html)) + " — the artifact cap is 16MB");
  console.log("\nrebuild the artifact with:  node build-artifact.js");
}

main();
