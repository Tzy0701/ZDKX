const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb43-browser-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
 const code='N'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'补线验收'+i,credential:code+'-凭证'+i,bot:false}));let G,target;
 for(let seed=1;seed<=500;seed++){G=BB.createGame(M.get('official-development',43),seats,{captain:0,rng:rng(seed*104729)});if(G.wires.some(w=>w.o===0&&w.v===1)){target=G.wires.find(w=>w.o>0&&w.v===1);if(target)break;}}
 assert(target);const incoming=G.officialState.nano.reserve[0],value=G.wires[incoming].v;G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:43,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,target,incoming,value};
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
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'nano-robot');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        let v=await views(),remaining=v[0].official.nano.remaining;for(const p of pages)assert((await p.locator('.nano-panel').innerText()).includes('数字 1'));
        while((await views())[0].phase==='setup'){
          v=await views();const pi=BB.setupActor(v[0]),pd=v[pi].pending;if(pd){const choice=pd.choices.at(-1);await advance(()=>choice==null?pages[pi].locator('[data-act=initial-clue-aside][data-rack="0"]').click():wire(pi,choice));}
          else{const id=v[pi].players[pi].stands.flat().find(w=>BB.setupInfoAllowed(v[pi],w)&&BB.kindOf(w)==='b').id;await advance(()=>wire(pi,id));}
        }
        await wire(0,data.target.id);await advance(()=>host.locator('[data-act=val][data-v="1"]').click());await advance(()=>pages[data.target.o].locator('[data-act=resolve-target]').click());const own=(await views())[0].pending.choices;await advance(()=>wire(0,own.at(-1)));v=await views();assert.equal(v[0].official.nano.remaining,remaining-1);
        if(n<=3){assert.equal(v[0].pending.type,'nano-rack');assert.equal(v[0].official.nano.position,1);for(let pi=0;pi<n;pi++){assert.equal('drawn'in v[pi].pending,pi===0);assert.equal('choices'in v[pi].pending,pi===0);}assert.equal(v[0].pending.drawn.value,data.value);
          for(let mode=0;mode<2;mode++){assert.equal(await host.locator('[data-act=nano-rack]').count(),2);for(let pi=1;pi<n;pi++)assert.equal(await pages[pi].locator('[data-act=nano-rack]').count(),0);await toggle();}
          const decision=v[0].pending.id;await host.reload({waitUntil:'domcontentloaded'});await host.locator('#jcode').fill(data.code);await host.locator('#btn-join').click();await host.waitForFunction(id=>window.testView?.pending?.id===id,decision);await advance(()=>host.locator('[data-act=nano-rack][data-rack="1"]').click());
        }else assert.equal(v[0].pending,null);
        v=await views();assert.equal(v[0].official.nano.position,2);assert.equal(v[0].turn,1);assert.equal(v[0].players[0].stands.flat().find(w=>w.id===data.incoming).v,data.value);for(let pi=1;pi<n;pi++)assert.equal(v[pi].players[0].stands.flat().find(w=>w.id===data.incoming).v,null);
        for(let mode=0;mode<2;mode++){for(const p of pages){assert((await p.locator('.nano-panel').innerText()).includes('数字 2'));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await toggle();}
        console.log('✓ 第43关开发版'+n+'人：手机双视图公开机器人位置与数量、实际命中后行动者补一根、私人内容、双架刷新选择／单架自动放置通过');
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
