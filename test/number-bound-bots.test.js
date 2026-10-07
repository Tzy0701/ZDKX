const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),{game,setup}=require('./number-bound.fixture');
const results={won:0,lost:0};let actions=0,changes=0;
for(const n of [2,3,4,5]){
 const G=game(n);setup(G);const pair=G.wires.filter(w=>w.v===2);G.wires.forEach(w=>{w.cut=true;});pair.slice(0,2).forEach((w,p)=>{w.o=p;w.s=0;w.cut=false;w.info={t:'v',v:2};});G.players.forEach((p,o)=>p.stands=p.stands.map((_,s)=>G.wires.filter(w=>w.o===o&&w.s===s).sort((a,b)=>a.v-b.v||a.id-b.id).map(w=>w.id)));G.turn=0;G.officialState.constraints.active='K';G.officialState.constraints.completed=Array.from({length:12},(_,i)=>i+1).filter(v=>v!==2);G.equip=[{n:18,id:'grapple',used:false}];
 const action=Bot.decide(G,0,()=>.5);assert(action);assert(!(action.a==='equip'&&action.n===18),'K禁止单拆，不能抓走最后配对线堵死双拆');assert.equal(BB.act(G,0,action),null);while(G.pending){const pi=G.pending.to;assert.equal(BB.act(G,pi,Bot.decide(G,pi,()=>.5)),null);}assert.equal(G.phase,'won');assert.equal(G.equip[0].used,false);assert.equal(G.det,0);
}
console.log('✓ 第57关2–5人K限制尾局：机器人不抓走已知最后配对线，真实双拆及双方选择完成通关，抓钩未耗用；后段夹具非整局证明');
for(const n of [2,3,4,5])for(let seed=1;seed<=4;seed++){
 const G=game(n,seed%n,seed*7919);setup(G);let steps=0;
 while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'合法当前玩家不能停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify(a));actions++;}
 assert(['won','lost'].includes(G.phase),'不得超限或循环');changes+=G.officialState.constraints.completed.length;results[G.phase]++;
}
console.log('✓ 第57关2–5人16局机器人：'+JSON.stringify(results)+'，'+actions+'动作／'+changes+'次限制变更，非法／停止／超限0；仅合法性，不认证全部任务例外或策略');
{
 const ids=['triple-detector','xy-ray','general-radar','walkie-talkies'],rolesResult={won:0,lost:0};let moves=0,swaps=0;
 for(const n of [2,3,4,5])for(let variant=0;variant<4;variant++){
  const cap=variant%n,roles=Array(n).fill('double-detector');let index=0;roles.forEach((_,p)=>{if(p!==cap)roles[p]=ids[(variant+index++)%ids.length];});const G=game(n,cap,n*19001+variant,roles);setup(G);let steps=0;
  while(G.phase==='play'&&steps++<350){const pi=G.pending?G.pending.to:G.turn,a=Bot.decide(G,pi);assert(a,'额外角色不得停止');assert.equal(BB.act(G,pi,a),null,JSON.stringify({a,role:G.players[pi].character}));moves++;}assert(['won','lost'].includes(G.phase));rolesResult[G.phase]++;swaps+=G.officialState.constraints.completed.length;
 }
 console.log('✓ 第57关四种额外角色2–5人16局：'+JSON.stringify(rolesResult)+'，'+moves+'动作／'+swaps+'次限制变更，非法／停止／超限0；只认证合法性与终局');
}
