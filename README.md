# 炸弹克星 · 网页联机版

根据合作推理桌游《炸弹克星》(Bomb Busters) 制作的非官方网页版，支持 2–5 人联机和 AI 队友。

现在使用**一个 66 关战役**：第 **1–8、13、15、17、18、21、23、24、25、26、29、31、33、38、39、41、43** 关已替换为核实过的实体规则，其余 **42 关**沿用原有改编规则。选关时会标注“已核实”或“改编规则”。这不是完整的官方 66 关复刻；来源和核实门槛见 [实体任务核实记录](docs/official-campaign.md)。已逐一查看官方 1–66 关卡面，逐关差异见 [66 关核对表](docs/mission-audit.md)，全部组件及音频来源见 [官方机制与资源索引](docs/official-mechanisms.md)（含后期内容剧透）。找到来源不表示已实现后期特殊机制；五个音频关仍需完整事件核对。新战役进度与旧版实体、自定义进度分开保存。

新建 Node 联机房间的全部 66 关均由服务器处理动作、保存牌局，并仅向每个玩家发送其可见手牌。旧版存档仍按原规则恢复；旧自定义房间和 Artifact 中继保留兼容。

新建牌局的普通双人拆线统一使用逐步流程：行动玩家选择目标并宣告数值 → 被选玩家确认命中或未命中（探测器有多个结果时自行选线）→ 命中后，行动玩家选择自己要剪的匹配线。相同数值有多根时可选任意一根，不会自动剪第一根。第13关另有一次选三根红线的冒险拆线，由被选玩家公开确认，再同时剪断。任务设置和特殊规则仍按“已核实／改编规则”区分；统一交互并不表示同号官方任务已经核实。新战役内容版本为 `16`，旧通关记录和旧存档保留在原版本。

## 和朋友一起玩

1. 大家打开**同一个公开网址**。
2. 一人输入代号，点“创建联机房间”，分享页面里的 4 位房间码。
3. 其他人输入代号和房间码加入。房主选择任务，2–5 人即可开始，也可以加 AI 补位。
4. 掉线后用同一个网址、同一个浏览器重新进入。保留浏览器本地数据，它包含座位的重连凭证。
5. 房主可在牌桌顶部点“暂停牌局／继续牌局”：暂停期间计时、AI 和玩家动作都会停止，未完成的拆线选择保留。点“退出牌局”并确认后，本局结束，所有人回到原房间大厅；其他玩家没有这两个管理按钮。
6. 在联机大厅点“观战”可退出玩家席位；点“加入游戏”可重新入座（最多 5 位玩家）。**仅可在大厅切换身份**。观战者不占玩家名额，房主观战时仍可管理房间。也可以在首页输入房间码，点“观战此房间”直接观看正在进行的牌局。
7. 观战时在“观战视角”选择一位玩家即可查看其手牌，或选择“公共视角”隐藏手牌；平面和 3D 牌桌均支持。观战者只能阅读队内通讯，不能发送消息或代替玩家行动。使用原浏览器重连会保留观战身份和所选视角。

## Ubuntu 后台服务与免费公网地址

若希望电脑关机后朋友仍能玩，使用已经加入的 **Cloudflare Pages + Worker + SQLite Durable Objects** 部署适配。无需自己的域名，在免费额度内可使用；逐步操作、额度、存档迁移范围及本地验证见 [Cloudflare 免费部署指南](docs/cloudflare-deployment.md)。

本仓库提供两个独立的 systemd 用户服务：游戏服务和免费 Cloudflare Quick Tunnel。它们不修改已有的其他 Cloudflare 隧道配置。

需先安装 Node.js 18+ 和 `cloudflared`，在仓库目录执行：

```bash
npm ci
PORT=8081 npm run service:install
loginctl enable-linger "$USER"
```

`enable-linger` 让服务在退出登录后继续运行，并在开机时启动；若系统要求管理员权限，用 `sudo loginctl enable-linger "$USER"`。本次环境已完成配置。游戏服务绑定 `127.0.0.1:8081`，快照保存在 `~/.local/state/bomb-busters/`，不会作为网页文件提供。

