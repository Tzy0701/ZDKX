const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',64),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'双端玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const e=BB.act(G,p,{a:'info',w:w.id});if(e)throw Error(e);}}
function choiceGame(n){for(let seed=1;seed<500;seed++){const G=game(n,0,seed);setup(G);const pair=G.officialState.outwardGroups[0],right=G.wires[pair[1]],left=G.wires[pair[0]];if(!Number.isInteger(right.v)||left.v===right.v)continue;const target=G.wires.find(w=>w.o===1&&!w.cut&&!BB.isOutward(G,w)&&w.v===right.v);if(target)return {G,pair,target:target.id,value:right.v};}throw Error('没有找到指定完整来源场景');}
module.exports={game,setup,choiceGame};
