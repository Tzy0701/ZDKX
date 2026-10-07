const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb38-actions-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n, wrong) {
  const code = 'A' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '朝外动作' + i, credential: code + '-凭证' + i, bot: false })); let G, target;
  for (let seed = 1; seed < 500; seed++) { G = BB.createGame(M.get('official-development', 38), seats, { captain: 0, rng: rng(seed * 104729) }); const outward = G.wires[G.officialState.outwardId]; if (BB.kindOf(outward) !== 'b') continue; target = G.wires.find(w => w.o !== 0 && BB.kindOf(w) === 'b' && (wrong ? w.v !== outward.v : w.v === outward.v)); if (target) break; }
  assert(target); G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 38, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 }); return { code, seats, target, id: G.officialState.outwardId };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (let n = 2; n <= 5; n++) for (const wrong of [false, true]) {
      const data = fixture(n, wrong), pages = [], contexts = []; let threeD = true;
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
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') { const v = await views(), pi = BB.setupActor(v[0]), id = v[pi].players[pi].stands.flat().find(w => BB.setupInfoAllowed(v[pi], w) && w.v != null && BB.kindOf(w) === 'b').id; await advance(() => wire(pi, id)); }
        await host.locator('[data-act=mode][data-m=outward]').click(); for (let mode = 0; mode < 2; mode++) { assert.equal(await host.locator('[data-act=val]').count(), 12); await toggle(); }
        await wire(0, data.target.id); await advance(() => host.locator('[data-act=val][data-v="' + data.target.v + '"]').click());
        for (const p of pages) assert.equal(await p.locator('.declared-target').count(), 1); await advance(() => pages[data.target.o].locator('[data-act=resolve-target]').click());
        for (let mode = 0; mode < 2; mode++) {
          const v = await views(); assert.deepEqual(v[0].pending.choices, [data.id]); for (const view of v) assert.equal(view.players[data.target.o].stands.flat().find(w=>w.id===data.target.id).v,data.target.v); assert.equal(v[0].players[0].stands.flat().find(w => w.id === data.id).v, null); for (let pi = 1; pi < n; pi++) assert(!('choices' in v[pi].pending)); assert((await host.locator('.act').innerText()).includes('朝外线')); await toggle();
        }
        await host.reload({ waitUntil: 'domcontentloaded' }); await host.locator('#jcode').fill(data.code); await host.locator('#btn-join').click(); await host.waitForFunction(() => window.testView?.pending?.step === 'own'); assert.deepEqual((await views())[0].pending.choices, [data.id]);
        await advance(() => wire(0, data.id)); let V = (await views())[0]; assert.equal(V.det, 0); assert.equal(V.players[0].dd, 1); assert.equal(V.phase, wrong ? 'lost' : 'play');
        if (!wrong && n === 2) for (let k = 0; k < 150 && (V = (await views())[0]).phase === 'play'; k++) {
          const v = await views(), pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(() => pages[pi].locator('[data-act=red]').click()); continue; }
          const value = own.find(w => BB.kindOf(w) === 'b').v, target = all.find(w => w.owner !== pi && !w.cut && w.v === value);
          if (!target) { await advance(() => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click()); continue; }
          await wire(pi, target.id); await advance(() => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click()); await advance(() => pages[target.owner].locator('[data-act=resolve-target]').click()); const choices = (await views())[pi].pending.choices; await advance(() => wire(pi, choices.at(-1)));
        }
        if (!wrong && n === 2) assert.equal((await views())[0].phase, 'won');
        console.log('✓ 第38关开发版' + n + '人：手机二维／三维盲猜宣告、队友回应、同样的私人朝外确认和刷新恢复；' + (wrong ? '自己的盲猜错误立即爆炸' : n === 2 ? '完整通关' : '正确拆除'));
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
