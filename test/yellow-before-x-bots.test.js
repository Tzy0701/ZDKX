const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),F=require('./yellow-before-x.fixture');
let actions=0,won=0,lost=0,waiting=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=F.game(n,seed%n,seed);F.setup(G);let steps=0;
 while(G.phase==='play'&&steps++<2000){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);if(!a&&!G.pending&&!BB.canAct(G,pi)&&BB.xLocked(G)){waiting++;break;}assert(a,n+'人无合法选择');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
 if(G.phase==='won')won++;else if(G.phase==='lost')lost++;else assert(!G.pending&&!BB.canAct(G,G.turn)&&BB.xLocked(G),'未识别的循环');
}
console.log('✓ 第35关2–5人16来源开局机器人：'+won+'胜'+lost+'败'+waiting+'次锁定X等待、'+actions+'合法动作，非法／未识别停止／超限0；无可剪线的官方裁定仍待核实，等待不伪造胜负或免费跳过');
