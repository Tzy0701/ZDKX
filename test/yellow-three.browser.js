// 第13关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb13-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '三黄玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 48), seats, { rng: rng(n + 13), captain: 0 });
  while(G.phase==='setup'){const pi=BB.setupActor(G),w=G.wires.find(w=>w.o===pi&&BB.setupInfoAllowed(G,w));assert.equal(BB.act(G,pi,{a:'info',w:w.id}),null);}
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 48, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
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
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='yellow-three');
   }
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   const views=await Promise.all(pages.map(p=>p.evaluate(()=>window.testView))),ids=views.flatMap((V,pi)=>V.players[pi].stands.flat().filter(w=>!w.cut&&BB.kindOf(w)==='y').map(w=>w.id));assert.equal(ids.length,3);
   for(let mode=0;mode<2;mode++){
    await pages[0].locator('[data-act="yellow-three-start"]').click();
    for(const id of ids)await pages[0].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();
    assert.equal(await pages[0].locator('.sel[data-w]').count(),3);assert(!await pages[0].locator('[data-act="yellow-three-submit"]').isDisabled());
    await pages[0].locator('[data-act="mode"][data-m="dual"]').last().click();await toggle();
   }
   await pages[0].locator('[data-act="yellow-three-start"]').click();for(const id of ids)await pages[0].locator('#scr-game .slot.can[data-w="'+id+'"]').click();await advance(()=>pages[0].locator('[data-act="yellow-three-submit"]').click());
   let replies=0;
   while(await pages[0].evaluate(()=>!!window.testView.pending)){
    const vs=await Promise.all(pages.map(p=>p.evaluate(()=>window.testView))),pd=vs[0].pending;assert.equal(pd.type,'yellow-three-cut');
    for(let mode=0;mode<2;mode++){
     for(let pi=0;pi<n;pi++){
      assert.equal('ownAnswers' in vs[pi].pending,pi===pd.to);assert.equal(await pages[pi].locator('.declared-target').count(),3);
      assert((await pages[pi].locator('.target-declaration').innerText()).includes('宣告三根都是黄线'));
      assert.equal(await pages[pi].locator('[data-act="yellow-three-reply"]').count(),pi===pd.to?1:0);
      assert(await pages[pi].evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     }await toggle();
    }
    if(!replies){const page=pages[pd.to];await page.reload({waitUntil:'domcontentloaded'});await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(id=>window.testView?.pending?.id===id,pd.id);await sync();}
    await advance(()=>pages[pd.to].locator('[data-act="yellow-three-reply"]').click());replies++;
   }
   const end=await pages[0].evaluate(()=>window.testView);assert(end.official.yellowThree.complete);assert.equal(end.det,0);ids.forEach(id=>assert(end.players.flatMap(p=>p.stands.flat()).find(w=>w.id===id).cut));assert(replies>=2);
   console.log('✓ 第48关'+n+'人：手机双视图三线选择、所有人公开箭头／逐人回应、私人答案、回应时重连及成功剪三黄');
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
