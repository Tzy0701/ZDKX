const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',10),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'抢回合玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G,now=Date.now()){while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&!w.info&&BB.setupInfoAllowed(G,w));const e=BB.act(G,pi,{a:'info',w:w.id},{now});if(e)throw Error(e);}}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
function give(G,val,owner){G.wires.filter(w=>w.v===val).forEach((w,i)=>{w.o=owner;w.s=i%G.players[owner].stands.length;w.info=null;});resort(G);}
module.exports={game,setup,resort,give};
