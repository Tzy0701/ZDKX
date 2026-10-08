// 完整手牌仅用于来源发牌可达性参考；各策略变体保持同一发牌，不能用于生产机器人或裁定版本差异。
const assert=require('assert');
const BB=require('../js/engine'),M=require('../js/missions');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function play(n,seed,variant){const random=rng(seed*6907+variant*179+1),G=BB.createGame(M.get('official-development',49),Array.from({length:n},(_,i)=>({pid:'p'+i,name:'个人氧气参考'+i})),{captain:seed%n,rng:rng(seed*104729)});let actions=0,skips=0;
while(['setup','play'].includes(G.phase)&&actions<400){const pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,ready=v=>G.equip.some(e=>e.n===v&&!e.used&&BB.equipUnlocked(G,v));let a;
if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices[0]:pd.ids.find(id=>G.wires[id].v===pd.vals[0])};}
else if(ready(6)&&G.det>0)a={a:'equip',n:6};
else{const own=G.wires.filter(w=>w.o===pi&&!w.cut),s=BB.personalOxygen(G),choices=[];
for(const value of [...new Set(own.filter(w=>Number.isInteger(w.v)).map(w=>w.v))]){if(value>s.balances[pi])continue;const mine=own.filter(w=>w.v===value),solo=BB.soloOk(G,pi,value),targets=solo?[null]:G.wires.filter(w=>w.o!==pi&&!w.cut&&w.v===value);
for(const target of targets)for(let recipient=0;recipient<n;recipient++){if(recipient===pi)continue;const removed=solo?mine.map(w=>w.id):[mine[0].id,target.id],balances=s.balances.slice();balances[pi]-=value;balances[recipient]+=value;const remaining=G.wires.filter(w=>!w.cut&&!removed.includes(w.id)),blue=remaining.filter(w=>Number.isInteger(w.v)),max=blue.length?Math.max(...blue.map(w=>w.v)):0;let waste=0,shortage=0;
for(let p=0;p<n;p++){const hand=blue.filter(w=>w.o===p);if(!hand.length){waste+=balances[p];balances[p]=0;}else{const need=Math.min(...hand.map(w=>w.v)),distance=(p-pi+n)%n;shortage+=Math.max(0,need-balances[p])*(distance===1?4:1);}}
const surviving=balances.reduce((a,b)=>a+b,0),score=value*2+(solo?8:0)-waste*12-shortage*3-(surviving<max?1000:0)+random()*(variant?20:0);
choices.push({score,a:solo?{a:'solo',val:value,oxygenTo:recipient}:{a:'dual',w:target.id,val:value,oxygenTo:recipient}});
}}
choices.sort((a,b)=>b.score-a.score);if(choices.length&&choices[0].score>-800)a=choices[0].a;
if(!a&&own.every(w=>BB.kindOf(w)==='r'))a={a:'red'};
if(!a&&ready(11)){const receiver=G.players.findIndex((_,p)=>p!==pi&&G.wires.some(w=>w.o===p&&!w.cut&&Number.isInteger(w.v)));if(receiver>=0)a={a:'equip',n:11,p:receiver};}
if(!a)a={a:'personal-oxygen-skip',stab:ready(9)};
}
const error=BB.act(G,pi,a);if(error)throw Error(JSON.stringify({n,seed,variant,a,error}));if(a.a==='personal-oxygen-skip')skips++;const state=BB.personalOxygen(G);assert.equal(state.balances.reduce((sum,v)=>sum+v,0)+state.discarded,state.total);assert(state.balances.every(v=>v>=0));actions++;
}return {G,actions,skips};}
let wins=0,attempts=0,actions=0,skips=0,failures=[];for(const n of [2,3,4,5])for(let seed=1;seed<=25;seed++){let found;for(let variant=0;variant<64;variant++){const r=play(n,seed,variant);attempts++;if(r.G.phase==='won'){found=r;break;}}if(found){assert(found.G.wires.every(w=>w.cut));assert.equal(found.G.wires.length,n===2?51:50);wins++;actions+=found.actions;skips+=found.skips;}else failures.push({n,seed});}assert.equal(wins,100,JSON.stringify(failures));assert.deepEqual(failures,[]);console.log('✓ 第49关100局固定来源发牌完整参考获胜：'+attempts+'次策略尝试、'+actions+'动作、'+skips+'次跳过；全过程氧气守恒，不裁定法德例外或证明机器人策略');
