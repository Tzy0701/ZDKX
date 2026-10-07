// 第55关原卡用线的装备组件夹具；不认证特殊引爆器／挑战／整关。
const BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function create(n=3,cap=0,seed=1){const mission=JSON.parse(JSON.stringify(M.get('physical',4)));Object.assign(mission,{id:55,y:[0,0],r:[2,2],two:{r:[2,3]},eq:0,verified:false});delete mission.officialModule;const G=BB.createGame(mission,Array.from({length:n},(_,i)=>({pid:'p'+i,name:'抓钩玩家'+i})),{captain:cap,rng:rng(seed)});while(G.phase==='setup'){const p=BB.setupActor(G),w=G.wires.find(w=>w.o===p&&BB.setupInfoAllowed(G,w));if(BB.act(G,p,{a:'info',w:w.id}))throw Error('夹具初始化失败');}G.equip=[{n:18,id:'grapple',used:false}];return G;}
function unlock(G){G.wires.filter(w=>w.v===11).forEach(w=>{w.cut=true;w.info=null;});}
module.exports={create,unlock,rng};
