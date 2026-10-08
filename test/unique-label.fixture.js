// 第五盒单一标签的原卡用线夹具；不认证第55关整局。
const {create:base}=require('./grapple.fixture');
function create(n=3,cap=0,actor=0){const G=base(n,cap,n*7919+cap*17+actor);G.equip=[{n:14,id:'unique-label',used:false}];return G;}
function unlock(G){G.wires.filter(w=>w.v===2).forEach(w=>{w.cut=true;w.info=null;});}
function target(G,actor,unmarked=false){return G.wires.find(w=>w.o===actor&&(!unmarked||!w.info)&&w.v!==2&&Number.isInteger(w.v)&&G.players[actor].stands[w.s].filter(id=>G.wires[id].v===w.v).length===1);}
module.exports={create,unlock,target};
