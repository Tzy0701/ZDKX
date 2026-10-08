const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb38-actions-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function setup(G) { while (G.phase === 'setup') { const pi = BB.setupActor(G), w = G.wires.find(w => w.o === pi && !w.cut && BB.setupInfoAllowed(G, w)); assert.equal(BB.act(G, pi, { a: 'info', w: w.id }), null); } }
function move(G, avoid, prefer, protect) {
  let pi = G.pending ? G.pending.to : G.turn, a;
  if (G.pending) { const pd = G.pending, choices = BB.view(G, pi).pending.choices; a = { a: 'resolve', id: pd.id, w: choices.find(id => !BB.isOutward(G, G.wires[id])) ?? null }; }
  else if (BB.outwardSkipAllowed(G, pi)) a = { a: 'outward-skip' };
  else {
    const own = G.wires.filter(w => w.o === pi && !w.cut && !BB.isOutward(G, w));
    if (own.length && own.every(w => BB.kindOf(w) === 'r') && pi !== G.captain) a = { a: 'red' };
    else {
      const values = [...new Set(own.filter(w => BB.kindOf(w) === 'b' && w.v !== avoid && !(pi === G.captain && w.v === protect)).map(w => w.v))].sort((a,b) => Number(b === prefer) - Number(a === prefer));
      // 先配合其他玩家，再剪自己独占的数值，便于到达任务例外的合法状态。
      for (const value of values) { const target = G.wires.find(w => w.o !== pi && !w.cut && !BB.isOutward(G, w) && w.v === value && !(value === protect && w.o === G.captain)); if (target) { a = { a: 'dual', w: target.id, val: value }; break; } }
      if (!a) for (const value of values) if (BB.soloOk(G, pi, value)) { a = { a: 'solo', val: value }; break; }
    }
  }
  return !!a && BB.act(G, pi, a) === null;
}
function until(G, predicate, avoid, prefer, protect) { for (let k=0;k<300;k++) { if (!G.pending && predicate(G)) return true; if (G.phase !== 'play' || !move(G, avoid, prefer, protect)) return false; } return false; }
function fixture(n, scenario) {
  const code = 'E' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length:n },(_,i)=>({ pid:code+'-p'+i, name:'额外验收'+i, credential:code+'-凭证'+i, bot:false })); let chosen;
  for (let seed=1;seed<6000 && !chosen;seed++) {
    const G=BB.createGame(M.get('official-development',38),seats,{ captain:0,rng:rng(seed*104729) }), special=G.wires[G.officialState.outwardId]; setup(G);
    let value=special.v, target;
    if (scenario==='stable-wrong') {
      if (!Number.isInteger(value) || value===9 || !G.equip.some(e=>e.n===9)) continue;
      if (!until(G,g=>g.turn===0 && BB.cutCount(g,9)>=2 && g.wires.some(w=>w.o===0 && !w.cut && !BB.isOutward(g,w) && Number.isInteger(w.v)),value)) continue;
      target=G.wires.find(w=>w.o!==0 && !w.cut && Number.isInteger(w.v) && w.v!==value); if (!target || BB.act(G,0,{a:'equip',n:9})) continue; value=target.v;
    } else if (scenario==='solo4' || scenario==='solo-wrong') {
      value=BB.outwardSoloValues(G).find(v=>G.wires.filter(w=>w.o===0 && !BB.isOutward(G,w) && w.v===v).length===3 && (scenario==='solo4' ? v===special.v : v!==special.v));
      if (!value) continue;
    } else if (scenario==='solo2') {
      if (!Number.isInteger(value) || value===2) continue;
      if (n===2) {
        if (!G.equip.some(e=>e.n===2) || G.wires.filter(w=>w.o===0 && w.v===value).length!==4) continue;
        if (!until(G,g=>BB.cutCount(g,2)>=2,value)) continue;
        const offered=G.wires.find(w=>w.o===0 && !w.cut && !BB.isOutward(G,w) && w.v===value), returned=G.wires.find(w=>w.o===1 && !w.cut && w.v!==value);
        if (!offered || !returned || BB.act(G,0,{a:'equip',n:2,w:offered.id,p:1})) continue;
        if (BB.act(G,1,{a:'walkie',id:G.pending.id,w:returned.id})) continue;
        if (!until(G,g=>g.turn===0 && BB.cutCount(g,value)===2 && BB.outwardSoloValues(g).includes(value),null,value)) continue;
      } else {
        if (G.wires.filter(w=>w.o===0 && w.v===value).length!==2) continue;
        if (!until(G,g=>g.turn===0 && BB.cutCount(g,value)===2 && BB.outwardSoloValues(g).includes(value),null,value,value)) continue;
      }
    } else if (scenario==='red' || scenario==='red-wrong') {
      if ((BB.kindOf(special)==='r') !== (scenario==='red')) continue;
      if (scenario==='red-wrong' && G.wires.filter(w=>w.o===0 && w.v===value).length!==1) continue;
      if (!until(G,g=>g.turn===0 && BB.outwardRedPossible(g),value)) continue;
    } else if (scenario==='skip') {
      if (!Number.isInteger(value) || G.wires.filter(w=>w.o===1 && w.v===value).length!==3) continue;
      if (!until(G,g=>g.turn===1 && BB.outwardSkipAllowed(g,1),value)) continue;
    } else {
      value=G.wires.filter(w=>w.o===0 && !BB.isOutward(G,w) && Number.isInteger(w.v)).map(w=>w.v).find(v=>(scenario==='ordinary' ? v===special.v : v!==special.v) && G.wires.some(w=>w.o!==0 && w.v===v));
      if (!value) continue; target=G.wires.find(w=>w.o!==0 && w.v===value);
    }
    if (G.phase==='play' && !G.wires[special.id].cut) chosen={ G,value,target };
  }
  assert(chosen,'找不到合法来源场景 '+n+'人 '+scenario); const {G,value,target}=chosen; G.catalog=G.mission.catalog='campaign'; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:38,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600}); return {code,seats,value,target,id:G.officialState.outwardId};
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try {
  for(let n=2;n<=5;n++) for(const scenario of (process.env.BB_EXTRA_SCENARIOS || 'solo4,solo2,solo-wrong,red,red-wrong,skip,ordinary,ordinary-wrong,stable-wrong').split(',')) {
   const data=fixture(n,scenario),pages=[],contexts=[];let threeD=true;
   try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'captain-outward-wire');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
    for(let mode=0;mode<2;mode++) {
      const v=await views();assert.equal(v[0].players[0].stands.flat().find(w=>w.id===data.id).v,null);
      if(scenario.startsWith('solo')) assert.equal(await host.locator('[data-act=outward-solo][data-v="'+data.value+'"]').count(),1);
      else if(scenario.startsWith('red')) assert.equal(await host.locator('[data-act=outward-red]').count(),1);
      else if(scenario==='stable-wrong') { assert((await host.locator('.act').innerText()).includes('稳定器不能保护朝外线')); }
      else if(scenario==='skip') assert.equal(await pages[1].locator('[data-act=outward-skip]').count(),1);
      for(const p of pages) assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await toggle();
    }
    const before=(await views())[0];
    if(scenario.startsWith('solo')) await advance(()=>host.locator('[data-act=outward-solo][data-v="'+data.value+'"]').click());
    else if(scenario.startsWith('red')) await advance(()=>host.locator('[data-act=outward-red]').click());
    else if(scenario==='skip') await advance(()=>pages[1].locator('[data-act=outward-skip]').click());
    else {
      if(scenario==='stable-wrong') await host.locator('[data-act=mode][data-m=outward]').click();
      await wire(0,data.target.id);await advance(()=>host.locator('[data-act=val][data-v="'+data.value+'"]').click());await advance(()=>pages[data.target.o].locator('[data-act=resolve-target]').click());
      for(let mode=0;mode<2;mode++){const v=await views();assert(v[0].pending.choices.includes(data.id));assert.equal(v[0].players[0].stands.flat().find(w=>w.id===data.id).v,null);assert((await host.locator('.act').innerText()).includes('朝外线'));await toggle();}
      await advance(()=>wire(0,data.id));
    }
    const result=(await views())[0]; if(scenario==='stable-wrong') { assert.equal(result.stab,false); assert(result.equip.find(e=>e.n===9).used); } assert.equal(result.players[0].dd,1);
    if(scenario.includes('wrong')) {assert.equal(result.phase,'lost');assert.equal(result.det,before.det); if(scenario==='ordinary-wrong'||scenario==='stable-wrong') { for(const p of pages) { const text=await p.locator('.cut-response').innerText(); assert(text.includes('公开回应：命中')); assert(text.includes('朝外线拆线失败')); } }}
    else if(scenario==='skip'){assert.equal(result.det,before.det+1);assert.equal(result.players[0].stands.flat().find(w=>w.id===data.id).cut,false);}
    else {assert.notEqual(result.phase,'lost');assert.equal(result.players[0].stands.flat().find(w=>w.id===data.id).cut,true);if(scenario==='solo4')assert.equal(result.players[0].stands.flat().filter(w=>w.cut&&w.v===data.value).length,4);}
    console.log('✓ 第38关'+n+'人来源场景 '+scenario+'：手机二维／三维操作与结算通过');
   } finally {for(const c of contexts)await c.close();}
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
