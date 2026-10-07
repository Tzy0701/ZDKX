// 第17关来源配置，隔离本机服务器，不向公开房间注入开发数据。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb17-test-data';
const publicRun = process.env.BB_PUBLIC === '1';
if (!publicRun && (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/'))) throw new Error('开发夹具只允许隔离本机服务器');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'L' + Date.now().toString(36).slice(-4).toUpperCase() + n, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '说谎验收' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G; for (let seed = 1; seed < 400; seed++) { G = BB.createGame(M.get('official-development', 17), seats, { rng: rng(seed * 104729), captain: 0 }); if (G.equip.some(e => e.n === 10)) break; }
  assert(G.equip.some(e => e.n === 10)); G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 17, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 }); return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (let n = 2; n <= 5; n++) {
      const data = publicRun ? { code: null, seats: Array.from({ length: n }, (_, i) => ({ name: '说谎公网' + i })) } : fixture(n), pages = [], contexts = []; let threeD = n <= 3, ownReload = false, setupReload = false, failureDone = false, duplicate = false;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD, publicRun }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name));
            if (!publicRun) { localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); }
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code: data.code, seat: data.seats[pi], threeD, publicRun });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(data.seats[pi].name);
          if (publicRun && pi === 0) { await page.locator('#btn-host').click(); await page.locator('#scr-lobby .code').waitFor(); data.code = await page.locator('#scr-lobby .code').innerText(); }
          else { await page.locator('#jcode').fill(data.code); await page.locator('#btn-join').click(); }
          if (publicRun) await pages[0].waitForFunction(count => document.querySelectorAll('#scr-lobby .seat').length === count, pi + 1);
          else await page.waitForFunction(() => window.testView?.official?.module === 'liar');
        }
        const host = pages[0];
        if (publicRun) { assert((await host.locator('#msel option[value="17"]').innerText()).includes('已核实')); await host.locator('#msel').selectOption('17'); await host.locator('#scr-lobby [data-act=start]').click(); await Promise.all(pages.map(p => p.waitForFunction(version => window.testView?.official?.module === 'liar' && window.testView.contentVersion === version, M.CAMPAIGN_VERSION))); }
        const liar = await host.evaluate(() => window.testView.official.liar);
        async function sync() { for (let k = 0; k < 10; k++) { const r = Math.max(...await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision >= r, r))); if ((await Promise.all(pages.map(p => p.evaluate(() => window.testRevision)))).every(x => x === r)) return; } throw new Error('客户端修订号持续不一致'); }
        async function views() { await sync(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function advance(callback) { await sync(); const r = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, r); await sync(); }
        async function wire(pi, id) { await pages[pi].locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        async function toggle() { for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD; }
        async function reload(pi) { const r = await host.evaluate(() => window.testRevision); await pages[pi].reload({ waitUntil: 'domcontentloaded' }); await pages[pi].locator('#jcode').fill(data.code); await pages[pi].locator('#btn-join').click(); await pages[pi].waitForFunction(r => window.testRevision >= r && window.testView?.official?.module === 'liar', r); await sync(); }
        for (let mode = 0; mode < 2; mode++) { for (const page of pages) { assert.equal(await page.locator('.liar-tag').count(), 1); assert.equal(await page.locator('.character-card').count(), n - 1); assert((await page.locator('.liar-notice').innerText()).includes(data.seats[liar].name)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); } await toggle(); }
        while ((await host.evaluate(() => window.testView.phase)) === 'setup') {
          const v = await views(), pi = BB.setupActor(v[0]), own = v[pi].players[pi].stands.flat(), fake = v[pi].official.fakeSetup, tile = own.find(w => BB.kindOf(w) === 'b' && !w.info && (!fake || !fake.usedIds.includes(w.id)));
          v.forEach((view, owner) => assert.equal(!!view.official.fakeSetup, owner === liar && pi === liar));
          if (fake) {
            if (!setupReload && v[0].setup[liar] === 1) { await reload(liar); setupReload = true; }
            await wire(pi, tile.id); assert(await pages[pi].locator('[data-act=fake-value][data-v="' + tile.v + '"]').isDisabled());
            await advance(() => pages[pi].locator('[data-act=fake-value][data-v="' + (tile.v === 1 ? 2 : 1) + '"]').click());
          } else await advance(() => wire(pi, tile.id));
        }
        assert(setupReload); assert.equal(await pages[liar].locator('[data-act=mode][data-m=dd]').count(), 0);
        for (let step = 0; step < 220; step++) {
          const v = await views(), V = v[0]; if (V.phase !== 'play' || n !== 2 && failureDone && duplicate) break;
          const pi = V.turn, own = v[pi].players[pi].stands.flat().filter(w => !w.cut), all = v.flatMap((view, owner) => view.players[owner].stands.flat().map(w => ({ ...w, owner })));
          if (own.every(w => BB.kindOf(w) === 'r')) { await advance(() => pages[pi].locator('[data-act=red]').click()); continue; }
          const values = [...new Set(own.filter(w => BB.kindOf(w) === 'b').map(w => w.v))];
          let wrong, pair;
          if (!failureDone && pi !== liar && V.equip.find(e => e.n === 10)?.open) for (let a = 0; a < values.length && !wrong; a++) for (let b = a + 1; b < values.length && !wrong; b++) { wrong = all.find(w => w.owner === liar && !w.cut && BB.kindOf(w) === 'b' && ![values[a], values[b]].includes(w.v)); if (wrong) pair = [values[a], values[b]]; }
          if (!wrong && publicRun && !failureDone && pi !== liar) { wrong = all.find(w => w.owner === liar && !w.cut && BB.kindOf(w) === 'b' && w.v !== values[0]); if (wrong) pair = [values[0]]; }
          if (wrong) {
            if (pair.length > 1) await pages[pi].locator('[data-act=eq][data-n="10"]').click(); await wire(pi, wrong.id);
            if (pair.length > 1) await pages[pi].locator('[data-act=val][data-v="' + pair[0] + '"]').click();
            await advance(() => pages[pi].locator('[data-act=val][data-v="' + pair.at(-1) + '"]').click());
            (await views()).forEach((view, owner) => assert.equal('clueValues' in view.pending, owner === liar));
            for (let mode = 0; mode < 2; mode++) { for (const page of pages) assert.equal(await page.locator('.declared-target').count(), 1); await toggle(); }
            await reload(liar); if (pair.length > 1) { assert(await pages[liar].locator('[data-act=resolve-target]').isDisabled()); await pages[liar].locator('[data-act=failure-value][data-v="' + pair[1] + '"]').click(); }
            await advance(() => pages[liar].locator('[data-act=resolve-target]').click());
            const done = (await views())[0], info = done.players[liar].stands.flat().find(w => w.id === wrong.id).info;
            assert.equal(done.det, 1); assert.equal(done.phase, 'play'); assert(info?.t === 'not' && info.v === String(pair.at(-1)) || done.announcement?.info.t === 'not' && done.announcement.info.v === String(pair.at(-1))); failureDone = true; continue;
          }
          const multi = own.find(w => BB.kindOf(w) === 'b' && own.filter(x => BB.matches(x, w.v)).length >= 2 && all.some(x => x.owner !== pi && !x.cut && BB.matches(x, w.v)));
          const value = !failureDone && values.includes(10) ? 10 : !duplicate && multi ? multi.v : BB.annOf(own.find(w => BB.kindOf(w) !== 'r'));
          const target = all.find(w => w.owner !== pi && !w.cut && BB.matches(w, value)), copies = own.filter(w => BB.matches(w, value));
          if (!target) { await advance(() => pages[pi].locator('[data-act=solo][data-v="' + value + '"]').click()); continue; }
          await wire(pi, target.id); await advance(() => pages[pi].locator('[data-act=val][data-v="' + value + '"]').click());
          await advance(() => pages[target.owner].locator('[data-act=resolve-target]').click());
          (await views()).forEach((view, owner) => { assert.equal(view.pending.hit, target.id); assert.equal('choices' in view.pending, owner === pi); });
          if (!ownReload) { await reload(pi); ownReload = true; }
          await advance(() => wire(pi, copies.at(-1).id));
          if (copies.length > 1) { duplicate = true; assert(!(await pages[pi].evaluate(id => window.testView.players[window.testView.me].stands.flat().find(w => w.id === id).cut, copies[0].id))); }
        }
        assert(failureDone && duplicate && ownReload); if (n === 2) assert.equal((await views())[0].phase, 'won');
        await host.screenshot({ path: '/tmp/bb17-' + n + '-mobile.png' });
        console.log('✓ 第17关' + (publicRun ? '公网' : '开发版') + n + '人：手机双视图公开身份与移除角色、错误开局标记、失败私有选择、公开回应、重复手牌及重连' + (n === 2 ? '，完整通关' : ''));
        if (publicRun && await host.locator('[data-act=host-quit]').count()) { host.once('dialog', dialog => dialog.accept()); await host.locator('[data-act=host-quit]').click(); await host.locator('#scr-lobby').waitFor({ state: 'visible' }); }
      } catch (error) { console.error('浏览器诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ phase: window.testView?.phase, pending: window.testView?.pending, panel: document.querySelector('.act')?.innerText })))))); throw error; }
      finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
