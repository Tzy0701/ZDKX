// 第50关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb50-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '黑海玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 50), seats, { rng: rng(n + 13), captain: 0 });
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 50, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
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
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='memory-sea');
   }
   const observerContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(observerContext);
   await observerContext.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const spectator=await observerContext.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://fonts.googleapis.com/**',r=>r.abort());await spectator.goto(base,{waitUntil:'domcontentloaded'});await spectator.locator('#nm').fill('黑海观众');await spectator.locator('#jcode').fill(data.code);await spectator.locator('#btn-join').click();await spectator.waitForFunction(()=>window.testView?.official?.module==='memory-sea');
   assert.equal(await spectator.locator('[data-act="memory-ready"]').count(),0);
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();const latest=await pages[0].evaluate(()=>window.testRevision);await spectator.waitForFunction(r=>window.testRevision>=r,latest);}
   async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();await spectator.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
   let vs=await views();assert.equal(vs[0].phase,'memory-preview');
   for(let mode=0;mode<2;mode++){
    for(const page of pages.concat(spectator)){assert(await page.locator('.memory-values').isVisible());assert.equal(await page.locator('.pawn,.markers .mk').count(),0);assert.equal(await page.locator('.tray-cells .pins,.track .pips,.tray-cells .done,.track .done').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();
   }
   let confirmations=0;
   while((await views())[0].phase==='memory-preview'){
    vs=await views();const pd=vs[0].pending;
    vs.forEach(V=>assert(V.players.every(p=>p.stands.flat().every(w=>w.v===null))));
    for(let pi=0;pi<n;pi++)assert.equal(await pages[pi].locator('[data-act="memory-ready"]').count(),pi===pd.to?1:0);
    assert((await pages[pd.to].locator('.memory-panel').innerText()).includes('轮到 '+data.seats[pd.to].name));
    if(!confirmations){await advance(()=>pages[0].locator('[data-act="host-pause"]').click());assert.equal(await pages[pd.to].locator('[data-act="memory-ready"]').count(),0);await pages[pd.to].reload({waitUntil:'domcontentloaded'});await pages[pd.to].locator('#jcode').fill(data.code);await pages[pd.to].locator('#btn-join').click();await pages[pd.to].waitForFunction(()=>window.testView?.paused&&window.testView?.phase==='memory-preview');await advance(()=>pages[0].locator('[data-act="host-pause"]').click());}
    await advance(()=>pages[pd.to].locator('[data-act="memory-ready"]').click());confirmations++;
   }assert.equal(confirmations,n);
   for(const page of pages.concat(spectator)){assert.equal(await page.locator('.memory-values').count(),0);const V=await page.evaluate(()=>window.testView);assert.deepEqual(V.rmark.cand,[]);assert.deepEqual(V.ymark.cand,[]);}
   while((await views())[0].phase==='setup'){
    vs=await views();const pi=BB.setupActor(vs[0]),own=vs[pi].players[pi].stands.flat(),chosen=own.find(w=>!w.cut&&Number.isInteger(w.v));await advance(()=>wire(pi,chosen.id));
    vs=await views();vs.forEach(V=>{assert.equal(V.official.memorySea.point.wire,chosen.id);assert(V.players.every(p=>p.stands.flat().every(w=>!w.info)));assert(V.official.memorySea.side.every(t=>!('wire' in t)));});
    for(let mode=0;mode<2;mode++){for(const page of pages.concat(spectator)){assert.equal(await page.locator('.memory-target').count(),1);assert((await page.locator('.memory-point').innerText()).includes(data.seats[pi].name));assert.equal(await page.locator('.pawn,.markers .mk').count(),0);assert.equal(await page.locator('.tray-cells .pins,.track .pips,.tray-cells .done,.track .done').count(),0);}await toggle();}
   }
   vs=await views();const actor=vs[0].turn,own=vs[actor].players[actor].stands.flat().filter(w=>!w.cut&&Number.isInteger(w.v)),all=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),value=own[0].v,wrong=all.find(w=>w.o!==actor&&!w.cut&&Number.isInteger(w.v)&&w.v!==value);assert(wrong);
   await wire(actor,wrong.id);await advance(()=>pages[actor].locator('[data-act="val"][data-v="'+value+'"]').click());vs=await views();assert.equal(vs[0].official.memorySea.point,null);for(const page of pages.concat(spectator))assert.equal(await page.locator('.memory-target').count(),0);
   const responder=vs[0].pending.to;await advance(()=>pages[responder].locator('[data-act="resolve-target"]').click());vs=await views();assert.equal(vs[0].det,1);assert.equal(vs[0].official.memorySea.point.wire,wrong.id);assert(!vs[0].players[wrong.o].stands.flat().find(w=>w.id===wrong.id).info);
   for(let mode=0;mode<2;mode++){for(const page of pages.concat(spectator)){assert.equal(await page.locator('.memory-target').count(),1);assert((await page.locator('.memory-point').innerText()).includes(String(wrong.v)));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}
   const lastPoint=vs[0].official.memorySea.point;await pages[0].reload({waitUntil:'domcontentloaded'});await pages[0].locator('#jcode').fill(data.code);await pages[0].locator('#btn-join').click();await pages[0].waitForFunction(()=>window.testView?.phase==='play');assert.deepEqual((await pages[0].evaluate(()=>window.testView)).official.memorySea.point,lastPoint);
   vs=await views();const next=vs[0].turn,after=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),nextOwn=vs[next].players[next].stands.flat().filter(w=>!w.cut&&Number.isInteger(w.v)),number=nextOwn.find(w=>after.some(t=>!t.cut&&t.o!==next&&t.v===w.v)).v,target=after.find(w=>!w.cut&&w.o!==next&&w.v===number);
   await wire(next,target.id);await advance(()=>pages[next].locator('[data-act="val"][data-v="'+number+'"]').click());vs=await views();assert.equal(vs[0].official.memorySea.point,null);for(const page of pages.concat(spectator)){assert.equal(await page.locator('.memory-point,.memory-target').count(),0);assert.equal(await page.locator('.memory-values').count(),0);}assert(vs[0].official.memorySea.side.length>0);
   console.log('✓ 第50关'+n+'人手机双视图：逐人预览确认／暂停重连、隐藏候选和完成标记、初始及失败旁置／公共一次箭头、无历史位置、下一行动清除／观战只读');
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