查看目前的公开网址（首次启动可能需要十几秒）：

```bash
cat ~/.local/state/bomb-busters/public-url
```

**可以关闭终端，但电脑/虚拟机必须保持开机、联网且不休眠。** Quick Tunnel 无需账号或域名，地址在隧道进程重新启动后会变化，没有永久地址或在线率保证。服务会在失败后自动重新启动；地址变化后，重新查看上面的文件并分享新地址。新的网址属于新的浏览器来源，因此旧网址下的座位凭证不会自动迁移。

[Cloudflare Quick Tunnel 说明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)。

常用操作：

```bash
systemctl --user status bomb-busters bomb-busters-tunnel
journalctl --user -u bomb-busters -u bomb-busters-tunnel -n 50 --no-pager
# 更新服务器代码后重启游戏服务；无需重启隧道，网址保持不变
systemctl --user restart bomb-busters
# 停止对外提供服务
systemctl --user stop bomb-busters-tunnel bomb-busters
# 恢复服务；隧道会生成新网址
systemctl --user start bomb-busters bomb-busters-tunnel
```

不要在后台服务已占用 8081 时，再执行 `PORT=8081 npm start`。如需另开开发实例，可用其他端口。

## 本地开发

```bash
git switch -c initial_test   # 仅在该分支还不存在时执行
npm ci
PORT=8082 npm start
```

打开 `http://localhost:8082`。`npm start` 默认端口为 8080；看到 `EADDRINUSE` 表示端口被另一进程占用，可换端口。开发实例默认可从局域网访问 `http://电脑IP:8082`。

Codex 设置在 `.codex/config.toml` 和 `.codex/agents/`；包含 executor、explorer、auditor、worker。Codex 仅在信任此项目时加载项目设置。

## GitHub Pages

GitHub Pages 不能运行 Node/WebSocket 服务器。当前网页也由 Node 补齐 HTML 文档外壳，所以直接发布仓库根目录不能提供可用的联机游戏。请使用上面的公开服务地址；若未来拆分为 Pages 静态前端，仍需另行部署游戏服务器。

## 验证

```bash
npm test                     # 规则、私有视图、存档与两个目录的 AI 模拟
npm run test:campaign        # 两个目录各 66 关 × 2–5 人 × 25 个固定种子
npm run test:multiplayer     # 独立服务器上的真实 WebSocket 多人测试
npm run test:audio           # 隔离真实进程重启，合成音频信号测试（非真实录音认证）
# 对已运行的公网服务测试（创建独立测试房间，任务确认返回大厅后关闭连接）
BB_TEST_URL=https://你的地址 npm run test:multiplayer
# 浏览器测试，需要 Chromium 和已运行的服务
BB_SMOKE_URL=http://127.0.0.1:8081/ node test/browser-smoke.js
# 观战浏览器测试：自动启动独立服务器、房间和浏览器配置
node test/spectator.browser.js
```

`test:campaign` 使用完整信息，寻找合法通关行动：验证所生成牌局可解，不能证明所有随机牌局或真人难度。AI 胜率也不等于关卡可解率。`test/sim.js` 出现拒绝动作或卡死时会返回失败。当前核实边界和测试结果见 [验证记录](docs/validation.md)。

## 主要文件

| 文件 | 作用 |
| --- | --- |
| `js/missions.js` | 统一战役和旧目录兼容；每关保留规则来源状态 |
| `js/engine.js` | 规则、私有视图与待决动作 |
| `js/app.js`、`js/table3d.js` | 页面流程和两种牌桌 |
| `js/bot.js` | AI 队友 |
| `server/server.js` | 网页、WebSocket 和健康检查 |
| `server/official.js` | 权威房间、重连凭证、快照和计时 |
| `scripts/` | Ubuntu 后台服务与免费隧道 |
| `test/` | 规则、模拟、联网和浏览器检查 |

服务器快照位置可用 `BB_DATA_DIR` 指定；未设置时为 `server/.official-data/`。旧 Artifact 自定义房间仍会广播手牌消息，请避免将其当作有信息隔离保证的联机方式。

喜欢的话，请支持实体版《炸弹克星》（Hisashi Hayashi 设计）。
