const assert=require('assert'),BB=require('../js/engine'),Bot=require('../js/bot'),F=require('./weak-link.fixture'),M=require('../js/missions');
function act(G,p,a){assert.equal(BB.act(G,p,a),null,JSON.stringify(a));}
function reject(G,p,a){const before=JSON.stringify(G);assert(BB.act(G,p,a));assert.equal(JSON.stringify(G),before);}
assert.throws(()=>F.game(2),/不能双人/);
for(let n=3;n<=5;n++)for(let cap=0;cap<n;cap++)for(let seed=1;seed<=8;seed++){
 const G=F.game(n,cap,seed),s=BB.weakLink(G);assert.equal(G.wires.length,49);assert.equal(G.rmark.n,1);assert.equal(G.ymark.n,0);assert.equal(G.captain,cap);assert.equal(new Set(G.players.map(p=>p.character.id)).size,n);assert.equal(new Set(s.cards).size,n);assert.equal(G.players[s.owner].character.id,'double-detector');
 for(let p=0;p<n;p++){const V=BB.view(G,p),w=BB.weakLink(V);assert.equal(w.ownConstraint,s.cards[p]);assert.equal(w.ownWeak,p===s.owner);assert(!('owner' in w));assert(!('cards' in w));assert.equal(V.players[p].character.id,G.players[p].character.id);assert(V.players[p].character.locked);for(let peer=0;peer<n;peer++)if(peer!==p){assert.equal(V.players[peer].character.id,'hidden');assert.equal(V.players[peer].dd,0);}for(let v=1;v<=12;v++)assert.equal(BB.actorValueAllowed(G,p,v),BB.actorValueAllowed(V,p,v));}
 const observer=BB.view(G,-1);assert(!('ownConstraint' in BB.weakLink(observer)));assert(observer.players.every(p=>p.character.hidden));F.setup(G);
}
console.log('✓ 第34关官方拒绝双人；3–5人所有队长8种子49线设置、原队长不变、角色／A–E唯一秘密随机分配，含队长角色持有者唯一弱环节，私有身份／限制／角色不泄露到其他座位或公共观战');
{
 const G=F.nonweakGame();F.setup(G);let s=BB.weakLink(G);const owner=s.owner,card=s.cards[owner],role=G.players[0].character.id;
 reject(G,0,{a:'character',val:1});reject(G,owner,{a:'dd',ws:[0,1],val:1});reject(G,0,{a:'weak-guess',id:s.decisionId-1,player:owner,constraint:card});reject(G,1,{a:'weak-pass',id:s.decisionId});
 const forbidden=[...Array(12)].map((_,i)=>i+1).find(v=>!BB.actorValueAllowed(G,owner,v));assert(forbidden);assert(BB.actorValueAllowed(G,0,forbidden));
 const copy=JSON.parse(JSON.stringify(G));act(G,0,{a:'weak-guess',id:s.decisionId,player:owner,constraint:card});act(copy,0,{a:'weak-guess',id:BB.weakLink(copy).decisionId,player:owner,constraint:card});assert.deepEqual(copy,G);assert.equal(BB.weakLink(G).status,'revealed');assert.equal(G.det,0);assert.equal(G.players[0].character.id,role);assert(!BB.personalCardsLocked(G));assert(G.players.every(p=>!p.character.used&&!p.character.removed));for(let p=0;p<3;p++){const V=BB.view(G,p);assert(V.players.every(player=>!player.character.hidden));assert.equal(BB.constraint(V,owner),null);}
 reject(G,0,{a:'weak-guess',id:BB.weakLink(G).decisionId,player:owner,constraint:card});
}
{
 const G=F.nonweakGame();F.setup(G);const s=BB.weakLink(G),turn=G.turnNo;act(G,0,{a:'weak-guess',id:s.decisionId,player:0,constraint:'A'});assert.equal(G.det,1);assert.equal(G.turnNo,turn);assert.equal(BB.weakLink(G).status,'secret');assert(!BB.weakLink(G).startPending);reject(G,0,{a:'weak-guess',id:s.decisionId,player:s.owner,constraint:s.cards[s.owner]});
 const H=F.nonweakGame();F.setup(H);H.det=H.detMax-1;act(H,0,{a:'weak-guess',id:BB.weakLink(H).decisionId,player:0,constraint:'A'});assert.equal(H.phase,'lost');assert.equal(H.pending,null);
}
console.log('✓ 只有当前非弱环节回合开始可猜、参数／旧编号／越权拒绝不变；猜对同时身份和限制才公开角色并解锁、不换角色；猜错一格同回合继续且不能重猜，末格真实引爆；保存结果一致');
{
 const G=F.nonweakGame();F.setup(G);act(G,0,{a:'weak-pass',id:BB.weakLink(G).decisionId});const before=JSON.stringify(G);assert.equal(BB.personalCardsLocked(G),true);reject(G,0,{a:'weak-pass',id:BB.weakLink(G).decisionId});assert.equal(JSON.stringify(G),before);
 let H;for(let seed=1;seed<100;seed++){const g=F.game(3,0,seed);if(BB.weakLink(g).owner===0){H=g;break;}}assert(H);BB.weakLink(H).cards[0]='A';H.wires.filter(w=>w.o===0&&w.v!==1).forEach(w=>w.cut=true);H.wires.filter(w=>w.v===1).forEach(w=>{w.cut=false;w.o=0;w.s=0;w.info=null;});F.resort(H);F.setup(H);assert.equal(H.det,2);assert.equal(H.phase,'play');assert.equal(BB.weakLink(H).status,'discarded');assert(H.players.every(p=>p.character.removed&&p.character.used&&!p.dd));assert.equal(BB.constraint(H,0),null);act(H,0,{a:'solo',val:1});assert.equal(H.det,2);
}
console.log('✓ 不猜可继续、个人装备仍锁定；真实开回合弱环节没有可用值罚两格，全队角色／限制弃置，解除限制后可继续拆线；构造边界不当作整局证明');
{
 const G=F.nonweakGame();F.setup(G);assert.deepEqual(Bot.decide(G,0),{a:'weak-pass',id:BB.weakLink(G).decisionId});for(let n=2;n<=5;n++){const legacy=BB.createGame(M.get('campaign',34),Array.from({length:n},(_,i)=>({pid:'旧'+i,name:'旧玩家'})));assert.equal(BB.weakLink(legacy),null);assert.equal(legacy.ruleset,'custom');}
}
console.log('✓ 机器人先合法不猜、不知道他人弱环节身份；旧版改编第34关及双人存档不迁移或强制官方禁令');
for(let n=3;n<=5;n++){
 const G=F.nonweakGame(n);F.setup(G);act(G,0,{a:'weak-pass',id:BB.weakLink(G).decisionId});const other=JSON.parse(JSON.stringify(G)),s=BB.weakLink(other),a=s.owner,b=a===1?2:1;
 [other.players[a].character,other.players[b].character]=[other.players[b].character,other.players[a].character];[other.players[a].dd,other.players[b].dd]=[other.players[b].dd,other.players[a].dd];[s.cards[a],s.cards[b]]=[s.cards[b],s.cards[a]];s.owner=b;assert.deepEqual(BB.view(G,0),BB.view(other,0));
 function decide(game){const original=Math.random;let seed=17;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);try{return Bot.decide(game,0);}finally{Math.random=original;}}
 assert.deepEqual(decide(G),decide(other));
}
console.log('✓ 第34关3–5人隐藏身份及其他限制换位、同本人许可视图产生同机器人决策，不使用队友秘密真值识别弱环节');
