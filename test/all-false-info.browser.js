// 第52关来源设置的隔离联机测试；只写本机服务器的临时数据目录。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb52-test-data';
const publicRun = false;
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'T' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '假线索玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for(let seed=1;seed<2000;seed++){G=BB.createGame(M.get('official-development',52),seats,{rng:rng(seed*104729),captain:0});if(G.equip.some(e=>e.n===4)&&G.wires.some(w=>w.o===0&&w.v===4)&&G.wires.some(w=>w.o!==0&&w.v===4))break;}
  assert(G.equip.some(e=>e.n===4));
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 52, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BB_CHROMIUM||'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{for(const n of (process.env.BB_TEST_PLAYER_COUNTS||'2,3,4,5').split(',').map(Number)){
  const data=fixture(n),contexts=[],pages=[];let threeD=true;
  try{
   for(let pi=0;pi<n;pi++){
    const context=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(context);
    await context.addInitScript(({code,seat})=>{
     localStorage.setItem('bb_name',JSON.stringify(seat.name));localStorage.setItem('bb_pid',JSON.stringify(seat.pid));localStorage.setItem('bb_officialCredentials',JSON.stringify({[code]:seat.credential}));localStorage.setItem('bb_view3d','true');
     const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};
    },{code:data.code,seat:data.seats[pi]});
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#nm').fill(data.seats[pi].name);await page.locator('#jcode').fill(data.code);await page.locator('#btn-join').click();await page.waitForFunction(()=>window.testView?.official?.module==='all-false-info');
   }
   const observerContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});contexts.push(observerContext);
   await observerContext.addInitScript(()=>{localStorage.setItem('bb_view3d','true');const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.topic==='official:view'){window.testView=m.data.view;window.testRevision=m.data.revision;}}catch(_){}});}};});
   const spectator=await observerContext.newPage();spectator.on('pageerror',e=>errors.push(e.message));await spectator.route('https://fonts.googleapis.com/**',r=>r.abort());await spectator.goto(base,{waitUntil:'domcontentloaded'});await spectator.locator('#nm').fill('假线索观众');await spectator.locator('#jcode').fill(data.code);await spectator.locator('#btn-join').click();await spectator.waitForFunction(()=>window.testView?.official?.module==='all-false-info');
   assert.equal(await spectator.locator('[data-act="fake-value"],[data-act="false-info"]').count(),0);
   async function sync(){const r=Math.max(...await Promise.all(pages.map(p=>p.evaluate(()=>window.testRevision))));await Promise.all(pages.map(p=>p.waitForFunction(r=>window.testRevision>=r,r)));}
   async function advance(fn){await sync();const r=await pages[0].evaluate(()=>window.testRevision);await fn();await pages[0].waitForFunction(r=>window.testRevision>r,r);await sync();const latest=await pages[0].evaluate(()=>window.testRevision);await spectator.waitForFunction(r=>window.testRevision>=r,latest);}
   async function views(){await sync();return Promise.all(pages.map(p=>p.evaluate(()=>window.testView)));}
   async function toggle(){for(const page of pages)await page.locator('#scr-game [data-act=view]').click();await spectator.locator('#scr-game [data-act=view]').click();threeD=!threeD;}
   async function wire(pi,id){await pages[pi].locator('#scr-game '+(threeD?'.slot.can':'.tile.can')+'[data-w="'+id+'"]').click();}
   async function reload(pi){const r=await pages[0].evaluate(()=>window.testRevision);await pages[pi].reload({waitUntil:'domcontentloaded'});await pages[pi].locator('#jcode').fill(data.code);await pages[pi].locator('#btn-join').click();await pages[pi].waitForFunction(r=>window.testView?.official?.module==='all-false-info'&&window.testRevision>=r,r);await sync();}
   function available(V,value){return V.players.flatMap(p=>p.stands.flat()).filter(w=>!w.cut&&w.info).reduce((count,w)=>count+String(w.info.v).split('/').filter(v=>v===String(value)).length,0)<2;}
   let vs=await views(),marks=0,redMarks=0;const used=new Set();
   while(vs[0].phase==='setup'){
    const pi=BB.setupActor(vs[0]),own=vs[pi].players[pi].stands.flat(),chosen=own.find(w=>!used.has(w.id)&&!w.info&&BB.kindOf(w)==='r')||own.find(w=>!used.has(w.id)&&!w.info&&Number.isInteger(w.v)),value=[...Array(12)].map((_,i)=>i+1).find(v=>v!==chosen.v&&available(vs[0],v));assert(chosen&&value);
    const instruction=await pages[pi].locator('.act').innerText();assert(instruction.includes('蓝线或红线'));assert(instruction.includes('不能选黄线'));const yellow=own.find(w=>BB.kindOf(w)==='y');if(yellow)assert.equal(await pages[pi].locator((threeD?'.slot.can':'.tile.can')+'[data-w="'+yellow.id+'"]').count(),0);
    for(let mode=0;mode<2;mode++){if(!await pages[pi].locator('.sel[data-w="'+chosen.id+'"]').count())await wire(pi,chosen.id);const actual=Number.isInteger(chosen.v)?pages[pi].locator('[data-act="fake-value"][data-v="'+chosen.v+'"]'):null;if(actual)assert(await actual.isDisabled());assert(!await pages[pi].locator('[data-act="fake-value"][data-v="'+value+'"]').isDisabled());for(let owner=0;owner<n;owner++)assert.equal('fakeSetup' in vs[owner].official,owner===pi);assert.equal(await spectator.locator('[data-act="fake-value"]').count(),0);await toggle();}
    await advance(()=>pages[pi].locator('[data-act="fake-value"][data-v="'+value+'"]').click());used.add(chosen.id);if(BB.kindOf(chosen)==='r')redMarks++;marks++;vs=await views();const marker=vs[0].players[pi].stands.flat().find(w=>w.id===chosen.id).info;assert.equal(marker.t,'not');assert.equal(marker.v,String(value));
    if(vs[0].phase==='setup'&&BB.setupActor(vs[0])===pi){await reload(pi);const current=await pages[pi].evaluate(()=>window.testView);assert(current.official.fakeSetup.usedIds.includes(chosen.id));assert.equal(await pages[pi].locator((threeD?'.slot.can':'.tile.can')+'[data-w="'+chosen.id+'"]').count(),0);}
    for(const page of pages.concat(spectator))assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }assert.equal(marks,n*2);assert(redMarks>0);assert(vs[0].setup.every?vs[0].setup.every(x=>x===2):Object.values(vs[0].setup).every(x=>x===2));
   const all=vs.flatMap((V,pi)=>V.players[pi].stands.flat().map(w=>({...w,o:pi}))),target=all.find(w=>w.o!==0&&w.v===4);await wire(0,target.id);await advance(()=>pages[0].locator('[data-act="val"][data-v="4"]').click());
   let cuts=0;while((await views())[0].pending){vs=await views();const pd=vs[0].pending;vs.forEach((V,pi)=>assert.equal('choices' in V.pending,pi===pd.to));assert(!('choices' in (await spectator.evaluate(()=>window.testView)).pending));if(pd.step==='target')await advance(()=>pages[pd.to].locator('[data-act="resolve-target"]').click());else await advance(()=>wire(pd.to,vs[pd.to].pending.choices.at(-1)));cuts++;}assert.equal(cuts,2);vs=await views();assert(vs[0].equip.find(e=>e.n===4).open);
   const turn=vs[0].turn,pi=(turn+1)%n,own=vs[pi].players[pi].stands.flat(),chosen=own.find(w=>!w.cut&&!w.info&&Number.isInteger(w.v));assert(chosen);
   await pages[pi].locator('[data-act="eq"][data-n="4"]').click();await wire(pi,chosen.id);await advance(()=>pages[pi].locator('[data-act="eqgo"]').click());vs=await views();assert.equal(vs[0].pending.type,'false-info');assert(!vs[0].equip.find(e=>e.n===4).used);
   for(let mode=0;mode<2;mode++){for(let owner=0;owner<n;owner++){assert.equal('choices' in vs[owner].pending,owner===pi);assert.equal('wire' in vs[owner].pending,owner===pi);assert.equal(await pages[owner].locator('[data-act="false-info"]').count(),owner===pi?11:0);assert.equal(await pages[owner].locator('[data-act="locate-false-info"]').count(),owner===pi?1:0);}assert.equal(await pages[pi].locator('[data-act="false-info"][data-v="'+chosen.v+'"]').count(),0);assert.equal(await spectator.locator('[data-act="false-info"]').count(),0);await toggle();}
   await spectator.locator('#spectator-perspective').selectOption(data.seats[pi].pid);await spectator.waitForFunction(pid=>window.testView?.perspective===pid&&window.testView?.pending?.type==='false-info',data.seats[pi].pid);const observed=await spectator.evaluate(()=>window.testView.pending);assert(!('choices' in observed));assert(!('wire' in observed));
   await reload(pi);assert((await pages[pi].locator('.false-info-pending').innerText()).includes(data.seats[pi].name));await pages[pi].locator('[data-act="locate-false-info"]').click();vs=await views();const value=vs[pi].pending.choices.find(v=>available(vs[0],v));await advance(()=>pages[pi].locator('[data-act="false-info"][data-v="'+value+'"]').click());vs=await views();assert.equal(vs[0].pending,null);assert.equal(vs[0].turn,turn);assert(vs[0].equip.find(e=>e.n===4).used);assert.equal(vs[0].players[pi].stands.flat().find(w=>w.id===chosen.id).info.v,String(value));
   // 制造两次合法安全猜错以验证同一导线上多条否定的显示；这些是开发叠加分支。
   let previous=null,stacked=false;
   for(let attempt=0;attempt<2;attempt++){
    vs=await views();const actor=vs[0].turn,all=vs.flatMap((V,owner)=>V.players[owner].stands.flat().map(w=>({...w,o:owner}))),mine=vs[actor].players[actor].stands.flat().filter(w=>!w.cut&&Number.isInteger(w.v));let wrong,guess;
    if(previous){wrong=all.find(w=>w.id===previous.id);guess=mine.find(w=>w.v!==wrong.v&&!String(wrong.info?.v||'').split('/').includes(String(w.v))&&available(vs[0],w.v));if(wrong.o===actor||!guess)break;}
    else{for(const w of all.filter(w=>w.o!==actor&&!w.cut&&Number.isInteger(w.v))){const g=mine.find(g=>g.v!==w.v&&available(vs[0],g.v)&&!String(w.info?.v||'').split('/').includes(String(g.v)));if(g){wrong=w;guess=g;break;}}}
    assert(wrong&&guess);await wire(actor,wrong.id);await advance(()=>pages[actor].locator('[data-act="val"][data-v="'+guess.v+'"]').click());vs=await views();const who=vs[0].pending.to;await advance(()=>pages[who].locator('[data-act="resolve-target"]').click());previous={id:wrong.id};vs=await views();const info=vs[0].players[wrong.o].stands.flat().find(w=>w.id===wrong.id).info;
    if(info.v.includes('/')){const expected=info.v.split('/').map(v=>'≠'+(v==='Y'?'黄':v)).join('、');for(let mode=0;mode<2;mode++){for(const page of pages.concat(spectator)){const token=page.locator('[data-w="'+wrong.id+'"] '+(threeD?'.tok3':'.tok'));assert.equal((await token.innerText()).replace(/\s+/g,'、'),expected);assert.equal(await token.evaluate(el=>el.textContent),expected);assert((await token.evaluate(el=>el.parentElement.getAttribute('aria-label'))).includes(expected));if(page===pages[0]){const size=await token.evaluate(el=>({marker:el.getBoundingClientRect().width,wire:el.parentElement.getBoundingClientRect().width}));assert(size.marker<=size.wire*1.1,'否定标记不应覆盖相邻导线');}}await toggle();}stacked=true;break;}
   }
   console.log('✓ 第52关'+n+'人手机双视图：两枚蓝／红假值、黄禁止／真值禁用、标记重连；非回合便利贴私有菜单／重连／一次耗牌、观战视角私有字段屏蔽'+(stacked?'，多条否定逐条显示':''));
  }finally{for(const c of contexts)await c.close();}
 }assert.deepEqual(errors,[]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
