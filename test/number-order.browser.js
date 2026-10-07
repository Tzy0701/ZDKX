// 第51关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb51-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n,scenario) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '命令玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G,actor;
  for(let seed=1;seed<2000;seed++){G=BB.createGame(M.get('official-development',51),seats,{rng:rng(seed*104729),captain:0});const value=BB.numberOrder(G).deck[0];actor=scenario==='red-controller'?0:scenario==='red-target'?G.players.findIndex((_,pi)=>pi!==0&&G.wires.some(w=>w.o===pi&&BB.kindOf(w)==='r')):scenario==='self'?0:G.players.findIndex((_,pi)=>pi!==0&&(scenario==='missing'?!G.wires.some(w=>w.o===pi&&w.v===value):G.wires.filter(w=>w.o===pi&&w.v===value).length===2));if(actor>=0&&(scenario!=='self'||G.wires.filter(w=>w.o===0&&w.v===value).length===2)&&(scenario!=='red-controller'||G.wires.some(w=>w.o===0&&BB.kindOf(w)==='r')))break;}
  assert(actor>=0);
  while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:w.id}),null);}
  // 仅红线浏览器场景保留原始总量／线架，模拟后段已剪蓝线；非整局证明。
  if(scenario==='red-target'||scenario==='red-controller')G.wires.forEach(w=>{if(w.o===actor&&Number.isInteger(w.v)){w.cut=true;w.info=null;}});
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 51, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats,actor };
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BB_CHROMIUM||'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{for(const n of (process.env.BB_TEST_PLAYER_COUNTS||'2,3,4,5').split(',').map(Number))for(const scenario of (process.env.BB_TEST_SCENARIOS?process.env.BB_TEST_SCENARIOS.split(','):n===2?['other','self','missing']:n===3?['other','missing','red-target','red-controller']:['other','missing'])){
  const data=fixture(n,scenario),contexts=[],pages=[];let threeD=true;
  try{
   for(let pi=0;pi<n;pi++){
    const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(context);
    await context.addInitScript(({code,seat})=>{
     localStorage.setItem('bb_name',JSON.stringify(seat.name));localStorage.setItem('bb_pid',JSON.stringify(seat.pid));localStorage.setItem('bb_officialCredentials',JSON.stringify({[code]:seat.credential}));localStorage.setItem('bb_view3d','true');
     const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};
    },{code:data.code,seat:data.seats[pi]});
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='number-order');
   }
   const observerContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(observerContext);
   await observerContext.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const spectator=await observerContext.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://fonts.googleapis.com/**',r=>r.abort());await spectator.goto(base,{waitUntil:'domcontentloaded'});await spectator.locator('#nm').fill('命令观众');await spectator.locator('#jcode').fill(data.code);await spectator.locator('#btn-join').click();await spectator.waitForFunction(()=>window.testView?.official?.module==='number-order');
   assert.equal(await spectator.locator('[data-act="order-draw"],[data-act="order-assign"],[data-act="order-answer"]').count(),0);
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();const latest=await pages[0].evaluate(()=>window.testRevision);await spectator.waitForFunction(r=>window.testRevision>=r,latest);}
   async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();await spectator.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
   async function reload(pi){const r=await pages[0].evaluate(()=>window.testRevision);await pages[pi].reload({waitUntil:'domcontentloaded'});await pages[pi].locator('#jcode').fill(data.code);await pages[pi].locator('#btn-join').click();await pages[pi].waitForFunction(r=>window.testView?.official?.module==='number-order'&&window.testRevision>=r,r);await sync();}
   let vs=await views();assert.equal(vs[0].det,-1);
   if(scenario==='red-controller'){
    const remaining=vs[0].official.numberOrder.remaining;
    for(let mode=0;mode<2;mode++){assert.equal(await pages[0].locator('[data-act="order-draw"]').count(),0);assert.equal(await pages[0].locator('[data-act="red"]').count(),1);await toggle();}
    await advance(()=>pages[0].locator('[data-act="red"]').click());vs=await views();assert.equal(vs[0].det,-1);assert.equal(vs[0].turn,1);assert.equal(vs[0].official.numberOrder.remaining,remaining);assert(vs[0].players[0].stands.flat().every(w=>w.cut));console.log('✓ 第51关3人来源后段：红线独留长官直接公开、不翻牌不罚格、手机双视图与观战只读');continue;
   }
   for(let mode=0;mode<2;mode++){for(let pi=0;pi<n;pi++){assert.equal(await pages[pi].locator('[data-act="order-draw"]').count(),pi===0?1:0);assert(await pages[pi].evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}
   await advance(()=>pages[0].locator('[data-act="order-draw"]').click());vs=await views();const digit=vs[0].official.numberOrder.value;
   for(let mode=0;mode<2;mode++){for(let pi=0;pi<n;pi++){assert.equal(await pages[pi].locator('[data-act="order-assign"]').count(),pi===0?n:0);assert((await pages[pi].locator('.order-panel').innerText()).includes('本轮数字：'+digit));}assert((await pages[0].locator('[data-act="order-assign"][data-p="0"]').innerText()).includes('自己'));await toggle();}
   await advance(()=>pages[0].locator('[data-act="order-assign"][data-p="'+data.actor+'"]').click());vs=await views();
   if(scenario==='red-target'){vs.forEach(V=>{assert.equal(V.phase,'lost');assert(V.result.why.includes('只剩红线'));});for(const page of pages.concat(spectator)){assert.equal(await page.locator('[data-act="order-answer"]').count(),0);assert((await page.locator('.order-panel').innerText()).includes('已结束'));assert((await page.locator('#scr-game').innerText()).includes('只剩红线'));}console.log('✓ 第51关3人来源后段：长官指定红线独留者立即引爆、未进入遵命或标记；所有玩家／观战同步结果');continue;}
   assert.equal(vs[0].pending.type,'order-answer');for(let pi=0;pi<n;pi++)assert.equal(await pages[pi].locator('[data-act="order-answer"]').count(),pi===data.actor?1:0);
   await reload(data.actor);await advance(()=>pages[data.actor].locator('[data-act="order-answer"]').click());vs=await views();
   if(scenario==='missing'){
    const pd=vs[0].pending;assert.equal(pd.type,'order-clue');vs.forEach((V,pi)=>assert.equal('choices' in V.pending,pi===data.actor));const observed=await spectator.evaluate(()=>window.testView);assert(!('choices' in observed.pending));
    for(let mode=0;mode<2;mode++){for(let pi=0;pi<n;pi++){const clickable=await pages[pi].locator(threeD?'.slot.can':'.tile.can').count();assert.equal(clickable>0,pi===data.actor);}await toggle();}
    await reload(data.actor);vs=await views();const choice=vs[data.actor].pending.choices.at(-1);await advance(()=>wire(data.actor,choice));vs=await views();assert.equal(vs[0].pending,null);assert.equal(vs[0].det,0);assert(vs[0].players[data.actor].stands.flat().find(w=>w.id===choice).info);assert.equal(vs[0].turn,1);assert.equal(vs[0].official.numberOrder.controller,1);
   }else{
    const all=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),target=all.find(w=>!w.cut&&w.o!==data.actor&&w.v===digit);assert(target);
    for(let mode=0;mode<2;mode++){if(!await pages[data.actor].locator('.sel[data-w="'+target.id+'"]').count())await wire(data.actor,target.id);const enabled=pages[data.actor].locator('[data-act="val"][data-v="'+digit+'"]');assert(!await enabled.isDisabled());const wrong=vs[data.actor].players[data.actor].stands.flat().find(w=>!w.cut&&Number.isInteger(w.v)&&w.v!==digit);if(wrong){const b=pages[data.actor].locator('[data-act="val"][data-v="'+wrong.v+'"]');assert(await b.isDisabled());assert((await b.getAttribute('title')).includes('数字牌'));}await toggle();}
    await advance(()=>pages[data.actor].locator('[data-act="val"][data-v="'+digit+'"]').click());let replies=0,selected;
    while((await views())[0].pending){vs=await views();const pd=vs[0].pending;assert.equal(pd.type,'cut');vs.forEach((V,pi)=>assert.equal('choices' in V.pending,pi===pd.to));assert(!('choices' in (await spectator.evaluate(()=>window.testView)).pending));for(const page of pages.concat(spectator))assert.equal(await page.locator('.declared-target').count(),1);await reload(pd.to);
     if(pd.step==='target')await advance(()=>pages[pd.to].locator('[data-act="resolve-target"]').click());else{const own=await pages[pd.to].evaluate(()=>window.testView.pending);assert.equal(own.choices.length,2);selected=own.choices.at(-1);await advance(()=>wire(pd.to,selected));}replies++;
    }assert.equal(replies,2);vs=await views();assert.equal(vs[0].det,-1);assert(vs[0].players[data.actor].stands.flat().find(w=>w.id===selected).cut);assert.equal(vs[0].turn,1);assert.equal(vs[0].official.numberOrder.controller,1);
   }
   for(const page of pages.concat(spectator))assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   console.log('✓ 第51关'+n+'人手机双视图：'+(scenario==='missing'?'缺值私人标记／罚格':scenario==='self'?'长官指定自己／重复手牌选择':'长官指定队友／重复手牌选择')+'、遵命与选线重连、原长官左邻接班、观战只读／公开箭头');
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
