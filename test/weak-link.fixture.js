const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',34),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'秘密玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const e=BB.act(G,p,{a:'info',w:w.id});if(e)throw Error(e);}}
function nonweakGame(n=3){for(let seed=1;seed<100;seed++){const G=game(n,0,seed);if(BB.weakLink(G).owner!==0)return G;}throw Error('找不到非弱环节队长夹具');}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
module.exports={game,setup,nonweakGame,resort};
