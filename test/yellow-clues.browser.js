// 仅向隔离测试服务器的私有目录写入任务夹具，不向公开大厅开放开发关卡。
// BB_PLAYWRIGHT_MODULE=/tmp/rose-qa/node_modules/playwright BB_BROWSER_URL=http://127.0.0.1:9123 node test/yellow-clues.browser.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123';
const dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb-yellow-server-data';
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(mid, n, event) {
  const code = Date.now().toString(36).slice(-2).toUpperCase() + (event ? 'E' : 'I') + mid + 'N' + n;
  const seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '验收玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  let G;
  for (let seed = 41 + n; seed < 2000; seed++) {
    G = BB.createGame(M.get('official-development', mid), seats, { rng: rng(seed), captain: n - 1 });
    if (mid !== 22 || event || G.setupNeeds.every(need => need > 0) && G.setupNeeds.some(need => need === 2)) break;
  }
  G.catalog = G.mission.catalog = 'campaign';
  if (event) {
    while (G.phase === 'setup') { const pi = BB.setupActor(G); assert.equal(BB.act(G, pi, Bot.decide(G, pi)), null); }
    const yellows = G.wires.filter(w => BB.kindOf(w.v) === 'y');
    G.turn = yellows[0].o;
    const target = yellows.find(w => w.o !== G.turn);
    if (target) {
      assert.equal(BB.act(G, G.turn, { a: 'dual', w: target.id, val: 'Y' }), null);
      assert.equal(BB.act(G, target.o, { a: 'resolve', id: G.pending.id, w: target.id }), null);
      assert.equal(BB.act(G, G.turn, { a: 'resolve', id: G.pending.id, w: yellows[0].id }, { rng: rng(88) }), null);
    } else assert.equal(BB.act(G, G.turn, { a: 'solo', val: 'Y' }, { rng: rng(88) }), null);
    assert.equal(G.pending.type, 'clue');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const missions = (process.env.BB_TEST_MISSIONS || '22,27').split(',').map(Number);
    const counts = (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number);
    for (const mid of missions) for (const n of counts) for (const event of [false, true]) {
      const { code, seats } = fixture(mid, n, event), pages = [], contexts = [];
      try {
        const threeD = event ? n >= 4 : n <= 3;
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD }) => {
            localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_name', JSON.stringify(seat.name));
            localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket;
            window.WebSocket = class extends Socket {
              constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); }
            };
          }, { code, seat: seats[pi], threeD });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' });
          await page.locator('#nm').fill(seats[pi].name); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click();
          await page.waitForFunction(() => window.testView && document.querySelector('#scr-game .act'));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        const host = pages[0];
        async function advance(page, callback) { const revision = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, revision); }
        if (!event) {
          while ((await host.evaluate(() => window.testView.phase)) === 'setup') {
            const views = await Promise.all(pages.map(p => p.evaluate(() => window.testView))), pi = BB.setupActor(views[0]), current = views[pi];
            const page = pages[pi];
            await page.waitForFunction(pi => window.testView.phase !== 'setup' || window.testView.setup[pi] < window.testView.setupNeeds[pi], pi);
            assert((await page.locator('.setup-notice').innerText()).includes(seats[pi].name));
            if (mid === 22) {
              assert(current.official.missingSetup); const need = BB.setupNeed(current, pi);
              for (const value of current.official.missingSetup.values.slice(0, need)) await page.locator('[data-act=missing-value][data-v="' + value + '"]').click();
              assert.equal(await page.locator('.vbtn.on').count(), need);
              await advance(page, () => page.locator('[data-act=missing-submit]').first().click());
            } else {
              const selector = threeD ? '.slot.can' : '.pblock.mine .tile';
              const wire = current.players[pi].stands.flat().find(w => Number.isInteger(w.v) && !w.info);
              await advance(page, () => page.locator(selector + '[data-w="' + wire.id + '"]').click());
            }
          }
          assert.equal((await host.evaluate(() => window.testView)).turn, n - 1);
          if (mid === 22) assert(await host.locator('.side-clue').count() > 0);
          if (mid === 27 && n === 2) assert.equal((await host.evaluate(() => window.testView.setup))[1], 0);
        } else {
          const start = await host.evaluate(() => window.testView.turnNo);
          for (let k = 0; k < n * 2; k++) {
            const pd = await host.evaluate(() => window.testView.pending); assert.equal(pd.type, 'clue');
            const page = pages[pd.to]; await page.waitForFunction(id => window.testView.pending?.id === id, pd.id);
            assert((await page.locator('.turn-notice').last().innerText()).includes(seats[pd.to].name));
            const view = await page.evaluate(() => window.testView);
            if (mid === 27) for (const client of pages) {
              await client.waitForFunction(id => window.testView.pending?.id === id, pd.id);
              assert.equal(await client.locator('.clue-pool [data-token]').count(), view.official.cluePool.length);
              for (const token of view.official.cluePool) assert.equal(await client.locator('.clue-pool [data-token="' + token.id + '"]').innerText(), String(token.value));
            }
            for (let other = 0; other < n; other++) if (other !== pd.to) {
              await pages[other].waitForFunction(id => window.testView.pending?.id === id, pd.id);
              const p = await pages[other].evaluate(() => window.testView.pending); assert(!p.choices && !p.tokens); assert(!('canPlaceAside' in p));
            }
            // 重载一次，继续同一私人决策；本轮双人用真实浏览器断开并重连。
            if (n === 2 && k === 1) {
              await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click();
              await page.waitForFunction(id => window.testView?.pending?.id === id, pd.id);
            }
            if (pd.step === 'choose') await advance(page, () => page.locator('[data-act=clue-select]').last().click());
            else if (view.pending.canPlaceAside) await advance(page, () => page.locator('[data-act=clue-aside]').last().click());
            else {
              const selector = threeD ? '.slot.can' : '.pblock.mine .tile';
              await advance(page, () => page.locator(selector + '[data-w="' + view.pending.choices.at(-1) + '"]').click());
            }
            if (k + 1 < n * 2) assert.equal(await host.evaluate(() => window.testView.turnNo), start);
          }
          const result = await host.evaluate(() => window.testView); assert.equal(result.pending, null); assert(result.official.clueEvent.finished); assert.equal(result.turnNo, start + 1);
          // 换视图后旁置标记仍可看到；两种界面均保持移动端宽度。
          for (const page of pages) { await page.locator('#scr-game [data-act=view]').click(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
        }
        console.log(`✓ 第${mid}关 ${n}人 ${event ? '黄线奖励、私人选择及重连' : '初始标记'} ${threeD ? '三维' : '二维'} 手机界面`);
      } finally { await Promise.all(contexts.map(c => c.close())); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
