const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb-dial-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }

const { ready, miss }=require('./printed-dial.test');
(async()=>{const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];try{for(let n=2;n<=5;n++){
 const G=ready(n);if(n===5)miss(G);const code='D'+Date.now().toString(36).slice(-4).toUpperCase()+n,seats=G.players.map((p,i)=>({pid:p.pid,name:p.name,credential:code+'-凭证'+i,bot:false}));G.catalog=G.mission.catalog='campaign';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'bb-'+code.toLowerCase()+'.json'),JSON.stringify({version:1,name:'bb-'+code.toLowerCase(),host:seats[0].pid,mid:3,ruleset:'campaign',attempts:1,started:true,seats,observers:[],revision:0,seen:[],G}),{mode:0o600});const data={code,seats},pages=[],contexts=[];let threeD=true;
 try{
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.mid === 3 && window.testView?.mission?.printedDial);
        }
        const host = pages[0];
        async function sync() { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(f) { await sync(); const r = await host.evaluate(() => window.testRevision); await f(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const p of pages) await p.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
for(let mode=0;mode<2;mode++){const v=(await views())[0];assert.equal(v.detMin,n-5);if(!threeD){assert.equal(await host.locator('.det-c.printed').count(),6);assert.equal(await host.locator('.det-c.current').innerText(),String(5-(v.det-v.detMin))+'人');}for(const p of pages)assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await toggle();}
 await host.locator('[data-act=eq][data-n="6"]').click();await advance(()=>host.locator('[data-act=eqinstant]').click());const result=(await views())[0];assert.equal(result.det,n===5?0:-1);assert(result.equip.find(e=>e.n===6).used);for(let mode=0;mode<2;mode++){assert((await host.locator(threeD ? '.hud-r' : '.det').innerText()).includes('还剩 '+(n===5?5:n+1)+' 格'));if(!threeD)assert.equal(await host.locator('.det-c.current').innerText(),String(n===5?5:n+1)+'人');await toggle();}
 console.log('✓ '+n+'人手机二维／三维印刷轨道、人数起点、倒带器及剩余格数通过');
 }finally{for(const c of contexts)await c.close();}}
 assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
