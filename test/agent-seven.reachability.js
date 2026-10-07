// 按开发模块当前德文卡解释验证来源发牌；不能据此裁定法语“最后拆”版本差异。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
let actions=0,early=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=BB.createGame(M.get('official-development',46),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'许可来源参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let steps=0;
 while(['setup','play'].includes(G.phase)&&steps<500){
  const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending?.type==='precision-cut')a={a:'precision-reply',id:G.pending.id};
  else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}
  else if(G.officialState.license.required){a={a:'precision-cut',ws:G.wires.filter(w=>!w.cut&&w.v===7).map(w=>w.id)};if(G.wires.some(w=>!w.cut&&w.v!==7))early++;}
  else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut);
   for(const val of [...new Set(own.map(w=>BB.annOf(w)))]){if(val===7)continue;if(BB.soloOk(G,pi,val)){a={a:'solo',val};break;}const target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,val));if(target){a={a:'dual',val,w:target.id};break;}}
  }
  assert(a,`许可参考无动作：人数${n} 种子${seed}`);assert.equal(BB.act(G,pi,a),null);steps++;actions++;
 }
 assert.equal(G.phase,'won');assert(G.wires.every(w=>w.cut));assert.equal(G.wires.length,52);assert(G.officialState.precision.complete);assert.equal(G.det,0);
}
assert(early>0);console.log(`✓ 第46关当前德文解释100局来源参考获胜：${actions}动作，${early}局在其他导线仍未剪时许可成功；不验证法语最后拆解释或底盒即时效果`);
