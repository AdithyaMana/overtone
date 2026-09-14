#!/usr/bin/env node
/* Export every card in the lexicon.
 *
 *   node tools/export-cards.js
 *
 * Writes art/CARDS.md (readable, grouped) and art/cards.csv (data).
 *
 * Card faces are drawn from overtone icons rather than per-word artwork, so
 * this is a reference for the lexicon and its ontology — not an asset list.
 * Nineteen icons cover all 249 words, and any word a player invents with the
 * Interpreter too.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Pull the ontology, the icon map and the lexicon straight out of the game, so
   this file can never drift from what actually ships. */
const TAGS = {};
html.match(/const TAGS = \{([\s\S]*?)\n\};/)[1]
  .replace(/(\w{3}):\s*\["([A-Z]+)","(\w+)"\]/g, function(_, k, name){ TAGS[k] = name; return ""; });

const ICONS = {};
html.match(/const ICONS = \{([\s\S]*?)\n\};/)[1]
  .replace(/(\w{3}):\s*"([a-z_]+)"/g, function(_, k, icon){ ICONS[k] = icon; return ""; });

const CARDS = html.match(/const LEXICON = `\n([\s\S]*?)`\.trim\(\)/)[1]
  .trim().split("\n").map(function(line){
    const p = line.trim().split(" ");
    return { w: p[0], t: p[1].split(",").filter(function(t){ return TAGS[t]; }) };
  });

function valueOf(w){ return 5 + 3 * w.length; }

const rows = CARDS.map(function(c){
  return {
    word: c.w,
    overtones: c.t.map(function(t){ return TAGS[t]; }).join(" "),
    icons: c.t.map(function(t){ return ICONS[t]; }).join(" "),
    value: valueOf(c.w)
  };
});

const OUT = path.join(ROOT, "art");
fs.mkdirSync(OUT, { recursive: true });

/* --- cards.csv --- */
function esc(s){ return '"' + String(s).replace(/"/g, '""') + '"'; }
fs.writeFileSync(path.join(OUT, "cards.csv"),
  ["word,overtones,icons,value"]
    .concat(rows.map(function(r){
      return [r.word, r.overtones, r.icons, r.value].map(esc).join(",");
    })).join("\n") + "\n");

/* --- CARDS.md, grouped by the overtone that leads each card --- */
const groups = {};
CARDS.forEach(function(c, i){
  const lead = TAGS[c.t[0]] || "OTHER";
  (groups[lead] = groups[lead] || []).push(rows[i]);
});

let md = "# Card list — " + rows.length + " words\n\n"
  + "Every word in the lexicon, with the overtones the scoring engine reads off it.\n"
  + "`value` is the card's base chips, which is derived from its length (`5 + 3 × letters`).\n\n"
  + "## How card faces work\n\n"
  + "Cards don't carry per-word artwork. Each shows the **icons for its own overtones** on a\n"
  + "plate tinted by its most distinctive one — so the picture and the scoring rule are views of\n"
  + "the same data, and a player learns that the flame means HEAT within one round. Overtones\n"
  + "that match the current Demand get a gold ring, which makes a playable card readable at a\n"
  + "glance.\n\n"
  + "Nineteen icons cover all " + rows.length + " words — and every word a player invents with the\n"
  + "Interpreter, which is the case a fixed art library could never serve.\n\n"
  + "Icons are [Google Material Symbols](https://fonts.google.com/icons) (Rounded, filled). That\n"
  + "set was chosen partly on merit and partly because the artifact host's CSP only serves\n"
  + "stylesheets from `fonts.googleapis.com`, which rules out Font Awesome and Bootstrap Icons.\n\n"
  + "| Overtone | Icon |\n|---|---|\n"
  + Object.keys(TAGS).map(function(t){ return "| " + TAGS[t] + " | `" + ICONS[t] + "` |"; }).join("\n")
  + "\n\n";

Object.keys(groups).sort().forEach(function(g){
  md += "## " + g + " (" + groups[g].length + ")\n\n";
  md += "| Word | Overtones | Value |\n|---|---|---|\n";
  groups[g].forEach(function(r){
    md += "| **" + r.word + "** | " + r.overtones + " | " + r.value + " |\n";
  });
  md += "\n";
});
fs.writeFileSync(path.join(OUT, "CARDS.md"), md);

console.log("wrote art/cards.csv and art/CARDS.md — " + rows.length + " cards, "
  + Object.keys(TAGS).length + " overtones");
