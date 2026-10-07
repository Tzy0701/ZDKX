const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function act(G,pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));}
function resolve(G){const pd=G.pending,V=BB.view(G,pd.to);act(G,pd.to,{a:'resolve',id:pd.id,w:V.pending.choices.length?V.pending.choices[0]:null});}
function ready(n){
 let G;for(let seed=1;seed<200;seed++){G=BB.createGame(M.get('physical',3),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'玩家'+i})),{rng:rng(seed*104729)});if(G.equip.some(e=>e.n===6))break;}
 assert(G.equip.some(e=>e.n===6));while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&BB.setupInfoAllowed(G,w));act(G,p,{a:'info',w:w.id});}
 for(let k=0;k<200&&!BB.equipUnlocked(G,6);k++){
  if(G.pending){resolve(G);continue;}const p=G.turn,own=G.wires.filter(w=>w.o===p&&!w.cut&&Number.isInteger(w.v)),values=[...new Set(own.map(w=>w.v))].sort((a,b)=>Number(b===6)-Number(a===6));let a;
  for(const v of values){if(BB.soloOk(G,p,v)){a={a:'solo',val:v};break;}const w=G.wires.find(w=>w.o!==p&&!w.cut&&w.v===v);if(w){a={a:'dual',w:w.id,val:v};break;}}assert(a);act(G,p,a);
 }
 while(G.pending)resolve(G);assert(BB.equipUnlocked(G,6));assert.equal(G.det,0);return G;
}
function miss(G){const p=G.turn,own=G.wires.find(w=>w.o===p&&!w.cut&&Number.isInteger(w.v)),target=G.wires.find(w=>w.o!==p&&!w.cut&&Number.isInteger(w.v)&&w.v!==own.v);assert(target);act(G,p,{a:'dual',w:target.id,val:own.v});resolve(G);}
for(let n=2;n<=5;n++){
 const G=ready(n);assert.equal(BB.dialMin(G),n-5);const V=BB.view(G,0);assert.equal(V.detMin,n-5);assert(V.mission.printedDial);
 const legacy=JSON.parse(JSON.stringify(G));delete legacy.detMin;delete legacy.mission.printedDial;legacy.mission.contentVersion=12;const saved=JSON.stringify(legacy);assert(BB.act(legacy,0,{a:'equip',n:6}));assert.equal(JSON.stringify(legacy),saved);
 if(n<5){act(G,0,{a:'equip',n:6});assert.equal(G.det,-1);assert(BB.detonatorText(G).includes('还剩 '+(n+1)+' 格'));for(let mistakes=1;mistakes<=n+1;mistakes++){miss(G);assert.equal(G.phase,mistakes===n+1?'lost':'play');}assert.equal(G.det,n);}
 else{const before=JSON.stringify(G);assert(BB.act(G,0,{a:'equip',n:6}));assert.equal(JSON.stringify(G),before);miss(G);act(G,0,{a:'equip',n:6});assert.equal(G.det,0);assert(G.equip.find(e=>e.n===6).used);}
 console.log('✓ '+n+'人印刷轨道：起点与最早时间格、倒带器、实际失误引爆边界及旧存档兼容');
}
module.exports={ready,miss};
