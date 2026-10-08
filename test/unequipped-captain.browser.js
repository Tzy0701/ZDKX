// 第28关开发模块的隔离联机浏览器验收；禁止将测试夹具写到公开服务器。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb28-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'U' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '队长验收' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 1; seed < 200; seed++) {
    G = BB.createGame(M.get('official-development', 28), seats, { rng: rng(seed), captain: 0 });
    const captain = BB.unequippedCaptain(G), own = G.wires.filter(w => w.o === captain && BB.kindOf(w) === 'b');
    if (G.equip.some(e => e.n === 9) && own.some(w => own.filter(x => x.v === w.v).length >= 2 && G.wires.some(x => x.o !== captain && x.v === w.v))) break;
  }
  assert(G.equip.some(e => e.n === 9));
  G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 28, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (const n of (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number)) for (const failure of [false, true]) {
      const data = fixture(n), pages = [], contexts = []; let threeD = n <= 3, duplicate = false, reconnected = false;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential }));
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], threeD });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name); await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'unequipped-captain');
        }
        const host = pages[0], captain = await host.evaluate(() => window.testView.official.unequippedCaptain);
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); if ((await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))).every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        async function reload(pi) { const r = await host.evaluate(() => window.testRevision); await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(r => window.testRevision >= r && window.testView?.official?.module === 'unequipped-captain', r); await sync(); reconnected = true; }
        for (let mode = 0; mode < 2; mode++) {
          for (const page of pages) { assert((await page.locator('.unequipped-captain-notice').innerText()).includes(data.seats[captain].name)); assert.equal(await page.locator('.unequipped-captain-tag').count(), 1); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
          await toggle();
        }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') { const v = await views(), pi = BB.setupActor(v[0]), id = v[pi].players[pi].stands.flat().find(w => BB.kindOf(w) === 'b').id; await advance(() => wire(pi, id)); }
        assert.equal(await host.evaluate(() => window.testView.turn), captain);
        assert.equal(await pages[captain].locator('#mod-stab').count(), 0);
        assert((await pages[captain].locator('[data-act=eq][data-n="9"]').innerText()).includes('不能保护本关队长'));
        for (let step = 0; step < 220; step++) {
          const v = await views(), V = v[0]; if (V.phase !== 'play' || !failure && n !== 2 && duplicate) break;
          const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(() => pages[pi].locator('[data-act=red]').click()); continue; }
          const available = own.filter(w => BB.kindOf(w) === 'b');
          const multi = available.find(w => own.filter(x => BB.matches(x, w.v)).length >= 2 && all.some(x => x.owner !== pi && !x.cut && BB.matches(x, w.v)));
          const value = BB.annOf(!duplicate && multi || own.find(w => BB.kindOf(w) !== 'r'));
          const target = all.find(w => w.owner !== pi && !w.cut && (failure ? BB.kindOf(w) === 'b' && !BB.matches(w, value) : BB.matches(w, value)));
          if (!target) { assert(!failure); await advance(() => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click()); continue; }
          const detBefore = V.det, copies = own.filter(w => BB.matches(w, value));
          await wire(pi, target.id); await advance(() => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click());
          const pd = (await views())[0].pending;
          (await views()).forEach((view, owner) => { assert.deepEqual(view.pending.ids, [target.id]); assert.equal('choices' in view.pending, owner === target.owner); });
          for (let mode = 0; mode < 2; mode++) {
            for (const page of pages) { assert.equal(await page.locator('.declared-target').count(), 1); assert((await page.locator('.target-notice').innerText()).includes(BB.valLabel(value))); }
            await toggle();
          }
          if (failure) {
            await reload(target.owner); await advance(() => pages[target.owner].locator('[data-act=resolve-target]').click());
            const result = (await views())[0]; assert.equal(result.phase, 'lost'); assert.equal(result.det, detBefore); assert(result.result.why.includes('队长')); assert.equal(result.declaration.result.matched, false); assert.equal(result.players[target.owner].stands.flat().find(w => w.id === target.id).info?.v ?? null, target.info?.v ?? null);
            break;
          }
          await advance(() => pages[target.owner].locator('[data-act=resolve-target]').click());
          (await views()).forEach((view, owner) => { assert.equal(view.pending.hit, target.id); assert.equal('choices' in view.pending, owner === pi); });
          if (!reconnected) await reload(pi);
          await advance(() => wire(pi, copies.at(-1).id));
          if (copies.length > 1) { duplicate = true; assert(!(await pages[pi].evaluate(id => window.testView.players[window.testView.me].stands.flat().find(w => w.id === id).cut, copies[0].id))); }
          assert.equal((await views())[0].players[pi].dd, pi === captain ? 0 : 1); assert.equal(pd.from, pi);
        }
        assert(reconnected); if (failure) assert.equal((await views())[0].phase, 'lost'); else { assert(duplicate); if (n === 2) assert.equal((await views())[0].phase, 'won'); }
        await host.screenshot({ path: '/tmp/bb28-' + n + (failure ? '-failure' : '-success') + '-mobile.png' });
        console.log('✓ 第28关开发版' + n + '人：手机二维／三维队长身份与禁用原因、公开目标箭头、私有回应及重连；' + (failure ? '队长首次蓝线猜错立即失败' : n === 2 ? '可选重复手牌并完整通关' : '可选重复手牌'));
      } catch (error) { console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))))); throw error; }
      finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
