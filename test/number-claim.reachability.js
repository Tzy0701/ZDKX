// 完整牌面来源参考路径，仅检验指定发牌的合法可达性，不作为机器人策略。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
let actions=0,redReveals=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const G=BB.createGame(M.get('official-development',45),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'认领来源参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let steps=0;
 while(['setup','play'].includes(G.phase)&&steps<500){
  const r=G.officialState.numberClaim;let pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending){const pd=G.pending;assert.equal(pd.type,'cut');a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.includes(G.wires[id].v))};}
  else if(r.step==='draw'){pi=G.captain;a={a:'claim-draw',id:r.decisionId};}
  else if(r.step==='claim'){
   const matching=G.wires.filter(w=>!w.cut&&w.v===r.value);if(matching.length){pi=matching[0].o;const solo=G.players.findIndex((_,owner)=>BB.soloOk(G,owner,r.value));if(solo>=0)pi=solo;}
   else{const red=G.wires.find(w=>!w.cut&&BB.kindOf(w)==='r');assert(red,'无数字时应只剩待公开红线');pi=red.o;assert(G.wires.filter(w=>w.o===pi&&!w.cut).every(w=>BB.kindOf(w)==='r'));}
   a={a:'claim-number',id:r.decisionId};
  }else{
   assert.equal(r.step,'cut');pi=r.actor;const own=G.wires.filter(w=>w.o===pi&&!w.cut);
   if(own.every(w=>BB.kindOf(w)==='r')){a={a:'red'};redReveals++;}
   else if(BB.soloOk(G,pi,r.value))a={a:'solo',val:r.value};
   else{const target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===r.value);assert(target);a={a:'dual',w:target.id,val:r.value};}
  }
  assert.equal(BB.act(G,pi,a),null,`人数${n} 种子${seed} ${JSON.stringify(a)}`);steps++;actions++;
 }
 assert.equal(G.phase,'won',`认领整局未通关：人数${n} 种子${seed}`);assert(G.wires.every(w=>w.cut));assert.equal(G.det,0);assert.equal(G.wires.length,n===2?51:50);assert.equal(G.officialState.numberClaim.retired.length,12);
}
assert(redReveals>0);console.log(`✓ 第45关2–5人100局来源参考整局获胜：${actions}次合法动作、${redReveals}次红线公开、全部12数字退场，未使用暂定错误认领／指定缺值路径`);
