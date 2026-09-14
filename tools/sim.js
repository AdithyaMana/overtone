const fs=require("fs");
const html=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8");
const lexBlock=html.match(/const LEXICON = `\n([\s\S]*?)`\.trim\(\)/)[1];
const LEXICON=lexBlock.trim().split("\n").map(l=>{const p=l.trim().split(" ");return {w:p[0],t:p[1].split(",")};});
const DEMANDS=[...html.matchAll(/\{ n:"(THE [A-Z ]+)",\s*tags:\[([^\]]+)\] \}/g)]
  .map(m=>({n:m[1],tags:m[2].split(",").map(s=>s.replace(/[^A-Z]/g,""))}));
const TARGETS=JSON.parse(html.match(/const TARGETS = (\[[^\]]+\])/)[1]);

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

function runSim(seed){
  let rng=mulberry32(hashStr(seed));
  const ri=n=>Math.floor(rng()*n);
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  const demandOrder=shuffle(DEMANDS.slice()).slice(0,8);
  const wanted=[];demandOrder.forEach(d=>d.tags.forEach(t=>{if(!wanted.includes(t))wanted.push(t);}));
  const DECK=26,FLOOR=3;
  const bag=shuffle(LEXICON.slice());const chosen=[],taken={};
  const carrying=t=>chosen.filter(e=>e.t.includes(t)).length;
  shuffle(wanted.slice()).forEach(t=>{
    for(let i=0;i<bag.length&&carrying(t)<FLOOR&&chosen.length<DECK;i++){
      if(taken[bag[i].w]||!bag[i].t.includes(t))continue;taken[bag[i].w]=1;chosen.push(bag[i]);}});
  for(let i=0;i<bag.length&&chosen.length<DECK;i++){if(taken[bag[i].w])continue;taken[bag[i].w]=1;chosen.push(bag[i]);}

  // coverage check
  const starved=demandOrder.map((d,i)=>{
    const n=chosen.filter(c=>c.t.some(t=>d.tags.includes(t))).length;
    return {round:i+1,demand:d.n,cards:n};
  }).filter(x=>x.cards<5);

  // naive player: no lenses, greedy best 3 cards by (base + 25*matches), 4 plays
  const cards=chosen.map(e=>({...e,base:5+3*e.w.length}));
  const perRound=[];
  for(let r=0;r<8;r++){
    const d=demandOrder[r];
    const scored=cards.map(c=>({c,v:c.base+25*c.t.filter(t=>d.tags.includes(t)).length}))
      .sort((a,b)=>b.v-a.v);
    // 4 plays x top 3 available (approximates drawing well)
    let tot=0;
    for(let p=0;p<4;p++){
      const slice=scored.slice(p*3,p*3+3);
      tot+=slice.reduce((s,x)=>s+x.v,0);
    }
    perRound.push({round:r+1,demand:d.n,target:TARGETS[r],naive:tot,ratio:+(tot/TARGETS[r]).toFixed(2)});
  }
  return {starved,perRound};
}

let allStarved=[];const ratios=Array.from({length:8},()=>[]);
for(let i=0;i<400;i++){
  const {starved,perRound}=runSim("seed"+i);
  allStarved=allStarved.concat(starved);
  perRound.forEach((p,idx)=>ratios[idx].push(p.ratio));
}
console.log("Starved rounds (fewer than 5 matching cards in deck) across 400 runs:", allStarved.length);
if(allStarved.length) console.log("  worst:", allStarved.slice(0,5).map(s=>s.demand+" r"+s.round+" ("+s.cards+" cards)").join(" | "));
console.log("\nNaive lens-less player, score as a multiple of target (needs ~1.0 to survive):");
ratios.forEach((r,i)=>{
  r.sort((a,b)=>a-b);
  const med=r[Math.floor(r.length/2)], lo=r[Math.floor(r.length*0.1)];
  console.log("  round "+(i+1)+"  target "+String(TARGETS[i]).padStart(5)+"   median x"+med.toFixed(2)+"   unlucky-10% x"+lo.toFixed(2));
});
