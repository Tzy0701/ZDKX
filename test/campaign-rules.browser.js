// Optional: BB_PLAYWRIGHT_MODULE=/path/to/playwright BB_BROWSER_URL=http://localhost:9123 node test/campaign-rules.browser.js
// Uses real server views and UI commands, with only test-created rooms.
const assert = require('assert');
const { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BROWSER_URL || 'http://127.0.0.1:9123';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BB_CHROMIUM || '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const missions = (process.env.BB_TEST_MISSIONS || '21,24,25,26,31,33').split(',').map(Number);
    const counts = (process.env.BB_TEST_PLAYER_COUNTS || '2,3,4,5').split(',').map(Number);
    for (const mid of missions) for (const np of counts) {
      const contexts = [], pages = [];
      try {
        for (let pi = 0; pi < np; pi++) {
          const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
          contexts.push(context);
          await context.addInitScript(() => {
            const Socket = window.WebSocket;
            window.WebSocket = class extends Socket {
              constructor(...args) {
                super(...args);
                this.addEventListener('message', e => {
                  try { const m = JSON.parse(e.data); if (m.topic === 'official:view') window.testView = m.data.view; } catch (_) {}
                });
              }
            };
          });
          const page = await context.newPage(); pages.push(page);
          page.on('pageerror', e => errors.push(e.message));
          await page.route('https://fonts.googleapis.com/**', r => r.abort());
          await page.goto(base, { waitUntil: 'domcontentloaded' });
          await page.locator('#nm').fill('验收玩家' + pi);
        }
        const host = pages[0]; await host.locator('#btn-host').click();
        await host.locator('#scr-lobby .code').waitFor();
        const code = await host.locator('#scr-lobby .code').innerText();
        for (let pi = 1; pi < np; pi++) {
          await pages[pi].locator('#jcode').fill(code); await pages[pi].locator('#btn-join').click();
          await host.waitForFunction(n => document.querySelectorAll('#scr-lobby .seat').length === n, pi + 1);
        }
        assert((await host.locator('#msel option[value="' + mid + '"]').innerText()).includes('已核实'));
        await host.locator('#msel').selectOption(String(mid));
        if (mid === 31 || mid === 33) {
          const roles = ['triple-detector', 'xy-ray', 'general-radar', 'walkie-talkies'];
          for (let p = 1; p < np; p++) {
            await pages[p].locator('.character-select[data-seat="' + p + '"]').selectOption(roles[p - 1]);
            await host.waitForFunction(({p, role}) => document.querySelector('.character-select[data-seat="' + p + '"]').value === role, {p, role: roles[p - 1]});
          }
        }
        if (mid === 31 || mid === 33) for (const page of pages) {
          await page.setViewportSize({ width: 375, height: 820 });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '手机大厅角色选择不应超出宽度');
        }
        await host.locator('#scr-lobby [data-act=start]').click();
        if (mid === 31) {
          for (let pi = 0; pi < np; pi++) {
            await pages[pi].waitForFunction(pi => window.testView?.phase === 'constraints' && window.testView.turn === pi, pi);
            const view = await pages[pi].evaluate(() => window.testView);
            assert(view.players[pi].stands.flat().every(w => w.v !== null));
            const chosen = view.official.constraints.available[0];
            await pages[pi].locator('[data-act=constraint-select][data-card="' + chosen + '"]').click();
          }
        }
        for (let pi = 0; pi < np; pi++) {
          await pages[pi].waitForFunction(() => window.testView?.phase === 'setup');
          await pages[pi].locator('#scr-game .seat3.me .slot.can').first().click();
          await host.waitForFunction(p => window.testView.setup[p] === 1, pi);
        }
        await host.waitForFunction(() => window.testView?.phase === 'play');
        for (let pi = 0; pi < np; pi++) {
          const view = await pages[pi].evaluate(() => window.testView);
          assert.equal(view.mid, mid);
          if (mid !== 25 && mid !== 26 && mid !== 31) assert.equal(view.official.clues, mid === 21 || mid === 33 ? 'parity' : 'frequency');
          assert(view.players.filter((_, p) => p !== pi).flatMap(p => p.stands.flat()).every(w => w.v === null));
          assert(view.players.flatMap(p => p.stands.flat()).filter(w => w.info).every(w => (mid === 21 || mid === 33 ? ['even', 'odd'] : mid === 24 ? ['freq'] : ['v']).includes(w.info.t)));
          if (np >= 4) await pages[pi].locator('#scr-game [data-act=view]').click();
          await pages[pi].setViewportSize({ width: 375, height: 820 });
          assert(await pages[pi].evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        if (mid === 33 && np === 5) {
          // 两种界面都使用所有新角色；回复只读取对应玩家收到的私人选择。
          async function finishDecision() {
            for (let k = 0; k < 2; k++) {
              const pd = (await host.evaluate(() => window.testView)).pending;
              if (!pd) return;
              const recipient = pages[pd.to];
              await recipient.waitForFunction(id => window.testView.pending?.id === id && Array.isArray(window.testView.pending.choices), pd.id);
              const choice = await recipient.evaluate(() => window.testView.pending.choices.at(-1));
              if (choice == null) await recipient.locator('[data-act=resolve-empty]').click();
              else await recipient.locator('#scr-game .slot.can[data-w="' + choice + '"]').click();
              await host.waitForFunction(({id, step}) => !window.testView.pending || window.testView.pending.id !== id || window.testView.pending.step !== step, { id: pd.id, step: pd.step });
            }
          }
          await pages[3].locator('[data-act=personal]').click();
          await pages[3].locator('.act [data-act=val][data-v="1"]').click();
          await host.waitForFunction(() => window.testView.players[3].character.used);
          assert.equal((await host.evaluate(() => window.testView)).turn, 0);
          await pages[4].locator('[data-act=personal]').click();
          await pages[4].locator('#scr-game .pblock.mine .tile.can').first().click();
          await pages[4].locator('[data-act=eqp][data-p="0"]').click();
          await host.waitForFunction(() => window.testView.pending?.type === 'walkie');
          await host.locator('#scr-game .pblock.mine .tile.can').last().click();
          await host.waitForFunction(() => !window.testView.pending && window.testView.players[4].character.used);
          // 再切换三维，确认新角色在三维也显示且可选择目标。
          for (const page of pages) await page.locator('#scr-game [data-act=view]').click();
          const initialViews = await Promise.all(pages.map(page => page.evaluate(() => window.testView)));
          const own = initialViews[0].players[0].stands.flat().filter(w => !w.cut && Number.isInteger(w.v));
          const candidates = initialViews.slice(1).flatMap((v, i) => v.players[i + 1].stands.flat().filter(w => !w.cut && own.some(o => o.v === w.v)));
          if (candidates.length) {
            const w = candidates[0];
            await host.locator('#scr-game .slot.can[data-w="' + w.id + '"]').click();
            await host.locator('.act [data-act=val][data-v="' + w.v + '"]').click();
            await host.waitForFunction(() => window.testView.pending?.type === 'cut'); await finishDecision();
          } else {
            await host.locator('[data-act=solo]').first().click();
          }
          await pages[1].waitForFunction(() => !window.testView.pending && window.testView.turn === 1);
          const p1 = await pages[1].evaluate(() => window.testView);
          const value = p1.players[1].stands.flat().find(w => !w.cut && Number.isInteger(w.v)).v;
          const rack = p1.players[0].stands[0].filter(w => !w.cut).slice(0, 3);
          await pages[1].locator('[data-act=personal]').click();
          for (const w of rack) await pages[1].locator('#scr-game .slot.can[data-w="' + w.id + '"]').click();
          await pages[1].locator('.act [data-act=val][data-v="' + value + '"]').click();
          await host.waitForFunction(() => window.testView.pending?.type === 'cut'); await finishDecision();
          assert((await host.evaluate(() => window.testView)).players[1].character.used);
          await pages[2].waitForFunction(() => !window.testView.pending && window.testView.turn === 2);
          const p2 = await pages[2].evaluate(() => window.testView);
          const values = [...new Set(p2.players[2].stands.flat().filter(w => !w.cut && Number.isInteger(w.v)).map(w => w.v))].slice(0, 2);
          assert.equal(values.length, 2);
          await pages[2].locator('[data-act=personal]').click();
          const target = p2.players[0].stands[0].find(w => !w.cut);
          await pages[2].locator('#scr-game .slot.can[data-w="' + target.id + '"]').click();
          for (const v of values) await pages[2].locator('.act [data-act=val][data-v="' + v + '"]').click();
          await pages[2].locator('[data-act=eqgo]').click();
          await host.waitForFunction(() => window.testView.pending?.type === 'cut'); await finishDecision();
          assert((await host.evaluate(() => window.testView)).players[2].character.used);
          console.log('✓ 第 33 关：四种个人能力实际界面操作，离回合使用与逐步回应');
        }
        if (mid === 25) {
          for (const page of pages) {
            assert(await page.locator('.communication-notice').innerText().then(t => t.includes('语音违规由玩家自行报告')));
            assert.equal(await page.locator('[data-act=communication-penalty]').count(), 1);
          }
          const before = await host.evaluate(() => window.testView);
          // 非行动玩家也能报告一次真实语音违规；不会跳回合。
          await pages[1].locator('[data-act=communication-penalty]').click();
          await host.waitForFunction(() => window.testView.det === 1);
          assert.equal((await host.evaluate(() => window.testView)).turnNo, before.turnNo);
          assert.equal((await host.evaluate(() => window.testView)).official.communicationPenalties, 1);
          // 二维／三维共用限制提醒，切换后仍可报告。
          await host.locator('#scr-game [data-act=view]').click();
          assert.equal(await host.locator('[data-act=communication-penalty]').count(), 1);
          await host.locator('#scr-game [data-act=view]').click();
        }
        // Finish one full 2-player mission with the actual UI choice stages.
        if (np === 2) {
          for (let turns = 0; turns < 70; turns++) {
            const current = await host.evaluate(() => window.testView);
            if (current.phase === 'won') break;
            assert.equal(current.phase, 'play');
            const pi = current.turn, actor = pages[pi];
            const views = await Promise.all(pages.map(p => p.evaluate(() => window.testView)));
            const own = views[pi].players[pi].stands.flat().filter(w => !w.cut);
            const other = views[1 - pi].players[1 - pi].stands.flat().filter(w => !w.cut);
            const values = [...new Set(own.map(w => Number.isInteger(w.v) ? w.v : w.v % 1 < .3 ? 'Y' : 'R'))].filter(v => v === 'R' || (mid !== 26 || views[pi].official.numbers.open.includes(v)) && require('../js/engine').actorValueAllowed(views[pi], pi, v));
            if (own.every(w => !Number.isInteger(w.v) && w.v % 1 > .3)) await actor.locator('#scr-game [data-act=red]').click();
            else {
              const solo = values.find(v => v !== 'R' && own.filter(w => w.v === v).length >= 2 && !other.some(w => w.v === v));
              if (solo != null) await actor.locator('#scr-game [data-act=solo][data-v="' + solo + '"]').click();
              else {
                const value = values.find(v => v !== 'R' && other.some(w => w.v === v)); assert(value != null);
                const target = other.find(w => w.v === value);
                await actor.locator('#scr-game .slot[data-w="' + target.id + '"]').click();
                await actor.locator('#scr-game .vbtn[data-v="' + value + '"]').click();
                if (mid === 25) {
                  await pages[1 - pi].locator('.target-declaration').waitFor();
                  assert((await pages[1 - pi].locator('.target-declaration').innerText()).includes('手势'));
                }
                await pages[1 - pi].locator('#scr-game [data-act=resolve-target]').click();
                await actor.waitForFunction(() => window.testView?.pending?.step === 'own');
                const copies = own.filter(w => w.v === value);
                await actor.locator('#scr-game .seat3.me .slot.can[data-w="' + copies.at(-1).id + '"]').click();
              }
            }
            await host.waitForFunction(t => window.testView.phase === 'won' || window.testView.turnNo > t, current.turnNo);
          }
          assert.equal((await host.evaluate(() => window.testView)).phase, 'won');
        }
        console.log('✓ 第 ' + mid + ' 关：' + np + ' 人联机、私有手牌、官方线索、手机 ' + (np >= 4 ? '二维' : '三维') + (np === 2 ? '、通过界面完整通关' : ''));
      } finally { for (const context of contexts) await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
