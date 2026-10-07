const BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1,roles){return BB.createGame(M.get('official-development',56),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'朝外玩家'+i,character:roles&&roles[i]})),{rng:rng(seed*104729),captain:cap});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w)),error=BB.act(G,p,{a:'info',w:w.id});if(error)throw Error(error);}}
module.exports={game,setup};
