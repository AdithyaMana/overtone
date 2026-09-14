#!/usr/bin/env node
/* Stage the game for Firebase Hosting.
 *
 *   node tools/build-web.js   (or: npm run build:web)
 *
 * The game is one self-contained file, so "building" is copying index.html
 * into public/. Everything else in the repo — tests, tools, node_modules —
 * stays out of the deploy.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public");

fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
fs.writeFileSync(path.join(OUT, "index.html"), html);
/* Hosting serves this for unknown paths; the game is a single page. */
fs.writeFileSync(path.join(OUT, "404.html"), html);

/* The one asset the page does not carry inline. It is fetched on the first
   tap, never on load, so its weight is off the critical path — but it still
   has to be deployed next to the page. */
const kb = (n) => (n / 1024).toFixed(0) + "KB";
fs.mkdirSync(path.join(OUT, "audio"), { recursive: true });
const theme = fs.readFileSync(path.join(ROOT, "audio", "theme.mp3"));
fs.writeFileSync(path.join(OUT, "audio", "theme.mp3"), theme);

console.log("public/index.html      " + kb(Buffer.byteLength(html)));
console.log("public/audio/theme.mp3 " + kb(theme.length) + "  (lazy, after first tap)");
console.log("public/404.html        (same page, so any URL lands in the game)");
console.log("\ndeploy with:  firebase deploy --only hosting");
