const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1){return BB.createGame(M.get('official-development',35),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'先黄后X玩家'+i})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const e=BB.act(G,p,{a:'info',w:w.id});if(e)throw Error(e);}}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>Number(!!a.x)-Number(!!b.x)||a.v-b.v||a.id-b.id).map(w=>w.id)));}
function lastYellow(n=3){let G,x,matching;for(let seed=1;seed<100;seed++){G=game(n,0,seed);x=G.wires.find(w=>w.o===0&&w.x);matching=G.wires.find(w=>!w.x&&w.v===x.v);if(matching)break;}setup(G);G.wires.forEach(w=>{w.cut=true;w.info=null;});x.cut=matching.cut=false;matching.o=1;matching.s=0;const yellows=G.wires.filter(w=>BB.kindOf(w)==='y');yellows[2].cut=yellows[3].cut=false;yellows[2].o=0;yellows[2].s=0;yellows[3].o=1;yellows[3].s=0;G.turn=0;resort(G);return {G,x,matching,own:yellows[2],target:yellows[3]};}
module.exports={game,setup,resort,lastYellow};
