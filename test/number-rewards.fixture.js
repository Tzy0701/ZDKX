const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',62),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'奖励玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const e=BB.act(G,p,{a:'info',w:w.id});if(e)throw Error(e);}}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
// 后段持有者／公开卡夹具，不当作从开局的可达性证明。
function give(G,value,owner){G.wires.filter(w=>w.v===value).forEach((w,i)=>{w.o=owner;w.s=i%G.players[owner].stands.length;w.info=null;});resort(G);}
function rewards(G){G.officialState.numberRewards.values=Array.from({length:G.np},(_,i)=>i+1);}
module.exports={game,setup,resort,give,rewards};
