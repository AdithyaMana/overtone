#!/usr/bin/env node
/* Emit artifact.html from index.html.
 *
 * index.html is the source of truth: a complete standalone document that works
 * opened from disk and on GitHub Pages. The Claude Artifact host supplies its
 * own <!doctype>/<head>/<body> skeleton, so the published page must be the
 * INNER content only. This strips the wrapper rather than maintaining a second
 * copy of a 1,400-line file. */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const headInner = src.match(/<head>([\s\S]*?)<\/head>/)[1];
const bodyInner = src.match(/<body>([\s\S]*?)<\/body>/)[1];

// The host already sets charset and viewport; keep everything else (title,
// description, font links, styles).
const head = headInner
  .replace(/^\s*<meta charset="utf-8">\s*$/m, "")
  .replace(/^\s*<meta name="viewport"[^>]*>\s*$/m, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const out = head + "\n\n" + bodyInner.trim() + "\n";
fs.writeFileSync(path.join(__dirname, "artifact.html"), out);

if (/<!doctype|<html|<body|<\/head>/i.test(out)) {
  console.error("FAIL: wrapper tags survived the strip");
  process.exit(1);
}
console.log("artifact.html written —", out.length, "chars");
