const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb41-browser-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
 const code='W'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=Array.from({length:n},(_,i)=>({pid:code+'-p'+i,name:'交换验收'+i,credential:code+'-凭证'+i,bot:false}));let G;
 for(let seed=1;seed<=1000;seed++){G=BB.createGame(M.get('official-development',41),seats,{captain:0,rng:rng(seed*104729)});if(G.equip.some(e=>e.n===2)&&(n!==5||!G.wires.some(w=>w.o===0&&BB.kindOf(w)==='r')))break;}assert(G.equip.some(e=>e.n===2));
 while(G.phase==='setup'){const pd=BB.view(G,G.pending.to).pending;assert.equal(BB.act(G,pd.to,{a:'initial-clue',id:pd.id,w:pd.choices.length?pd.choices.at(-1):null,rack:0},{rng:()=>0.371}),null);}
 for(let k=0;k<300&&!G.officialState.tripwire.stalled;k++){const pi=G.pending?G.pending.to:G.turn;let a;if(G.pending){const pd=G.pending;a={a:'resolve',id:pd.id,w:pd.step==='own'?BB.view(G,pi).pending.choices.at(-1):pd.ids.find(id=>G.wires[id].v===pd.vals[0])};}else{const value=G.wires.find(w=>w.o===pi&&!w.cut&&BB.kindOf(w)==='b').v,target=G.wires.find(w=>w.o!==pi&&!w.cut&&w.v===value);a=BB.soloOk(G,pi,value)?{a:'solo',val:value}:{a:'dual',w:target.id,val:value};}assert.equal(BB.act(G,pi,a),null);}
 assert(G.officialState.tripwire.stalled);const red=G.wires.find(w=>!w.cut&&BB.kindOf(w)==='r'),onlyYellow=G.players.findIndex((_,owner)=>owner!==red.o&&G.wires.filter(w=>w.o===owner&&!w.cut).length===1);let sender,receiver,offer,reply;
 if(onlyYellow>=0){sender=red.o;receiver=onlyYellow;offer=red.id;reply=G.wires.find(w=>w.o===receiver&&!w.cut).id;}else{sender=(red.o+1)%n;receiver=red.o;offer=G.wires.find(w=>w.o===sender&&!w.cut&&BB.kindOf(w)==='y').id;reply=red.id;}
 G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:41,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});return {code,seats,sender,receiver,offer,reply};
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of [2,3,4,5]) {
      const data = fixture(n), pages = [], contexts = []; let threeD = true;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'tripwire');
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        let v=await views();assert(v[0].official.tripwire.stalled);
        for(let mode=0;mode<2;mode++){for(const p of pages){assert((await p.locator('.act').innerText()).includes('随时装备'));assert.equal(await p.locator('[data-act=tripwire-start]').count(),0);assert.equal(await p.locator('.seat3.turn,.pblock.turn').count(),0);}await toggle();}
        await pages[data.sender].locator('[data-act=eq][data-n="2"]').click();await wire(data.sender,data.offer);await advance(()=>pages[data.sender].locator('[data-act=eqp][data-p="'+data.receiver+'"]').click());
        const decision=(await views())[0].pending.id,responder=pages[data.receiver];await responder.reload({waitUntil:'domcontentloaded'});await responder.locator('#jcode').fill(data.code);await responder.locator('#btn-join').click();await responder.waitForFunction(id=>window.testView?.pending?.id===id,decision);await advance(()=>wire(data.receiver,data.reply));
        v=await views();assert(!v[0].official.tripwire.stalled);assert(v[v[0].turn].players[v[0].turn].stands.flat().filter(w=>!w.cut).every(w=>BB.kindOf(w)==='r'));
        let helped=false;
        for(let k=0;k<40&&(v=await views())[0].phase==='play';k++){
          const who=v[0].turn,all=v.flatMap((view,owner)=>view.players[owner].stands.flat().map(w=>({...w,owner}))),yellow=all.find(w=>w.owner!==who&&!w.cut&&BB.kindOf(w)==='y');
          if(yellow){await pages[who].locator('[data-act=tripwire-start]').click();await wire(who,yellow.id);await advance(()=>pages[who].locator('[data-act=tripwire-submit]').click());await advance(()=>pages[yellow.owner].locator('[data-act=tripwire-reply]').click());helped=true;}
          else await advance(()=>pages[who].locator('[data-act=red]').click());
        }assert(helped);assert.equal((await views())[0].phase,'won');
        console.log('✓ 第41关来源合法'+n+'人全员跳过局面：手机双视图允许随时交换、回应中刷新、红线队员重新行动并处理全部绊线，完整通关');
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
