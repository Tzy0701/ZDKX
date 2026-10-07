# Cloudflare 免费部署：Pages + Worker

无需域名：游戏入口使用 Cloudflare 提供的 `https://项目名.pages.dev`，房间服务使用 Worker 和 SQLite Durable Objects。成功部署后，电脑关机也不影响云端房间。当前文件已实现部署适配；部署命令须由你的 Cloudflare 账户执行。

## 费用与额度

保持 **Workers Free** 方案。SQLite Durable Objects 可在免费方案使用；不要改成旧 KV-backed Durable Objects。免费服务有额度，上限不是无限容量。Workers 免费请求额度为每日 100,000；Durable Objects 的免费请求额度为每日 100,000、运行额度每日 13,000 GB-s、总存储 5 GB。超出免费上限会使相关操作失败。用量以控制台和官方当前定价为准。

- [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Pages 文件限制](https://developers.cloudflare.com/pages/platform/limits/)

此方案不依赖收费域名、R2、外部数据库或常驻电脑。云端采用 WebSocket 休眠及闹钟，不每 250 毫秒轮询。页面静态资源通过 `_routes.json` 排除在 Functions 路由之外，只有 `/ws`、`/healthz` 和 `/audio/*` 进入 Functions。离线练习仍可在浏览器运行。

## 第 1 步：登录

在 Ubuntu 仓库目录执行：

```bash
cd ~/ZZ/ZDKX
npm ci
npx wrangler@4.148.0 login --device --browser=false
```

把终端给出的新网址在浏览器打开，输入该次验证码并授权，保留终端直到显示登录成功。设备授权不需要浏览器访问 Ubuntu 的 `localhost:8976`。

```bash
npx wrangler@4.148.0 whoami
```

[设备授权官方说明](https://developers.cloudflare.com/changelog/post/2026-08-04-wrangler-login-device-flow/)

## 第 2 步：部署 Worker

```bash
npm run deploy:worker
```

命令使用 `cloudflare/worker/wrangler.toml`，建立 `bomb-busters-rooms` Worker 和 `GameRoom` 的 SQLite namespace。`new_sqlite_classes` 是首次部署的存储迁移。后续部署保留迁移记录，不重复改成新的类名。配置不启用任何付费服务。

到 Cloudflare → Workers & Pages 确认 Worker 已出现。Worker `/healthz` 应返回 `ok: true`；Worker 根路径不提供游戏界面，朋友要打开下一步的 Pages 地址。

## 第 3 步：建立 Pages 项目

```bash
npx wrangler@4.148.0 pages project create bomb-busters
```

生产分支选择你实际使用的分支，例如 `initial_test`。这是直接上传项目，不依赖 GitHub 自动构建。项目若已存在，可跳过建立步骤。如果名称不可用，选另一个名称，并把根目录 `wrangler.toml` 的 `name` 与 `package.json` 中 `deploy:pages` 的 `--project-name` 一起改成新名称。

## 第 4 步：部署 Pages

```bash
npm run deploy:pages
```

此命令先生成完整 HTML 和公开资源到 `dist/pages`，再上传 Pages Functions。根目录 `wrangler.toml` 已配置外部 Durable Object binding：变量 `ROOMS`、类 `GameRoom`、Worker `bomb-busters-rooms`，因此无需再次手工添加同名绑定。Worker 必须先部署成功。如果修改 Worker 名称，也要修改 Pages 的 `script_name`。

Wrangler 返回实际 `*.pages.dev` 地址，把**生产网址**分享给朋友。预览地址与生产地址属于不同浏览器来源，座位凭证不共享。Pages 项目存在期间，生产域名不会因电脑重启而改变。

[Pages 与外部 Durable Objects 绑定](https://developers.cloudflare.com/pages/functions/bindings/)、[Wrangler 发布 Pages Functions](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## 第 5 步：验证云端联机

1. 打开生产 Pages 网址，建立房间；另一台设备加入同一房间码。
2. 依次用 2、3、4、5 名玩家测试初始标记、猜线、被选玩家回答、行动者选自己的匹配线。
3. 检查队内通讯、观战视角、房主暂停／继续／退出，以及刷新后的原座位恢复。
4. 开一局带 AI 的游戏，确认 AI 能标记和行动。
5. 确认云端工作后，停止旧服务：

```bash
systemctl --user stop bomb-busters-tunnel bomb-busters
```

6. 电脑关机，让朋友继续在 Pages 网址操作。确认后可停用旧服务的自动启动：

```bash
systemctl --user disable bomb-busters-tunnel bomb-busters
```

**旧 Node 房间存档不会自动搬到 Cloudflare；旧地址的浏览器凭证也不会自动转到 Pages 地址。** 初次迁移请新建房间。云端房间保存游戏、座位凭证、命令回执和未完成决定；完全断开连接且闲置 7 天后会清理，故不是永久归档服务。开始新一局、退出到大厅和暂停的含义与现有游戏一致。

## 更新代码

服务器变更先运行 `npm run deploy:worker`，再运行 `npm run deploy:pages`。仅界面变更运行后者。部署不迁移游戏内容版本，也不使尚未核实的任务自动成为正版规则。涉及存档结构或规则变更时，先用测试环境验证正在进行的旧牌局。

## 本地验证

两个终端分别执行：

```bash
npm run dev:worker
```

```bash
npm run dev:pages
```

Pages 本地地址为 `http://localhost:8788`。终端应显示 `ROOMS ... local [connected]`。然后运行：

```bash
npm run test:cloudflare
BB_TEST_URL=http://127.0.0.1:8788 npm run test:multiplayer
npm run test:cloudflare:runtime
```

最后一个测试在独立临时目录启动 workerd 并反复重启，验证 SQLite、2–5 人的两阶段决定及凭证恢复。它不会部署到 Cloudflare，也不会使用旧 Node 存档。

## 音频范围

现有五个正式音频任务仍未完成时间轴核实，没有在云端开放。适配器只允许服务端登记且通过 SHA-256 的发行商资源；客户端不能指定任意下载网址。云端代理实际读取上限 32 MiB，音频不作为 Pages 静态文件上传（Pages 单文件上限 25 MiB）。未来启用录音前仍须验证时间轴、真机 Safari 播放、内存及免费额度，不应把当前部署测试视为音频任务验收。

## 排错

- **网页正常、房间无法连接：** 检查 Worker 已部署，Pages `ROOMS` 的 `script_name` 与 Worker 名称一致，然后重新部署 Pages。
- **`/ws` 返回 400：** 云端需要 `?room=bb-房间码`；当前前端已添加，旧缓存页面需要刷新。
- **`/ws` 返回 426：** 普通浏览器访问不是 WebSocket 升级，属于预期行为。
- **免费额度报错：** 查看 Workers 和 Durable Objects 用量；保持 Free 方案，等待额度重置或减少使用。
- **新网址无法恢复旧座位：** 凭证按网址保存；首次迁移新建房间，不会读取本机 Node 存档。

房间最多 5 个玩家席位，另可观战，最多 50 条同时连接；单条消息上限 64 KiB，每条连接 10 秒最多 60 条有效 JSON 消息，以控制异常流量。观战仍按原功能可切换玩家视角；不要把房间码分享给不希望看到手牌的人。

## 本次实现的验证记录（2026-10-08）

- Worker 无发布打包检查通过，约 550 KiB，使用 `ROOMS` SQLite Durable Object binding。
- 云端核心和实际适配器的模拟休眠测试通过：连接附件恢复身份、私人选择、超时闹钟、暂停、重复命令、闲置清理及跨房间拒绝。
- 真实 Pages + workerd 联机通过：2–5 人初始标记与拆线、重连、队内通讯、观战权限、暂停／继续／退出、AI 多标记和旧自定义中继。
- 真实 workerd + SQLite 的 2–5 人测试在目标回答／行动者选线两个阶段分别重启进程，通过凭证、未完成决定、私人选项及重复回应检查。
- Chromium 实际 Pages 页面通过：大厅、任务4、二维／三维卡牌、初始标记、手机布局、重连和发送／Enter 聊天。未在真实 Mac Safari 或 Cloudflare 生产账户执行验收。
- 完整 `npm test` 退出码 0；旧目录与战役目录各 528 局机器人模拟的 errors、stuck、等待均为 0。模拟不证明所有任务与正版完全一致。

随后已发布到 Cloudflare：游戏入口为 `https://bomb-busters-eyc.pages.dev/`，房间服务为 `bomb-busters-rooms` Worker。生产健康检查与真实 2–5 人联机、初始标记、拆线、重连、聊天、房主控制、AI 和自定义中继测试通过。测试牌局均已退出回到大厅；电脑关机后的朋友真机验收仍需按第 5 步完成。
