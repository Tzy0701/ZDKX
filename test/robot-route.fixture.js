// 第59关来源设置；后段测试会明确重排持有者，不当作真实开局通关。
const BB=require('../js/engine'),M=require('../js/missions');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function game(n=3,cap=0,seed=1,roles){return BB.createGame(M.get('official-development',59),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'路线玩家'+i,character:roles&&roles[i]})),{captain:cap,rng:rng(seed*104729)});}
function setup(G){while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&!w.info&&BB.setupInfoAllowed(G,w));const error=BB.act(G,p,{a:'info',w:w.id});if(error)throw Error(error);}}
function resort(G){G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
function row(G,position=0,direction=1){const s=G.officialState.robotRoute;s.row=Array.from({length:12},(_,i)=>i+1);s.position=position;s.direction=direction;G.turn=0;}
function pair(G,value=1){G.wires.filter(w=>w.v===value).forEach((w,i)=>{w.o=i<2?0:1;w.s=0;w.info=null;});resort(G);return G.wires.filter(w=>w.v===value);}
module.exports={game,setup,resort,row,pair};
