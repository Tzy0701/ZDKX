// 固定原始发牌全信息参考，只验证路径，不提供给生产机器人。
const assert=require('assert'),BB=require('../js/engine'),F=require('./weak-link.fixture');
let games=0,guesses=0,passes=0,solos=0,duals=0,reds=0,actions=0;
for(let n=3;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const base=F.game(n,seed%n,seed);F.setup(base);const fingerprint=JSON.stringify(base),G=JSON.parse(fingerprint);
 function act(pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
 let limit=0;
 while(G.phase==='play'&&limit++<500){
  const pi=G.turn,s=BB.weakLink(G);if(s.startPending){if(pi===s.owner){act(pi,{a:'weak-pass',id:s.decisionId});passes++;}else{act(pi,{a:'weak-guess',id:s.decisionId,player:s.owner,constraint:s.cards[s.owner]});guesses++;}}
  const own=G.wires.filter(w=>w.o===pi&&!w.cut);
  if(own.every(w=>BB.kindOf(w)==='r')){act(pi,{a:'red'});reds++;continue;}
  const values=[...new Set(own.filter(w=>BB.kindOf(w)!=='r').map(w=>BB.kindOf(w)==='y'?'Y':w.v))].filter(v=>BB.actorValueAllowed(G,pi,v));
  const solo=values.find(v=>BB.soloAllowed(G,pi,own.filter(w=>BB.matches(w,v)))&&own.filter(w=>BB.matches(w,v)).length===G.wires.filter(w=>!w.cut&&BB.matches(w,v)).length);
  if(solo!==undefined){act(pi,{a:'solo',val:solo});solos++;continue;}
  const value=values[0],target=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,value));assert(target);act(pi,{a:'dual',w:target.id,val:value});duals++;
  act(target.o,{a:'resolve',id:G.pending.id,w:target.id});assert.equal(G.pending.step,'own');const choice=G.pending.choices?.at(-1)||BB.view(G,pi).pending.choices.at(-1);act(pi,{a:'resolve',id:G.pending.id,w:typeof choice==='object'?choice.id:choice});
 }
 assert.equal(G.phase,'won');assert(G.det<=2);assert(G.wires.every(w=>w.cut));assert(!G.pending);assert.equal(JSON.stringify(base),fingerprint);games++;
}
console.log('✓ 第34关75固定原始发牌全信息参考通关：'+actions+'合法动作、'+guesses+'次正确猜身份和限制、'+passes+'次弱环节不猜、'+solos+'单拆、'+duals+'双拆、'+reds+'主动红线公开；原始开局不改，猜对后原角色保持，不认证真实身份推理或任意发牌');
