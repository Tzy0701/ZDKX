// 第49关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb49-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '个人氧气玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 49), seats, { rng: rng(n + 13), captain: 0 });
  while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:w.id}),null);}
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 49, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BB_CHROMIUM||'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{for(const n of [2,3,4,5]){
  const data=fixture(n),contexts=[],pages=[];let threeD=true;
  try{
   for(let pi=0;pi<n;pi++){
    const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(context);
    await context.addInitScript(({code,seat})=>{
     localStorage.setItem('bb_name',JSON.stringify(seat.name));localStorage.setItem('bb_pid',JSON.stringify(seat.pid));localStorage.setItem('bb_officialCredentials',JSON.stringify({[code]:seat.credential}));localStorage.setItem('bb_view3d','true');
     const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};
    },{code:data.code,seat:data.seats[pi]});
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='personal-oxygen');
   }
   const observerContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(observerContext);
   await observerContext.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const spectator=await observerContext.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://fonts.googleapis.com/**',r=>r.abort());await spectator.goto(base,{waitUntil:'domcontentloaded'});await spectator.locator('#nm').fill('氧气观众');await spectator.locator('#jcode').fill(data.code);await spectator.locator('#btn-join').click();await spectator.waitForFunction(()=>window.testView?.official?.module==='personal-oxygen');
   assert.equal(await spectator.locator('.personal-oxygen-controls').count(),0);assert.equal(await spectator.locator('[data-act="personal-oxygen-signal"]').count(),0);assert(await spectator.locator('#chatin').isDisabled());
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();const latest=await pages[0].evaluate(()=>window.testRevision);await spectator.waitForFunction(r=>window.testRevision>=r,latest);}
   async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();await spectator.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
   let vs=await views();const initial=vs[0].official.personalOxygen;assert.deepEqual(initial.balances,Array(n).fill(9-n));
   await advance(()=>pages[n-1].locator('[data-act="personal-oxygen-signal"]').click());
   for(const page of pages){assert((await page.locator('.personal-oxygen-panel').innerText()).includes('请求氧气：'+data.seats[n-1].name));assert(await page.locator('#chatin').isDisabled());}
   vs=await views();const actor=vs[0].turn,own=vs[actor].players[actor].stands.flat().filter(w=>!w.cut),all=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),value=own.find(w=>Number.isInteger(w.v)&&w.v<=initial.balances[actor]&&all.some(t=>t.o!==actor&&!t.cut&&t.v===w.v)).v,target=all.find(w=>w.o!==actor&&!w.cut&&w.v===value),recipient=n===2?target.o:[...Array(n).keys()].find(pi=>pi!==actor&&pi!==target.o);
   const expected=initial.balances.slice();expected[actor]-=value;expected[recipient]+=value;
   for(let mode=0;mode<2;mode++){
    if(!await pages[actor].locator('.sel[data-w="'+target.id+'"]').count())await wire(actor,target.id);const button=pages[actor].locator('[data-act="val"][data-v="'+value+'"]');
    if(mode===0){assert(await button.isDisabled());assert((await button.getAttribute('title')).includes('接收氧气'));await pages[actor].locator('[data-act="personal-oxygen-recipient"][data-p="'+recipient+'"]').click();}
    assert(!await button.isDisabled());assert.equal(await pages[actor].locator('[data-act="personal-oxygen-recipient"][data-p="'+recipient+'"]').getAttribute('aria-pressed'),'true');
    const expensive=own.find(w=>Number.isInteger(w.v)&&w.v>initial.balances[actor]);if(expensive){const high=pages[actor].locator('[data-act="val"][data-v="'+expensive.v+'"]');assert(await high.isDisabled());assert((await high.getAttribute('title')).includes('不足'));}
    for(let pi=0;pi<n;pi++){assert.equal(await pages[pi].locator('.personal-oxygen-controls').count(),pi===actor?1:0);assert(await pages[pi].evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();
   }
   await advance(()=>pages[actor].locator('[data-act="val"][data-v="'+value+'"]').click());
   let count=0;
   while(await pages[0].evaluate(()=>!!window.testView.pending)){
    vs=await views();const pd=vs[0].pending,who=pd.to;assert.equal(pd.type,'cut');assert.deepEqual(vs[0].official.personalOxygen.balances,expected);vs.forEach((V,pi)=>assert.equal('choices' in V.pending,pi===who));
    for(const page of pages.concat(spectator))assert.equal(await page.locator('.declared-target').count(),1);const observed=await spectator.evaluate(()=>window.testView);assert.deepEqual(observed.official.personalOxygen.balances,expected);assert.equal('choices' in observed.pending,false);assert.equal(await spectator.locator('[data-act="resolve-target"]').count(),0);
    if(!count){await pages[who].reload({waitUntil:'domcontentloaded'});await pages[who].locator('#jcode').fill(data.code);await pages[who].locator('#btn-join').click();await pages[who].waitForFunction(id=>window.testView?.pending?.id===id,pd.id);await sync();await advance(()=>pages[who].locator('[data-act="resolve-target"]').click());}
    else{const ownChoice=vs[who].pending.choices.at(-1);await advance(()=>wire(who,ownChoice));}count++;
   }
   vs=await views();assert.equal(count,2);assert.deepEqual(vs[0].official.personalOxygen.balances,expected);assert.equal(vs[0].det,0);const next=vs[0].turn;
   assert.equal(await pages[next].locator('[data-act="personal-oxygen-recipient"][aria-pressed="true"]').count(),0);
   await advance(()=>pages[next].locator('[data-act="personal-oxygen-skip"]').click());vs=await views();assert.equal(vs[0].det,1);assert.deepEqual(vs[0].official.personalOxygen.balances,expected);
   console.log('✓ 第49关'+n+'人：手机二维／三维公开氧气、接收队友选择、不足禁用、拇指／禁聊天、双拆私有回应重连只转移一次、跳过与回合选择重置、观战氧气／公开箭头只读');
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
