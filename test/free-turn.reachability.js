// 固定原始发牌全信息参考，只验证路径，不提供给生产机器人。
const assert=require('assert'),BB=require('../js/engine'),F=require('./free-turn.fixture');
let games=0,claims=0,solos=0,duals=0,reds=0,actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const base=F.game(n,seed%n,seed);F.setup(base);const fingerprint=JSON.stringify(base),G=JSON.parse(fingerprint),deadline=G.deadline;
 function act(pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;assert(G.phase==='won'||G.deadline===deadline);}
 let limit=0;
 while(G.phase==='play'&&limit++<500){
  const eligible=G.players.map((_,pi)=>pi).filter(pi=>BB.freeTurnEligible(G,pi));assert(eligible.length);
  const pi=eligible[0],own=G.wires.filter(w=>w.o===pi&&!w.cut);act(pi,{a:'turn-claim',id:BB.freeTurn(G).decisionId});claims++;
  if(own.every(w=>BB.kindOf(w)==='r')){act(pi,{a:'red'});reds++;continue;}
  const values=[...new Set(own.filter(w=>BB.kindOf(w)!=='r').map(w=>BB.kindOf(w)==='y'?'Y':w.v))];
  const solo=values.find(v=>BB.soloAllowed(G,pi,own.filter(w=>BB.matches(w,v)))&&own.filter(w=>BB.matches(w,v)).length===G.wires.filter(w=>!w.cut&&BB.matches(w,v)).length);
  if(solo!==undefined){act(pi,{a:'solo',val:solo});solos++;continue;}
  const value=values[0],target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,value));assert(target);act(pi,{a:'dual',w:target.id,val:value});duals++;
  act(target.o,{a:'resolve',id:G.pending.id,w:target.id});assert.equal(G.pending.step,'own');const choice=G.pending.choices?.at(-1)||BB.view(G,pi).pending.choices.at(-1);act(pi,{a:'resolve',id:G.pending.id,w:typeof choice==='object'?choice.id:choice});
 }
 assert.equal(G.phase,'won');assert.equal(G.det,0);assert(G.wires.every(w=>w.cut));assert(!G.pending);assert.equal(JSON.stringify(base),fingerprint);games++;
}
console.log('✓ 第10关100固定原始发牌参考全部通关：'+actions+'合法动作、'+claims+'次自由抢回合、'+solos+'次单拆、'+duals+'次双拆、'+reds+'次主动红线公开；换回合截止不变、原始开局不改、未用即时底盒，非生产推理或完整装备认证');
