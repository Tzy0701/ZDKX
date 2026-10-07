// 来源发牌的完整路径参考；全信息规划不能认证机器人策略或法德失败规则差异。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
let actions=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=25;seed++){
 const G=BB.createGame(M.get('official-development',48),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'三黄参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let steps=0;
 while(['setup','play'].includes(G.phase)&&steps<500){
  const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending?.type==='yellow-three-cut')a={a:'yellow-three-reply',id:G.pending.id};
  else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}
  else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut);
   if(!G.officialState.yellowThree.complete&&(n>=4||own.some(w=>BB.kindOf(w)==='y')))a={a:'yellow-three-cut',ws:G.wires.filter(w=>BB.kindOf(w)==='y').map(w=>w.id)};
   else if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};
   else for(const val of [...new Set(own.filter(w=>BB.kindOf(w)==='b').map(w=>w.v))]){if(BB.soloOk(G,pi,val)){a={a:'solo',val};break;}const target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===val);if(target){a={a:'dual',val,w:target.id};break;}}
  }
  assert(a,`三黄参考无动作：人数${n} 种子${seed}`);assert.equal(BB.act(G,pi,a),null);steps++;actions++;
 }
 assert.equal(G.phase,'won');assert(G.wires.every(w=>w.cut));assert.equal(G.wires.length,n===2?54:53);assert(G.officialState.yellowThree.complete);assert.equal(G.det,0);
}
console.log(`✓ 第48关100局来源发牌完整参考获胜：${actions}动作；不裁定失败标记、红线目标、修饰或底盒即时效果`);
