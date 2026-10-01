const BB = require('../js/engine.js'); const Bot = require('../js/bot.js'); const M = require('../js/missions.js');
for (const np of [2,4]) {
  let a=0,b=0,c=0,k=0;
  for (let g=0; g<10; g++) {
    const G = BB.createGame(M[7], Array.from({length:np},(_, i)=>({pid:'p'+i,name:'B'+i,bot:true})));
    for (let p=0;p<np;p++){ while(G.phase==='setup' && G.setup[p]<G.infoN) BB.act(G,p,Bot.decide(G,p)); }
    const H = G.wires.filter(w=>w.o!==0);
    const r1 = Bot.infer(G,0), r2 = Bot.infer(G,0,200000);
    // naive prior baseline: uniform over the remaining pool
    for (const w of H) { const t = BB.annOf(w.v); a += (r1[w.id].P[t]||0); b += (r2[w.id].P[t]||0); k++; }
  }
  console.log(np+'p', 'avg P(true) default', (a/k).toFixed(3), 'long chain', (b/k).toFixed(3));
}
