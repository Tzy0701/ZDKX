const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./number-relay.fixture');
const results={won:0,lost:0};let actions=0,passes=0,skips=0;
for(const n of [3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;while(G.phase==='play'&&steps++<400){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'当前玩家／传牌者不能无故停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;if(a.a==='number-relay')passes++;if(a.a==='number-relay-skip')skips++;const cards=G.officialState.numberRelay.hands.flat();assert.equal(cards.length,12);assert.equal(new Set(cards).size,12);}assert(['won','lost'].includes(G.phase),'不能循环拒绝／超限');results[G.phase]++;
}
console.log('✓ 第65关3–5人12局推理机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+passes+'次传牌／'+skips+'次不匹配跳过，非法／停止／超限0、十二牌守恒；只用本人手牌和公共标记选接收者，不认证策略充分或全部例外');
