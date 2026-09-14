#!/usr/bin/env node
/* Export every card in the lexicon, for sourcing or generating real artwork.
 *
 *   node tools/export-cards.js
 *
 * Writes into art/:
 *   cards.csv    — word, overtones, value, slug, filename, prompt
 *   CARDS.md     — readable table, grouped, for browsing
 *   prompts.txt  — one prompt per line, for batch image generation
 *
 * The slug is the filename the game looks for: art/<slug>.png. Any word
 * without a file falls back to its generated emblem, so partial art is fine.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Pull the ontology and the lexicon straight out of the game, so this file can
   never drift from what actually ships. */
const TAGS = {};
const tagBlock = html.match(/const TAGS = \{([\s\S]*?)\n\};/)[1];
tagBlock.replace(/(\w{3}):\s*\["([A-Z]+)","(\w+)"\]/g, function(_, k, name){ TAGS[k] = name; return ""; });

const lexBlock = html.match(/const LEXICON = `\n([\s\S]*?)`\.trim\(\)/)[1];
const CARDS = lexBlock.trim().split("\n").map(function(line){
  const p = line.trim().split(" ");
  return { w: p[0], t: p[1].split(",").filter(function(t){ return TAGS[t]; }) };
});

/* Mood words per overtone — these steer an image model toward the same feeling
   the scoring engine reads off the card. */
const MOOD = {
  ANI:"animal", PLA:"botanical", NAT:"natural landscape", BOD:"anatomical",
  FOO:"edible", TOO:"hand-tool", TEC:"technological", MON:"wealth, currency",
  HEA:"hot, fiery", COL:"cold, frozen", WET:"wet, aquatic", MOT:"moving, kinetic",
  DAN:"dangerous, threatening", LOU:"loud, resonant", BRI:"bright, radiant",
  DAR:"dark, shadowy", MIN:"psychological, cerebral", TIM:"aged, temporal",
  ABS:"abstract, conceptual"
};

const STYLE = "flat vector game-card illustration, bold simple shapes, thick clean "
  + "outlines, limited 4-colour palette, single centred subject, dark desaturated "
  + "blue-slate background, no text, no lettering, landscape 11:7 crop";

function slugOf(w){ return w.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function valueOf(w){ return 5 + 3 * w.length; }

function promptFor(c){
  const mood = c.t.map(function(t){ return MOOD[t]; }).filter(Boolean).join(", ");
  return c.w.charAt(0) + c.w.slice(1).toLowerCase() + ". " + STYLE + ". Mood: " + mood + ".";
}

const rows = CARDS.map(function(c){
  return {
    word: c.w,
    overtones: c.t.map(function(t){ return TAGS[t]; }).join(" "),
    value: valueOf(c.w),
    slug: slugOf(c.w),
    file: "art/" + slugOf(c.w) + ".png",
    prompt: promptFor(c)
  };
});

const OUT = path.join(ROOT, "art");
fs.mkdirSync(OUT, { recursive: true });

/* --- cards.csv --- */
function esc(s){ return '"' + String(s).replace(/"/g, '""') + '"'; }
const csv = ["word,overtones,value,slug,file,prompt"]
  .concat(rows.map(function(r){
    return [r.word, r.overtones, r.value, r.slug, r.file, r.prompt].map(esc).join(",");
  }))
  .join("\n");
fs.writeFileSync(path.join(OUT, "cards.csv"), csv + "\n");

/* --- prompts.txt --- */
fs.writeFileSync(path.join(OUT, "prompts.txt"),
  rows.map(function(r){ return r.slug + ".png :: " + r.prompt; }).join("\n") + "\n");

/* --- CARDS.md, grouped by the overtone that leads each card --- */
const groups = {};
CARDS.forEach(function(c, i){
  const lead = TAGS[c.t[0]] || "OTHER";
  (groups[lead] = groups[lead] || []).push(rows[i]);
});
let md = "# Card list — " + rows.length + " words\n\n"
  + "Every word in the lexicon, with the overtones the scoring engine reads off it.\n\n"
  + "**Artwork drop-in.** Save an image as `art/<slug>.png` and the game uses it automatically;\n"
  + "any word without a file keeps its generated emblem, so you can do these in any order and\n"
  + "ship partway through. Recommended size **440×280** (11:7), PNG or WebP.\n\n"
  + "**Shared style prompt:** `" + STYLE + "`\n\n"
  + "> Note: words a player invents with the Interpreter can never have a file, so the\n"
  + "> generated emblem has to stay as the fallback.\n\n";

Object.keys(groups).sort().forEach(function(g){
  md += "## " + g + " (" + groups[g].length + ")\n\n";
  md += "| Word | Overtones | Value | File |\n|---|---|---|---|\n";
  groups[g].forEach(function(r){
    md += "| **" + r.word + "** | " + r.overtones + " | " + r.value + " | `" + r.file + "` |\n";
  });
  md += "\n";
});
fs.writeFileSync(path.join(OUT, "CARDS.md"), md);

console.log("wrote art/cards.csv, art/prompts.txt, art/CARDS.md — " + rows.length + " cards");
console.log("overtones in play:", Object.keys(TAGS).length);
