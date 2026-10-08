// 储备箱内部恢复组件夹具；不认证即时触发时机或第55关整局。
const {create:base}=require('./grapple.fixture');
function create(n=3,cap=0){const G=base(n,cap,n*7919+cap);G.equip=[{n:15,id:'emergency-reserve',used:false},{n:3,id:'triple-detector',used:true},{n:7,id:'emergency-battery',used:true},{n:14,id:'unique-label',used:true},{n:16,id:'wire-cutter',used:true},{n:18,id:'grapple',used:true},{n:4,id:'sticky-note',used:false}];G.players.forEach(p=>{p.dd=0;p.character.used=true;});for(const value of [2,7,9,11])G.wires.filter(w=>w.v===value).forEach(w=>{w.cut=true;w.info=null;});return G;}
function unlock(G){G.wires.filter(w=>w.v===3).forEach(w=>{w.cut=true;w.info=null;});}
module.exports={create,unlock};
