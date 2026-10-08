const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',61),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'轮转玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const error=BB.act(G,p,{a:'info',w:w.id});if(error)throw Error(error);}}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
function sync(G){const s=G.officialState.constraints;s.personal=G.players.map((_,owner)=>({id:s.ring.find(x=>x.owner===owner).id,retired:false}));}
// 后段夹具：换已在场的牌，或把F–L从牌堆取出并弃旧牌；不是从开局的操作证明。
function card(G,owner,id){const s=G.officialState.constraints,slot=s.ring.find(x=>x.owner===owner),other=s.ring.find(x=>x.id===id);if(other)[slot.id,other.id]=[other.id,slot.id];else{const index=s.deck.indexOf(id);if(index<0)throw Error('夹具没有该牌');s.deck.splice(index,1);s.discard.push(slot.id);slot.id=id;}sync(G);}
module.exports={game,setup,resort,card,sync};
