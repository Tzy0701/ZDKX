const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),F=require('./weak-link.fixture');
let actions=0,passes=0,won=0,lost=0,discarded=0;
for(let n=3;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=F.game(n,seed%n,seed);F.setup(G);let steps=0;
 while(G.phase==='play'&&steps++<2000){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,n+'人无选择');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;if(a.a==='weak-pass')passes++;}
 assert(['won','lost'].includes(G.phase),n+'人未终止');if(G.phase==='won')won++;else lost++;if(BB.weakLink(G).status==='discarded')discarded++;
}
console.log('✓ 第34关3–5人12来源开局机器人：'+won+'胜'+lost+'败、'+actions+'合法动作、'+passes+'次不猜、'+discarded+'次无法遵守后弃置；非法／停止／超限0，秘密阶段不使用个人装备，不认证识别策略或任意发牌');
