const BB = require('../js/engine.js'); const Bot = require('../js/bot.js'); const M = require('../js/missions.js');
for (const id of [4, 8, 9, 13]) for (const np of [2,3,4,5]) {
  const ms = []; let reds = 0;
  for (let g = 0; g < 60; g++) {
    const G = BB.createGame(M[id-1], Array.from({length:np},(_, i)=>({pid:'p'+i,name:'B'+i,bot:true})));
    G.detMax = 99;
    let s=0;
    while (G.phase!=='won'&&G.phase!=='lost'&&s++<3000) { let ok=false; for (let p=0;p<np;p++){const a=Bot.decide(G,p); if(!a)continue; if(!BB.act(G,p,a))ok=true; break;} if(!ok)break; }
    if (G.phase==='lost' && G.det<99) reds++; else ms.push(G.det);
  }
  ms.sort((a,b)=>a-b);
  console.log('m'+id, np+'p', 'redLoss', reds, 'mistakes median', ms[ms.length>>1], 'p75', ms[Math.floor(ms.length*.75)]);
}
