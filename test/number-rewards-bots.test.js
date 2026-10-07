const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./number-rewards.fixture');
const results={won:0,lost:0};let actions=0,bonuses=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;
 while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'当前玩家不得无故停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
 assert(['won','lost'].includes(G.phase),'不得超限或循环拒绝');results[G.phase]++;bonuses+=BB.numberRewards(G).completed.length;
}
console.log('✓ 第62关2–5人16局推理机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+bonuses+'次四根数字奖励，非法／停止／超限0；仅合法终局，不认证策略充分或所有任务例外');
