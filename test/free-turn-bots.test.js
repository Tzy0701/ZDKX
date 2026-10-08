const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),F=require('./free-turn.fixture');
let actions=0,claims=0,won=0,lost=0;
for(let n=2;n<=5;n++)for(let seed=1;seed<=4;seed++){
 const G=F.game(n,seed%n,seed);F.setup(G);let turns=0;
 while(G.phase==='play'&&turns++<2000){let pi=G.pending?G.pending.to:BB.freeTurn(G).step==='claim'?G.players.findIndex((_,p)=>BB.freeTurnEligible(G,p)):G.turn;assert(pi>=0);const a=Bot.decide(G,pi);assert(a,`${n}人种子${seed}无合法选择`);const err=BB.act(G,pi,a);assert.equal(err,null,JSON.stringify(a));actions++;if(a.a==='turn-claim')claims++;}
 assert(['won','lost'].includes(G.phase),`${n}人种子${seed}循环未终止`);if(G.phase==='won')won++;else lost++;
}
console.log('✓ 第10关2–5人16来源开局推理机器人：'+won+'胜'+lost+'败、'+actions+'合法动作／'+claims+'次抢回合，非法／停止／超限0；仅合法性，不认证任意发牌或策略充分');
