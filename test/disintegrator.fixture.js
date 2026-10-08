// 明确法文版的内部效果夹具；不认证即时自动触发或55整关。
const BB=require('../js/engine'),C=require('../js/campaign-rules'),{create:base}=require('./grapple.fixture');
function create(n=3,cap=0){const G=base(n,cap,n*7919+cap);G.equip=[{n:17,id:'disintegrator',used:false}];G.wires.filter(w=>w.v===2).forEach(w=>w.info=null);return G;}
function unlock(G){G.wires.filter(w=>w.v===10).forEach(w=>{w.cut=true;w.info=null;});}
function event(G,generation=0){return {gid:G.gid,n:17,generation,edition:'fr'};}
function randomFor(G,value){const tokens=C.availableInfoTokens(G,false),i=tokens.findIndex(t=>t.value===value);if(i<0)throw Error('夹具所需数字标记不可用');return()=> (i+.5)/tokens.length;}
function apply(G,value,generation=0){const err=BB.applyEquipmentEffect(G,event(G,generation),{serverEquipment:true,rng:randomFor(G,value)});if(err)throw Error(err);}
module.exports={create,unlock,event,randomFor,apply};
