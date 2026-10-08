// 第18关真实浏览器验收；仅向隔离服务器的私有目录写入夹具。
const assert = require('assert'), fs = require('fs'), path = require('path');
const BB = require('../js/engine'), M = require('../js/missions');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123';
const dir = process.env.BB_TEST_DATA_DIR || '/tmp/bb18-test-data';
const publicRun = process.env.BB_PUBLIC === '1';
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function fixture(n) {
  const code = 'R' + Date.now().toString(36).slice(-4).toUpperCase() + n;
  const seats = Array.from({ length: n }, (_, i) => ({ pid: code + '-p' + i, name: '雷达玩家' + i, credential: '测试凭证-' + code + '-' + i, bot: false }));
  const G = BB.createGame(M.get('official-development', 18), seats, { rng: rng(180 + n), captain: 0 });
  G.catalog = G.mission.catalog = 'campaign';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bb-' + code.toLowerCase() + '.json'), JSON.stringify({ version: 1, name: 'bb-' + code.toLowerCase(), host: seats[0].pid, mid: 18, ruleset: 'campaign', attempts: 1, started: true, seats, observers: [], revision: 0, seen: [], G }), { mode: 0o600 });
  return { code, seats };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    for (const n of (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number)) {
      const data = publicRun ? { code: null, seats: Array.from({ length: n }, (_, i) => ({ name: '雷达验收' + i })) } : fixture(n);
      let code = data.code; const seats = data.seats, contexts = [], pages = []; let threeD = n <= 3;
      try {
        for (let pi = 0; pi < n; pi++) {
          const context = await browser.newContext({ viewport: { width: 375, height: 820 }, reducedMotion: 'reduce' }); contexts.push(context);
          await context.addInitScript(({ code, seat, threeD, publicRun }) => {
            localStorage.setItem('bb_name', JSON.stringify(seat.name));
            if (!publicRun) { localStorage.setItem('bb_pid', JSON.stringify(seat.pid)); localStorage.setItem('bb_officialCredentials', JSON.stringify({ [code]: seat.credential })); }
            if (localStorage.getItem('bb_view3d') === null) localStorage.setItem('bb_view3d', JSON.stringify(threeD));
            const Socket = window.WebSocket;
            window.testMessages = [];
            window.WebSocket = class extends Socket { constructor(...args) { super(...args); window.testSocket = this; this.addEventListener('message', e => { try { const m = JSON.parse(e.data); window.testMessages.push({ topic: m.topic, revision: m.data?.revision, error: m.topic === 'official:error' ? m.data?.msg : null }); if (window.testMessages.length > 30) window.testMessages.shift(); if (m.topic === 'official:welcome') window.testWelcomes = (window.testWelcomes || 0) + 1; if (m.topic === 'official:view') { window.testView = m.data.view; window.testRevision = m.data.revision; } } catch (_) {} }); } };
          }, { code, seat: seats[pi], threeD, publicRun });
          const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort()); await page.goto(base, { waitUntil: 'domcontentloaded' });
          await page.locator('#nm').fill(seats[pi].name);
          if (publicRun && pi === 0) { await page.locator('#btn-host').click(); await page.locator('#scr-lobby .code').waitFor(); code = await page.locator('#scr-lobby .code').innerText(); }
          else { await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); }
          if (publicRun) await pages[0].waitForFunction(count => document.querySelectorAll('#scr-lobby .seat').length === count, pi + 1);
          else await page.waitForFunction(() => window.testView?.official?.radarCommand && document.querySelector('#scr-game .act'));
        }
        const host = pages[0];
        if (publicRun) {
          assert((await host.locator('#msel option[value="18"]').innerText()).includes('已核实'));
          await host.locator('#msel').selectOption('18'); await host.locator('#scr-lobby [data-act=start]').click();
        }
        for (const page of pages) {
          await page.waitForFunction(() => window.testView?.official?.radarCommand && document.querySelector('#scr-game .act'));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          assert((await page.locator('#scr-game').innerText()).includes('每回合重复使用'));
        }
        async function synchronize() { const revision = await host.evaluate(() => window.testRevision); await Promise.all(pages.map(p => p.waitForFunction(r => window.testRevision === r, revision))); }
        async function advance(page, callback) { await synchronize(); const revision = await host.evaluate(() => window.testRevision); await callback(); await host.waitForFunction(r => window.testRevision > r, revision); await synchronize(); }
        async function views() { await synchronize(); return Promise.all(pages.map(p => p.evaluate(() => window.testView))); }
        async function wireClick(page, id) { await page.locator('#scr-game ' + (threeD ? '.slot.can' : '.tile.can') + '[data-w="' + id + '"]').click(); }
        let rounds = 0, delegated = false, duplicateChosen = false, reconnectedRadar = false, reconnectedOwn = false, repeatHello = false;
        while ((await host.evaluate(() => window.testView.phase)) === 'play' && (n === 2 || rounds < 2)) {
          const initial = await host.evaluate(() => window.testView), officer = initial.turn, startTurn = initial.turnNo;
          let command = initial.official.radarCommand;
          if (command.step === 'red') {
            await advance(pages[officer], () => pages[officer].locator('[data-act=red]').click()); rounds++; continue;
          }
          assert.equal(command.step, 'draw'); assert.equal(command.answers, null);
          await advance(pages[officer], () => pages[officer].locator('[data-act=number-draw]').click());
          // 共享装备卡与行动区均能发起本回合查询。
          await advance(pages[officer], () => rounds % 2 === 0 ? pages[officer].locator('[data-act=eq][data-n="8"]').click() : pages[officer].locator('[data-act=radar-query]').click());
          let current = await views(); const pd = current[0].pending;
          assert.equal(pd.type, 'radar'); assert(pd.answers.every(a => a === null));
          for (let pi = n - 1; pi >= 0; pi--) {
            const own = current[pi].pending.ownAnswers;
            assert.deepEqual(own, current[pi].players[pi].stands.map(r => r.some(w => !w.cut && w.v === pd.value)));
            assert.equal(own.length, n === 2 || n === 3 && pi === 0 ? 2 : 1);
            if (n === 2 && !reconnectedRadar) {
              const page = pages[pi]; await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); await page.waitForFunction(id => window.testView?.pending?.id === id, pd.id); reconnectedRadar = true;
            }
            await advance(pages[pi], () => pages[pi].locator('[data-act=radar-reply]').click());
            current = await views();
            if (current[0].pending) {
              assert.deepEqual(current[0].pending.answers[pi], own);
              for (let other = 0; other < pi; other++) assert.equal(current[0].pending.answers[other], null);
              assert(!current[pi].pending.ownAnswers);
            }
          }
          command = current[0].official.radarCommand; assert.equal(command.step, 'choose');
          const eligible = command.answers.map((a, pi) => a.some(Boolean) ? pi : -1).filter(pi => pi >= 0);
          const actor = eligible.find(pi => pi !== officer) ?? eligible[0]; delegated ||= actor !== officer;
          await advance(pages[officer], () => pages[officer].locator('[data-act=command-select][data-p="' + actor + '"]').click());
          current = await views(); assert.equal(current[0].turn, officer); assert.equal(BB.turnActor(current[0]), actor);
          assert((await pages[actor].locator('.turn-notice').innerText()).includes(seats[actor].name));
          const value = command.value, own = current[actor].players[actor].stands.flat().filter(w => !w.cut && w.v === value);
          const allWires = current.flatMap((v, pi) => v.players[pi].stands.flat().map(w => ({ ...w, owner: pi })));
          const total = allWires.filter(w => !w.cut && w.v === value);
          if (total.every(w => w.owner === actor)) {
            await advance(pages[actor], () => pages[actor].locator('[data-act=solo][data-v="' + value + '"]').click());
          } else {
            const target = total.find(w => w.owner !== actor);
            await wireClick(pages[actor], target.id);
            if (!repeatHello) {
              const count = await pages[actor].evaluate(code => { const count = window.testWelcomes; window.testSocket.send(JSON.stringify({ t: 'emit', topic: 'hello', data: { name: JSON.parse(localStorage.getItem('bb_name')), credential: JSON.parse(localStorage.getItem('bb_officialCredentials'))[code] } })); return count; }, code);
              await pages[actor].waitForFunction(count => window.testWelcomes > count, count);
              assert(await pages[actor].locator('[data-act=val][data-v="' + value + '"]').isEnabled(), '同一身份重复握手不能清除已选择的目标'); repeatHello = true;
            }
            await advance(pages[actor], () => pages[actor].locator('[data-act=val][data-v="' + value + '"]').click());
            for (const page of pages) assert((await page.locator('.target-declaration').innerText()).includes(String(value)));
            await advance(pages[target.owner], () => pages[target.owner].locator('[data-act=resolve-target]').click());
            if (n === 2 && own.length > 1 && !reconnectedOwn) {
              const page = pages[actor]; const pendingId = await page.evaluate(() => window.testView.pending.id);
              await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#jcode').fill(code); await page.locator('#btn-join').click(); await page.waitForFunction(id => window.testView?.pending?.id === id, pendingId); reconnectedOwn = true;
            }
            const selected = own.at(-1); duplicateChosen ||= own.length > 1;
            await advance(pages[actor], () => wireClick(pages[actor], selected.id));
            const final = await pages[actor].evaluate(() => window.testView);
            assert(final.players[actor].stands.flat().find(w => w.id === selected.id).cut);
            if (own.length > 1) assert(!final.players[actor].stands.flat().find(w => w.id === own[0].id).cut);
          }
          const result = await host.evaluate(() => window.testView);
          assert.equal(result.det, 0); assert(!result.equip[0].used); assert.equal(result.turnNo, startTurn + 1);
          if (result.phase === 'play') {
            let next = (officer + 1) % n;
            while (result.players[next].stands.flat().every(w => w.cut)) next = (next + 1) % n;
            assert.equal(result.turn, next); assert.equal(result.official.radarCommand.answers, null);
          }
          rounds++;
          if (rounds === 1) { for (const page of pages) { await page.locator('#scr-game [data-act=view]').click(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); } threeD = !threeD; }
          assert(rounds <= 40);
        }
        assert(delegated, '应验证指定其他玩家执行拆线');
        if (n === 2) { assert.equal(await host.evaluate(() => window.testView.phase), 'won'); assert(duplicateChosen && reconnectedRadar && reconnectedOwn); }
        console.log(`✓ 第18关 ${n}人 手机宽度、二维／三维、逐架公开回应、指定行动及轮序${n === 2 ? '，整局完成与两阶段重连' : ''}`);
      } catch (error) {
        console.error('浏览器故障诊断', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => ({ messages: window.testMessages, turn: window.testView?.turn, command: window.testView?.official?.radarCommand, pending: window.testView?.pending?.type, panel: document.querySelector('.act')?.innerText })))), null, 2));
        throw error;
      } finally { await Promise.all(contexts.map(c => c.close())); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
