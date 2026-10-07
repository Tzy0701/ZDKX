const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./all-outward.fixture');
const ids=['triple-detector','xy-ray','general-radar','walkie-talkies'],results={won:0,lost:0};let actions=0;
for(const n of [2,3,4,5])for(let variant=0;variant<4;variant++){
 const cap=variant%n,roles=Array(n).fill('double-detector');let index=0;roles.forEach((_,p)=>{if(p!==cap)roles[p]=ids[(variant+index++)%ids.length];});const G=game(n,cap,n*19001+variant,roles);setup(G);let steps=0;
 while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'朝外任务机器人不能无故停住');const error=BB.act(G,pi,a);assert.equal(error,null,JSON.stringify({a,character:G.players[pi].character}));actions++;}
 assert(['won','lost'].includes(G.phase),'不得循环或超限');results[G.phase]++;
}
console.log('✓ 第56关2–5人四种额外角色16局：'+JSON.stringify(results)+'，'+actions+'动作，非法／停止／超限0；只认证允许动作，不认证完整策略或版别例外');
