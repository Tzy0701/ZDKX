const assert=require('assert'),fs=require('fs'),path=require('path'),BB=require('../js/engine'),M=require('../js/missions');
const {chromium}=require(process.env.BB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BB_BROWSER_URL||'http://127.0.0.1:9123',dir=process.env.BB_TEST_DATA_DIR||'/tmp/bb45-red-browser-data';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base)||!dir.startsWith('/tmp/'))throw new Error('只允许隔离本机测试');
function rng(s){return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function fixture(n){const code='R'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'p'+i,name:'红线认领'+i,credential:code+'凭证'+i,bot:false}));let G,owner;
 for(let seed=1;seed<500;seed++){G=BB.createGame(M.get('official-development',45),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.some(w=>w.o!==0&&BB.kindOf(w)==='r'))break;}
 for(let step=0;step<300&&G.phase!=='won';step++){
  const r=G.officialState.numberClaim;if(G.phase==='play'&&!G.pending&&r.step==='draw'){owner=G.players.findIndex((_,pi)=>pi!==0&&G.wires.some(w=>w.o===pi&&!w.cut)&&G.wires.filter(w=>w.o===pi&&!w.cut).every(w=>BB.kindOf(w)==='r'));if(owner>=0)break;}
  let pi=G.pending?G.pending.to:G.phase==='setup'?BB.setupActor(G):G.turn,a;
  if(G.phase==='setup')a={a:'info',w:G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w)).id};
  else if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>pd.vals.includes(G.wires[id].v))};}
  else if(r.step==='draw'){pi=0;a={a:'claim-draw',id:r.decisionId};}
  else if(r.step==='claim'){const wire=G.wires.find(w=>!w.cut&&w.v===r.value)||G.wires.find(w=>!w.cut&&BB.kindOf(w)==='r');assert(wire);pi=wire.o;a={a:'claim-number',id:r.decisionId};}
  else{pi=r.actor;const own=G.wires.filter(w=>w.o===pi&&!w.cut);a=own.every(w=>BB.kindOf(w)==='r')?{a:'red'}:BB.soloOk(G,pi,r.value)?{a:'solo',val:r.value}:{a:'dual',val:r.value,w:G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===r.value).id};}
  assert.equal(BB.act(G,pi,a),null);
 }
 assert(owner>0);assert.equal(G.officialState.numberClaim.step,'draw');G.catalog=G.mission.catalog='campaign';const count=G.wires.filter(w=>w.o===owner&&!w.cut).length,remaining=G.officialState.numberClaim.deck.length;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:45,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,owner,count,remaining};}
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(let n=2;n<=5;n++){
 const data=fixture(n),pages=[],contexts=[];
 try{for(const seat of data.seats){const c=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(c);await c.addInitScript(({code,seat})=>{localStorage.setItem('bb_pid',JSON.stringify(seat.pid));localStorage.setItem('bb_name',JSON.stringify(seat.name));localStorage.setItem('bb_officialCredentials',JSON.stringify({[code]:seat.credential}));localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...a){super(...a);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};},{code:data.code,seat});const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('#nm').fill(seat.name);await p.locator('#jcode').fill(data.code);await p.locator('#btn-join').click();await p.waitForFunction(()=>window.testView?.official?.numberClaim?.step==='draw');}
 for(let mode=0;mode<2;mode++){assert.equal(await pages[data.owner].locator('[data-act=claim-number]').count(),1);assert.equal(await pages[0].locator('[data-act=claim-draw]').count(),1);for(const p of pages){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.locator('[data-act=view]').click();}}
 const actor=pages[data.owner],before=await actor.evaluate(()=>window.testRevision);await actor.locator('[data-act=claim-number]').click();await actor.waitForFunction(r=>window.testRevision>r,before);assert.equal((await actor.evaluate(()=>window.testView)).official.numberClaim.remaining,data.remaining);
 const claimed=await actor.evaluate(()=>window.testRevision);await actor.locator('[data-act=red]').click();await actor.waitForFunction(r=>window.testRevision>r,claimed);const V=await actor.evaluate(()=>window.testView);assert.equal(V.official.numberClaim.remaining,data.remaining);assert.equal(V.det,0);assert(V.players[data.owner].stands.flat().every(w=>w.cut));if(V.phase==='play')assert.equal(V.official.numberClaim.step,'draw');
 console.log('✓ 第45关'+n+'人来源合法晚局手机双视图：非队长翻牌前认领并公开'+data.count+'根红线，牌堆不变且无罚格');
 }finally{for(const c of contexts)await c.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
