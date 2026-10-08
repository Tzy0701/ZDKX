// 第38关视角基础验收；没有声称盲猜动作或任务完整通关。
const assert = require('assert'), fs = require('fs'), path = require('path'), BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123', dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb38-test-data';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base) || !dir.startsWith('/tmp/')) throw new Error('只允许隔离本机测试');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
(async () => {
  const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] }), errors = [];
  try {
    for (let n = 2; n <= 5; n++) {
      const code = 'O' + Date.now().toString(36).slice(-4).toUpperCase() + n, captain = n - 1, seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '朝外视角' + i, credential: code + '-凭证' + i, bot: false }));
      const G = BB.createGame(M.get('official-development', 38), seats, { captain, rng: rng(n * 104729) }), id = G.officialState.outwardId;
      G.catalog = G.mission.catalog = 'campaign'; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 38, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
      const contexts = [], pages = []; let threeD = true;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name)); localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', 'true');
            const Socket = window.WebSocket; window.WebSocket = class extends Socket { constructor(...args) { super(...args); this.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code, seat: seats[pi] });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#nm').fill(seats[pi].name); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); await page.waitForFunction(() => window.testView?.official?.module === 'captain-outward-wire');
        }
        for (let mode = 0; mode < 2; mode++) {
          for (let pi = 0; pi < n; pi++) {
            const page = pages[pi], tile = page.locator('#scr-game ' + (threeD ? '.slot' : '.tile') + '[data-w="' + id + '"]');
            assert.equal(await page.locator('.outward-marker:not([hidden])').count(), 1); assert.equal(await tile.locator(threeD ? '.fv' : '.tv').innerText(), pi === captain ? '' : String(G.wires[id].v)); assert(!(await tile.getAttribute('class')).includes('can'));
            const V = await page.evaluate(() => window.testView); assert.equal(V.players[captain].stands.flat().find(w => w.id === id).v, pi === captain ? null : G.wires[id].v); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          }
          for (const page of pages) await page.locator('#scr-game [data-act=view]').click(); threeD = !threeD;
        }
        await pages[captain].reload({ waitUntil: 'domcontentloaded' }); await pages[captain].locator('#jcode').fill(code); await pages[captain].locator('#btn-join').click(); await pages[captain].waitForFunction(() => window.testView?.official?.module === 'captain-outward-wire');
        assert.equal(await pages[captain].evaluate(id => window.testView.players[window.testView.me].stands.flat().find(w => w.id === id).v, id), null);
        console.log('✓ 第38关视角基础' + n + '人：手机二维／三维朝外标记、队长不见真值、其他人可见且不能选、刷新不泄漏');
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
