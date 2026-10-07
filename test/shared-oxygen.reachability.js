// 完整牌面参考策略，只检验给定发牌存在合法通关路径，不用于机器人或生产游戏。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function remainingCost(G,excluded=[]){
 let total=0;
 for(let value=1;value<=12;value++){
  const wires=G.wires.filter(w=>!w.cut&&w.v===value&&!excluded.includes(w.id));
  if(wires.length){const sameOwner=wires.every(w=>w.o===wires[0].o);total+=BB.oxygenCost(value)*(wires.length===4&&!sameOwner?2:1);}
 }
 return total;
}
function play(n,seed){
 const G=BB.createGame(M.get('official-development',44),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'来源参考'+i})),{captain:seed%n,rng:rng(seed*104729)});
 let actions=0,skips=0,avoidances=0;
 while(['setup','play'].includes(G.phase)&&actions<350){
  const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;
  const ready=value=>G.equip.some(e=>e.n===value&&!e.used&&BB.equipUnlocked(G,value));let action;
  if(G.phase==='setup')action={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending){const pd=G.pending;action={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.includes(G.wires[id].v))};}
  else if(ready(6)&&G.det>0)action={a:'equip',n:6};
  else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut),oxygen=G.officialState.oxygen;let future=0;
   for(let k=1;k<n;k++){
    const other=(pi+k)%n;if(other===G.captain)break;
    const costs=G.wires.filter(w=>w.o===other&&!w.cut&&Number.isInteger(w.v)).map(w=>BB.oxygenCost(w.v));
    if(costs.length)future+=Math.min(...costs);
   }
   const candidates=[];
   for(const value of [...new Set(own.filter(w=>Number.isInteger(w.v)).map(w=>w.v))]){
    const cost=BB.oxygenCost(value);if(cost>oxygen.available)continue;
    const mine=own.filter(w=>w.v===value),solo=BB.soloOk(G,pi,value);
    const targets=solo?[null]:G.wires.filter(w=>w.o!==pi&&!w.cut&&w.v===value);
    for(const target of targets){
     const removed=(pi===G.captain?(solo?mine.length:1):0)+(target?.o===G.captain?1:0);
     const captainBlue=G.wires.filter(w=>w.o===G.captain&&!w.cut&&Number.isInteger(w.v)).length;
     const ending=removed===captainBlue&&captainBlue>0;
     const cutIds=solo?mine.map(w=>w.id):[mine[0].id,target.id];
     const unsafe=ending&&remainingCost(G,cutIds)>oxygen.available-cost;
     const score=(cost+future<=oxygen.available?cost*10:-cost*10)+(solo&&mine.length===4?10:0)-(ending?50:0);
     candidates.push({score,unsafe,action:solo?{a:'solo',val:value}:{a:'dual',w:target.id,val:value}});
    }
   }
   candidates.sort((a,b)=>b.score-a.score);const safe=candidates.find(c=>!c.unsafe);
   if(safe)action=safe.action;
   else{
    if(candidates.some(c=>c.unsafe))avoidances++;
    const reds=own.length&&own.every(w=>BB.kindOf(w)==='r');
    if(reds&&(pi!==G.captain||remainingCost(G)<=oxygen.available))action={a:'red'};
    else if(ready(11)){
     const next=pi!==G.captain&&G.wires.some(w=>w.o===G.captain&&!w.cut)?G.captain:G.players.findIndex((_,owner)=>owner!==pi&&G.wires.some(w=>w.o===owner&&!w.cut));
     if(next>=0)action={a:'equip',n:11,p:next};
    }
    if(!action)action={a:'oxygen-skip',stab:ready(9)};
   }
  }
  assert.equal(BB.act(G,pi,action),null,`人数${n} 种子${seed} ${JSON.stringify(action)}`);
  actions++;if(action.a==='oxygen-skip')skips++;
  assert(G.officialState.oxygen.available>=0&&G.officialState.oxygen.available<=n*2);
 }
 return {G,actions,skips,avoidances};
}
let actions=0,skips=0,avoidances=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const result=play(n,seed);assert.equal(result.G.phase,'won',`来源整局未获胜：人数${n} 种子${seed}`);
 assert(result.G.wires.every(w=>w.cut));assert.equal(result.G.wires.length,49);actions+=result.actions;skips+=result.skips;avoidances+=result.avoidances;
}
assert(avoidances>0,'应覆盖避免提前耗完队长手牌的策略');
console.log(`✓ 第44关100局来源参考整局获胜：${actions}次合法动作、${skips}次主动跳过、${avoidances}次提前清空队长风险规避；未修改补氧规则，不证明任意发牌或推理能力`);
