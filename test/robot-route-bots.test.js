const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./robot-route.fixture');
const results={won:0,lost:0};let actions=0,directions=0,reversals=0;
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;
 while(G.phase==='play'&&steps++<400){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'当前路线玩家不得无故停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;if(a.a==='robot-direction')directions++;if(a.a==='robot-reverse')reversals++;}
 assert(['won','lost'].includes(G.phase),'机器人不得反复拒绝或超过动作上限');results[G.phase]++;
}
console.log('✓ 第59关2–5人16局机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+directions+'次朝向／'+reversals+'次罚格反向，非法／停止／超限0；仅合法性与终局，不认证策略充分或正式全关');
{
 const ids=['triple-detector','general-radar','walkie-talkies'],result={won:0,lost:0};let moves=0,choices=0,reverse=0;
 for(const n of [2,3,4,5])for(let variant=0;variant<4;variant++){
  const cap=variant%n,roles=Array(n).fill('double-detector');let index=0;roles.forEach((_,p)=>{if(p!==cap){roles[p]=index<ids.length?ids[(variant+index)%ids.length]:'double-detector';index++;}});const G=game(n,cap,n*19001+variant,roles);setup(G);let steps=0;
  while(G.phase==='play'&&steps++<400){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'额外角色不能无故停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify({a,role:G.players[pi].character}));moves++;if(a.a==='robot-direction')choices++;if(a.a==='robot-reverse')reverse++;}assert(['won','lost'].includes(G.phase));result[G.phase]++;
 }
 console.log('✓ 第59关三种额外角色2–5人16局：'+JSON.stringify(result)+'，'+moves+'动作／'+choices+'次朝向／'+reverse+'次罚格反向，非法／停止／超限0；只认证合法性与终局');
}
{
 const {row,resort}=require('./robot-route.fixture');for(const n of [2,3,4,5]){const G=game(n);setup(G);row(G,11,1);G.wires.filter(w=>w.v===12).forEach(w=>{w.o=1;w.s=0;});resort(G);G.equip=[];const before=G.turnNo,a=Bot.decide(G,0);assert.equal(a.a,'robot-reverse');assert.equal(BB.act(G,0,a),null);assert.equal(G.det,1);assert.equal(G.turnNo,before);assert.equal(G.officialState.robotRoute.direction,-1);const move=Bot.decide(G,0);assert.equal(move.a,'robot-move');assert.equal(BB.act(G,0,move),null);assert.equal(G.officialState.robotRoute.step,'cut');assert.equal(G.det,1);}
}
console.log('✓ 第59关2–5人强制无前方蓝值夹具：机器人合法反向罚一格、仍在自己回合，随后选择新可达值，不循环拒绝；非整局证明');
