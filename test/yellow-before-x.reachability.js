// 固定原始发牌全信息参考，只验证路径，不提供给生产机器人。
const assert=require('assert'),BB=require('../js/engine'),F=require('./yellow-before-x.fixture');
let games=0,solos=0,duals=0,reds=0,actions=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=25;seed++){
 const base=F.game(n,seed%n,seed);F.setup(base);const fingerprint=JSON.stringify(base),G=JSON.parse(fingerprint);
 function act(pi,a){assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
 let limit=0;
 while(G.phase==='play'&&limit++<500){
  const pi=G.turn;
  const own=G.wires.filter(w=>w.o===pi&&!w.cut);
  if(own.every(w=>BB.kindOf(w)==='r')){act(pi,{a:'red'});reds++;continue;}
  const values=[...new Set(own.filter(w=>BB.kindOf(w)!=='r').map(w=>BB.kindOf(w)==='y'?'Y':w.v))].filter(v=>BB.actorValueAllowed(G,pi,v)).sort((a,b)=>a==='Y'?-1:b==='Y'?1:a-b);
  const solo=values[0]!==undefined&&BB.soloOk(G,pi,values[0])?values[0]:undefined;
  if(solo!==undefined){act(pi,{a:'solo',val:solo});solos++;continue;}
  let value,target;for(const v of values){if(BB.soloOk(G,pi,v)){value=v;break;}const t=G.wires.find(w=>w.o!==pi&&!w.cut&&BB.matches(w,v)&&BB.targetAllowed(G,pi,w));if(t){value=v;target=t;break;}}if(!target&&value!==undefined){act(pi,{a:'solo',val:value});solos++;continue;}assert(target,'尚无合法参考行动：'+n+'人种子'+seed);act(pi,{a:'dual',w:target.id,val:value});duals++;
  act(target.o,{a:'resolve',id:G.pending.id,w:target.id});assert.equal(G.pending.step,'own');const choice=G.pending.choices?.at(-1)||BB.view(G,pi).pending.choices.at(-1);act(pi,{a:'resolve',id:G.pending.id,w:typeof choice==='object'?choice.id:choice});
 }
 assert.equal(G.phase,'won');assert.equal(G.det,0);assert(G.wires.every(w=>w.cut));assert(!G.pending);assert.equal(JSON.stringify(base),fingerprint);games++;
}
console.log('✓ 第35关100固定原始发牌全信息参考通关：'+actions+'合法动作、'+solos+'单拆、'+duals+'双拆、'+reds+'主动红线公开；优先处理可剪黄线、原开局不改、X锁定期间未被剪或用于装备、引爆器0，非生产推理及任意发牌证明');
