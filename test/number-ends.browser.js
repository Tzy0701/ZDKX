const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb36-browser-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
 const code='E'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'端点玩家'+i,credential:code+'-凭证'+i,bot:false}));let G,target,value;
 for(let seed=1;seed<500;seed++){G=BB.createGame(M.get('official-development',36),seats,{captain:0,rng:rng(seed*104729)});value=G.officialState.numberEnds.row[0];if(G.wires.some(w=>w.o===0&&w.v===value)){target=G.wires.find(w=>w.o!==0&&w.v===value);if(target)break;}}
 assert(target);G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:36,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,target,value};
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (let n = 2; n <= 5; n++) {
      const data = fixture(n), pages = [], contexts = []; let threeD = true;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'number-ends');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        let initial=await views();assert.equal(initial[0].phase,'sequence');
        for(let mode=0;mode<2;mode++){assert.equal(await host.locator('[data-act=sequence-end]').count(),2);for(let pi=1;pi<n;pi++)assert.equal(await pages[pi].locator('[data-act=sequence-end]').count(),0);await toggle();}
        await advance(()=>host.locator('[data-act=host-pause]').click());assert((await views())[0].paused);assert.equal(await host.locator('[data-act=sequence-end]').count(),0);await advance(()=>host.locator('[data-act=host-pause]').click());
        await advance(()=>host.locator('[data-act=sequence-end][data-end=left]').click());
        while((await views())[0].phase==='setup'){const v=await views(),pi=BB.setupActor(v[0]),id=v[pi].players[pi].stands.flat().find(w=>BB.setupInfoAllowed(v[pi],w)&&BB.kindOf(w)==='b').id;await advance(()=>wire(pi,id));}
        await wire(0,data.target.id);await advance(()=>host.locator('[data-act=val][data-v="'+data.value+'"]').click());await advance(()=>pages[data.target.o].locator('[data-act=resolve-target]').click());
        const choices=(await views())[0].pending.choices;await advance(()=>wire(0,choices.at(-1)));
        let v=await views();assert.equal(v[0].pending.type,'sequence-end');assert.equal(v[0].official.numberEnds.row.length,4);assert.deepEqual(v[0].official.numberEnds.removed,[data.value]);
        for(let pi=1;pi<n;pi++)assert(!('choices' in v[pi].pending));
        for(let mode=0;mode<2;mode++){assert.equal(await host.locator('[data-act=sequence-end]').count(),2);assert((await host.locator('.act').innerText()).includes('独立'));for(const p of pages)assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await toggle();}
        const decision=v[0].pending.id;await host.reload({waitUntil:'domcontentloaded'});await host.locator('#jcode').fill(data.code);await host.locator('#btn-join').click();await host.waitForFunction(id=>window.testView?.pending?.id===id,decision);
        await advance(()=>host.locator('[data-act=sequence-end][data-end=right]').click());v=await views();assert.equal(v[0].pending,null);assert.equal(v[0].official.numberEnds.end,'right');assert.equal(v[0].turn,1);assert.equal(v[0].phase,'play');
        // 全信息参考求解汇总各自手牌，所有状态变更仍经过真实网页按钮和服务端。
        if(n===2)for(let k=0;k<180&&(v=(await views()))[0].phase==='play';k++){
          const V=v[0],pd=V.pending,who=pd?pd.to:V.turn;
          if(pd?.type==='sequence-end'){
            const row=V.official.numberEnds.row,next=(V.turn+1)%n,hand=v[next].players[next].stands.flat().filter(w=>!w.cut),end=hand.some(w=>w.v===row[0])?'left':hand.some(w=>w.v===row.at(-1))?'right':'left';
            await advance(()=>pages[who].locator('[data-act=sequence-end][data-end="'+end+'"]').click());continue;
          }
          const own=v[who].players[who].stands.flat().filter(w=>!w.cut);
          if(own.every(w=>BB.kindOf(w)==='r')){await advance(()=>pages[who].locator('[data-act=red]').click());continue;}
          const ends=V.official.numberEnds,current=ends.row[ends.end==='left'?0:ends.row.length-1],candidate=own.filter(w=>BB.kindOf(w)!=='r'&&BB.seqAllowed(v[who],BB.annOf(w),who)).sort((a,b)=>Number(b.v===current)-Number(a.v===current))[0];assert(candidate);
          const value=BB.annOf(candidate),target=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))).find(w=>w.owner!==who&&!w.cut&&BB.matches(w,value));
          if(!target){await advance(()=>pages[who].locator('[data-act=solo][data-v="'+value+'"]').click());continue;}
          await wire(who,target.id);await advance(()=>pages[who].locator('[data-act=val][data-v="'+value+'"]').click());await advance(()=>pages[target.owner].locator('[data-act=resolve-target]').click());const ownChoices=(await views())[who].pending.choices;await advance(()=>wire(who,ownChoices.at(-1)));
        }
        if(n===2)assert.equal((await views())[0].phase,'won');
        console.log('✓ 第36关开发版'+n+'人：375像素手机双视图、队长先选端再标记、真实拆线移牌、行动者独立选择、初始暂停及刷新继续通过'+(n===2?'；真实网页完整通关':'')+'');
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
