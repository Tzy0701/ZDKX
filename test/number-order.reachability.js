// 来源发牌全信息参考，只证明这些发牌存在合法通关路径；不用于生产长官策略。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
let actions=0,self=0,others=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=25;seed++){
 const G=BB.createGame(M.get('official-development',51),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'命令来源参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let steps=0;
 while(['setup','play'].includes(G.phase)&&steps<600){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,state=BB.numberOrder(G);let a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending?.type==='order-answer')a={a:'order-answer',id:G.pending.id};
  else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(v=>BB.matches(G.wires[id],v)))};}
  else if(state.step==='draw'){const own=G.wires.filter(w=>w.o===pi&&!w.cut);a=own.every(w=>BB.kindOf(w)==='r')?{a:'red'}:{a:'order-draw',id:state.decisionId};}
  else if(state.step==='assign'){const own=G.wires.find(w=>w.o===pi&&!w.cut&&w.v===state.value),chosen=own||G.wires.find(w=>!w.cut&&w.v===state.value);assert(chosen);a={a:'order-assign',id:state.decisionId,p:chosen.o};if(chosen.o===pi)self++;else others++;}
  else if(state.step==='cut'){const value=state.value;a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',val:value,w:G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value).id};}
  assert(a,`命令参考无动作：人数${n} 种子${seed}`);assert.equal(BB.act(G,pi,a),null);steps++;actions++;
 }assert.equal(G.phase,'won');assert(G.wires.every(w=>w.cut));assert.equal(G.wires.length,n===2?50:49);assert.equal(G.det,-1);assert.equal(BB.numberOrder(G).retired.length,12);
}
assert(self>0&&others>0);console.log(`✓ 第51关100局来源完整参考获胜：${actions}动作、${self}次指定自己／${others}次指定队友，零罚格且全部数字退场；不认证生产策略或装备例外`);
