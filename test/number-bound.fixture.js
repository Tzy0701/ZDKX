const BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1,roles){return BB.createGame(M.get('official-development',57),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'限制玩家'+i,character:roles&&roles[i]})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w)),error=BB.act(G,p,{a:'info',w:w.id});if(error)throw Error(error);}}
function assign(G,value,owner){G.wires.filter(w=>w.v===value).forEach(w=>{w.o=owner;w.s=0;w.info=null;});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
module.exports={game,setup,assign};
