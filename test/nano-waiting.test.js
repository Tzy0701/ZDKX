// 原始来源可重复的等待局面；不把未有官方裁定的三根情况扩写为自动引爆。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions'),Bot=require('../js/bot');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const oldRandom=Math.random;let G,steps=0;
try{Math.random=rng(6*104729);G=BB.createGame(M.get('campaign',43),Array.from({length:3},(_,i)=>({pid:'p'+i,name:'等待复核'+i,bot:true})),{rng:Math.random});while(!['won','lost'].includes(G.phase)&&steps<500){let acted=false;for(let pi=0;pi<3;pi++){const a=Bot.decide(G,pi);if(!a)continue;assert.equal(BB.act(G,pi,a),null);steps++;acted=true;break;}if(!acted)break;}}finally{Math.random=oldRandom;}
assert.equal(steps,69);assert.equal(G.phase,'play');assert(BB.nano(G).waiting);assert.equal(G.wires.filter(w=>!w.cut&&w.o===0&&w.v===5).length,3);assert(G.players.slice(1).every(p=>p.stands.flat().every(id=>G.wires[id].cut)));
assert.equal(BB.recoverFatalState(G),false);assert.equal(G.result,null);const saved=JSON.parse(JSON.stringify(G));assert.equal(BB.recoverFatalState(saved),false);
for(const pi of [-1,0,1,2]){const V=BB.view(saved,pi);assert.equal(V.official.nano.waitingReason,'no-other-player');assert(!('reserve' in V.official.nano));assert(!('revealed' in V.official.nano));assert(!('values' in V.official.nano));assert.equal(V.result,null);}
const singleton=JSON.parse(JSON.stringify(G));singleton.wires.filter(w=>w.o===0&&!w.cut&&(w.v===8.5||w.v===5)).slice(0,3).forEach(w=>{w.cut=true;});
// 独立构造已确认的一蓝／备用配对条件，保留红线在备用堆。
const blue=singleton.wires.filter(w=>w.o===0&&w.v===5);blue[0].cut=false;blue[1].cut=true;blue[2].cut=true;singleton.wires.filter(w=>w.o===0&&w.v===8.5).forEach(w=>{w.cut=true;});assert(BB.recoverFatalState(singleton));assert.equal(singleton.phase,'lost');
console.log('✓ 第43关三人来源种子6：69次合法动作后三蓝5／备用一蓝5等待；公共说明只含队友已清空，不传备用值，不擅自引爆，保存不误判；已确认一蓝配对仍引爆');
