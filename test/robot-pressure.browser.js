// 第53关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb53-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '压力轨道玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 53), seats, { rng: rng(n + 13), captain: 0 });
  while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:w.id}),null);}
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 53, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
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
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='robot-pressure');
   }
   const observerContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(observerContext);
   await observerContext.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const spectator=await observerContext.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://fonts.googleapis.com/**',r=>r.abort());await spectator.goto(base,{waitUntil:'domcontentloaded'});await spectator.locator('#nm').fill('压力观众');await spectator.locator('#jcode').fill(data.code);await spectator.locator('#btn-join').click();await spectator.waitForFunction(()=>window.testView?.official?.module==='robot-pressure');
   assert.equal(await spectator.locator('.act').count(),0);
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();const latest=await pages[0].evaluate(()=>window.testRevision);await spectator.waitForFunction(r=>window.testRevision>=r,latest);}
   async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();await spectator.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
   async function reload(pi){const r=await pages[0].evaluate(()=>window.testRevision);await pages[pi].reload({waitUntil:'domcontentloaded'});await pages[pi].locator('#jcode').fill(data.code);await pages[pi].locator('#btn-join').click();await pages[pi].waitForFunction(r=>window.testView?.official?.module==='robot-pressure'&&window.testRevision>=r,r);await sync();}
   async function display(position){for(let mode=0;mode<2;mode++){for(const page of pages.concat(spectator)){assert((await page.locator('.pressure-panel').innerText()).includes(position===0?'1之前':String(position)));assert.equal(await page.locator('.pressure-cell').count(),13);assert.equal(await page.locator('.pressure-cell[aria-current="step"]').count(),1);assert.equal(await page.locator('.det:visible,.dial3:visible').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}}
   let vs=await views();assert.equal(vs[0].det,0);assert.equal(vs[0].official.robotPressure.position,0);await display(0);
   const all=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),actor=vs[0].turn,mine=vs[actor].players[actor].stands.flat().filter(w=>!w.cut&&Number.isInteger(w.v)),own=mine.find(w=>all.some(t=>t.o!==actor&&!t.cut&&t.v===w.v)),target=all.find(w=>w.o!==actor&&!w.cut&&w.v===own.v);assert(own&&target);
   await wire(actor,target.id);await advance(()=>pages[actor].locator('[data-act="val"][data-v="'+own.v+'"]').click());let count=0;
   while((await views())[0].pending){vs=await views();const pd=vs[0].pending;assert.equal(vs[0].official.robotPressure.position,0);vs.forEach((V,pi)=>assert.equal('choices' in V.pending,pi===pd.to));assert(!('choices' in (await spectator.evaluate(()=>window.testView)).pending));await display(0);await reload(pd.to);if(pd.step==='target')await advance(()=>pages[pd.to].locator('[data-act="resolve-target"]').click());else await advance(()=>wire(pd.to,vs[pd.to].pending.choices.at(-1)));count++;}
   vs=await views();assert.equal(count,2);assert.equal(vs[0].official.robotPressure.position,1);assert.equal(vs[0].det,0);await display(1);
   const next=vs[0].turn,current=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),blue=vs[next].players[next].stands.flat().find(w=>!w.cut&&Number.isInteger(w.v)),wrong=current.find(w=>w.o!==next&&!w.cut&&Number.isInteger(w.v)&&w.v!==blue.v);assert(blue&&wrong);
   await wire(next,wrong.id);await advance(()=>pages[next].locator('[data-act="val"][data-v="'+blue.v+'"]').click());vs=await views();assert.equal(vs[0].official.robotPressure.position,1);const who=vs[0].pending.to;await reload(who);await advance(()=>pages[who].locator('[data-act="resolve-target"]').click());vs=await views();assert.equal(vs[0].official.robotPressure.position,3);assert.equal(vs[0].det,0);assert.equal(vs[0].phase,'play');await display(3);
   console.log('✓ 第53关'+n+'人375像素双视图：机器人轨道／引爆器隐藏、私有选线重连期间不动、完整成功＋1／失败＋2、位置同步和观战只读');
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
