// 原卡用线的装备组件夹具；同值持有量用于直接构造合法选择，不认证55整关。
const {create:base}=require('./grapple.fixture');
function resort(G){G.players.forEach((p,owner)=>p.stands=p.stands.map((_,rack)=>G.wires.filter(w=>w.o===owner&&w.s===rack).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));}
function create(n=3,cap=0,actor=0,count=3){const G=base(n,cap,n*7919+cap*17+actor),copies=G.wires.filter(w=>w.v===2);copies.forEach((w,i)=>{w.o=i<count?actor:(actor+1)%n;w.s=i<count?i%G.players[actor].stands.length:0;w.info=null;});resort(G);G.equip=[{n:16,id:'wire-cutter',used:false}];G.turn=actor;return G;}
function unlock(G){G.wires.filter(w=>w.v===9).forEach(w=>{w.cut=true;w.info=null;});}
module.exports={create,unlock,resort};
