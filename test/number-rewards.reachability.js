// 第62关完整来源发牌的全信息参考路径；不供推理机器人调用，不认证即时装备触发。
const assert=require('assert'),BB=require('../js/engine'),{game,setup}=require('./number-rewards.fixture');
let actions=0,reds=0,bonuses=0;const failures=[],seeds=Number(process.env.BB_REWARD_SEEDS||25);
for(const n of [2,3,4,5])for(let seed=1;seed<=seeds;seed++){
 const base=game(n,seed%n,seed);setup(base);const fingerprint=JSON.stringify(base),G=JSON.parse(JSON.stringify(base));let steps=0;
 while(G.phase==='play'&&steps++<150){const pi=G.pending?G.pending.to:G.turn;let a;
  if(G.pending){const p=G.pending;assert.equal(p.type,'cut');a={a:'resolve',id:p.id,w:p.step==='target'?p.ids[0]:BB.view(G,pi).pending.choices.at(-1)};}
  else{const own=G.wires.filter(w=>w.o===pi&&!w.cut);assert(own.length);if(own.every(w=>BB.kindOf(w)==='r')){a={a:'red'};reds++;}else{const values=[...new Set(own.filter(w=>Number.isInteger(w.v)).map(w=>w.v))].sort((a,b)=>own.filter(w=>w.v===b).length-own.filter(w=>w.v===a).length||a-b),value=values[0];if(BB.soloOk(G,pi,value))a={a:'solo',val:value};else{const target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);assert(target);a={a:'dual',w:target.id,val:value};}}}
  assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;const reward=BB.numberRewards(G);assert(reward.completed.every(v=>BB.cutCount(G,v)===4));assert.equal(G.det,-Math.min(reward.completed.length,4),'无错误／无装备时只按已完成奖励后退并保留最早格');
 }
 if(G.phase!=='won')failures.push({n,seed,phase:G.phase});else{assert(G.wires.every(w=>w.cut));assert.equal(BB.numberRewards(G).completed.length,n);assert(!G.pending);assert.equal(G.det,-Math.min(n,4));bonuses+=BB.numberRewards(G).completed.length;}
 assert.equal(JSON.stringify(base),fingerprint,'同一开局不能被修改或重发以寻找解');
}
console.log(JSON.stringify({games:seeds*4,actions,reds,bonuses,failures}));if(failures.length)process.exitCode=1;
