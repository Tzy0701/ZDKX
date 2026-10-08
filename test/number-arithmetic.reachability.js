// 同一来源发牌的有界完整牌面路径搜索，不能用于机器人或证明任意发牌必胜。
const assert=require('assert'),BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function play(n,seed,variant){
 const decision=rng(variant*100003+seed*997+n),G=BB.createGame(M.get('official-development',47),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'算式来源参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let steps=0;
 while(['setup','play'].includes(G.phase)&&steps<500){
  const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn;let a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.some(value=>BB.matches(G.wires[id],value)))};}
  else{
   const own=G.wires.filter(w=>w.o===pi&&!w.cut),state=BB.arithmetic(G),ready=value=>G.equip.some(e=>e.n===value&&!e.used&&BB.equipUnlocked(G,value));
   if(ready(6)&&G.det>0)a={a:'equip',n:6};
   else if(own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};
   else{
    const candidates=[];
    for(const value of [...new Set(own.filter(w=>Number.isInteger(w.v)).map(w=>w.v))])for(const pair of BB.arithmeticPairs(G,value)){
     const solo=BB.soloOk(G,pi,value),target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);if(!solo&&!target)continue;
     const removed=solo?own.filter(w=>w.v===value).map(w=>w.id):[own.find(w=>w.v===value).id,target.id],remaining=state.open.filter(v=>!pair.cards.includes(v)),temp={official:{arithmetic:{open:remaining}}};let coverage=0;
     if(!remaining.length)coverage=100;
     else for(let k=1;k<=n;k++){const owner=(pi+k)%n,next=G.wires.filter(w=>w.o===owner&&!w.cut&&!removed.includes(w.id)&&Number.isInteger(w.v));if(next.length){coverage=[...new Set(next.map(w=>w.v))].filter(v=>BB.arithmeticPairs(temp,v).length).length;break;}}
     candidates.push({score:coverage*10+(solo&&removed.length===4?5:0)+decision()*(variant===0?0:15),action:Object.assign(solo?{a:'solo',val:value}:{a:'dual',val:value,w:target.id},pair)});
    }
    candidates.sort((a,b)=>b.score-a.score);a=candidates.length?candidates[0].action:{a:'arithmetic-skip',cards:state.open.slice(0,2)};
   }
  }
  assert.equal(BB.act(G,pi,a),null,`人数${n} 种子${seed} 策略${variant} ${JSON.stringify(a)}`);steps++;
 }
 return {G,steps};
}
let actions=0,attempts=0,maxVariant=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 let result,variant;
 for(variant=0;variant<64;variant++){result=play(n,seed,variant);attempts++;if(result.G.phase==='won')break;}
 assert.equal(result.G.phase,'won',`有界搜索未找到路径：人数${n} 种子${seed}`);assert(result.G.wires.every(w=>w.cut));assert.equal(result.G.wires.length,n===2?51:50);assert.equal(new Set(BB.arithmetic(result.G).open.concat(BB.arithmetic(result.G).discard)).size,12);actions+=result.steps;maxVariant=Math.max(maxVariant,variant);
}
console.log(`✓ 第47关2–5人100个来源发牌找到合法通关路径：${actions}次获胜路径动作、${attempts}次策略尝试、最大策略索引${maxVariant}；同发牌只变选牌策略，不证明机器人或任意发牌必胜`);
