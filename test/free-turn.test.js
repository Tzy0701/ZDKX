const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),M=require('../js/missions'),F=require('./free-turn.fixture');
const now=Date.now()+100000;
const restore=G=>JSON.parse(JSON.stringify(G));
function act(G,pi,a,t=now){assert.equal(BB.act(G,pi,a,{now:t}),null);}
function reject(G,pi,a,t=now,opts={}){const before=JSON.stringify(G);assert(BB.act(G,pi,a,{now:t,...opts}));assert.equal(JSON.stringify(G),before);}
function claim(G,pi){act(G,pi,{a:'turn-claim',id:BB.freeTurn(G).decisionId});}
for(let n=2;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=F.game(n,cap,seed);assert.equal(G.wires.length,53);assert.equal(G.wires.filter(w=>BB.kindOf(w)==='b').length,48);assert.equal(G.ymark.n,4);assert.equal(G.rmark.n,1);assert(!G.equip.some(e=>e.n===11));assert.equal(G.equip.length,n);assert.equal(G.deadline,null);F.setup(G,now);
 assert.equal(G.deadline,now+(n===2?720:900)*1000);assert.equal(BB.freeTurn(G).step,'claim');for(let pi=0;pi<n;pi++){assert(BB.freeTurnEligible(G,pi));assert(BB.freeTurnEligible(BB.view(G,pi),pi));assert(!BB.ownTurnAllowed(G,pi));}
 assert.equal(restore(G).deadline,G.deadline);
}
console.log('✓ 第10关2–5人所有队长8种子：48蓝／4已知黄／1已知红、人数张装备排除咖啡、布置不计时、全局15分钟及双人12分钟、来源存档保持绝对截止时间');
{
 const G=F.game(3);F.setup(G,now);F.give(G,1,0);F.give(G,2,1);const id=BB.freeTurn(G).decisionId,deadline=G.deadline;
 reject(G,0,{a:'solo',val:1});claim(G,1);assert.equal(G.turn,1);reject(G,0,{a:'turn-claim',id});reject(G,1,{a:'turn-claim',id});act(G,1,{a:'solo',val:2},now+1000);
 assert.equal(G.deadline,deadline);assert.equal(BB.freeTurn(G).previous,1);reject(G,1,{a:'turn-claim',id:BB.freeTurn(G).decisionId});reject(G,0,{a:'turn-claim',id});claim(G,0);act(G,0,{a:'solo',val:1},now+2000);assert.equal(G.deadline,deadline);
 for(const w of G.wires)if(w.o===2)w.cut=true;G.wires.filter(w=>w.v===3).forEach(w=>w.cut=false);F.give(G,3,0);assert(BB.freeTurnEligible(G,0));claim(G,0);act(G,0,{a:'solo',val:3});assert.equal(BB.freeTurn(G).previous,0);assert.equal(G.deadline,deadline);
 assert.equal(restore(G).officialState.freeTurn.decisionId,BB.freeTurn(G).decisionId);
}
console.log('✓ 非队长可先抢、同一编号竞争仅首位成功、直接拆线／旧抢回合拒绝不变、三人以上不能连续；剩两名持线才恢复连续行动，换回合不重置倒计时');
{
 const G=F.game(2);F.setup(G,now);F.give(G,1,1);F.give(G,2,1);claim(G,1);act(G,1,{a:'solo',val:1});claim(G,1);act(G,1,{a:'solo',val:2});assert.equal(G.deadline,now+720000);
 const H=F.game(3);F.setup(H,now);F.give(H,1,0);const wires=H.wires.filter(w=>w.v===1);wires[0].o=1;F.resort(H);claim(H,0);act(H,0,{a:'dual',w:wires[0].id,val:1});assert.equal(H.pending.step,'target');reject(H,2,{a:'turn-claim',id:BB.freeTurn(H).decisionId});const deadline=H.deadline;
 assert.equal(BB.setPaused(H,true,now+1234),null);assert.equal(H.pauseRemaining,900000-1234);reject(H,1,{a:'resolve',id:H.pending.id,w:wires[0].id});assert.equal(BB.setPaused(H,false,now+2234),null);assert.equal(H.deadline,deadline+1000);
 const loaded=restore(H);reject(loaded,0,{a:'timeout'},loaded.deadline,{serverTimeout:false});assert.equal(BB.act(loaded,loaded.turn,{a:'timeout'},{now:loaded.deadline,serverTimeout:true}),null);assert.equal(loaded.phase,'lost');assert.equal(loaded.pending,null);assert.equal(loaded.det,0);assert.equal(loaded.deadline,null);
 const late=restore(H);act(late,1,{a:'resolve',id:late.pending.id,w:wires[0].id},late.deadline);assert.equal(late.phase,'lost');assert(wires.every(w=>!w.cut));assert.equal(late.pending,null);
}
console.log('✓ 双人可连续；拆线目标等待仍计时、暂停保留剩余时间／决定、重载后截止直接失败不加格；客户端超时拒绝，迟到回应不能绕过截止通关');
{
 const G=F.game(3);F.setup(G,now);for(let pi=0;pi<3;pi++)assert.deepEqual(Bot.decide(G,pi),{a:'turn-claim',id:1});G.officialState.freeTurn.previous=1;assert.equal(Bot.decide(G,1),null);assert(Bot.decide(G,2));
 for(let n=2;n<=5;n++){const legacy=BB.createGame(M.get('custom',10),Array.from({length:n},(_,i)=>({pid:'旧'+i,name:'旧玩家'})));assert.equal(BB.freeTurn(legacy),null);assert.equal(BB.freeTurn(restore(legacy)),null);}
}
console.log('✓ 抢回合机器人依据公开持线数，不读队友真值；旧第10关改编存档不迁移、不添加限时或抢回合');
