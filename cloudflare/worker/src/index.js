import { DurableObject } from 'cloudflare:workers';
import officialCore from '../../../server/official-core.js';
import { route, roomName } from '../../room-route.js';

const ROOM_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE = 64 * 1024;
const MAX_CONNECTIONS = 50;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');

export default { fetch: route };

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.clients = new Map();
    this.output = [];
    this.jobs = new Map();
    this.nextJob = 1;
    this.dirty = false;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.record = await ctx.storage.get('room') || { version: 1, name: null, snapshot: null, custom: false, expires: null, botDue: null };
      if (this.record.version !== 1) throw new Error('不支持的云端存档版本');
      for (const ws of ctx.getWebSockets()) this.attach(ws);
      let restoredDue = this.record.botDue;
      const owner = this;
      this.service = officialCore({ get clients() { return Array.from(ctx.getWebSockets()).map(ws => owner.attach(ws)); } }, {
        restart: false, token,
        store: {
          names: () => this.record.snapshot ? [this.record.name] : [],
          read: name => name === this.record.name ? this.record.snapshot : null,
          write: (name, snapshot) => { this.record.name = name; this.record.snapshot = snapshot; this.dirty = true; }
        },
        setTimeout: (fn, delay) => {
          const id = this.nextJob++;
          this.jobs.set(id, { fn, due: restoredDue ?? Date.now() + delay });
          restoredDue = null;
          return id;
        },
        clearTimeout: id => this.jobs.delete(id)
      });
    });
  }

  attach(ws) {
    if (this.clients.has(ws)) return this.clients.get(ws);
    const data = ws.deserializeAttachment() || {};
    const owner = this;
    const client = {
      ...data,
      get readyState() { return ws.readyState; },
      send(raw) { owner.output.push({ ws, raw }); }
    };
    this.clients.set(ws, client);
    return client;
  }

  broadcast(packet) {
    const raw = JSON.stringify(packet);
    for (const ws of this.ctx.getWebSockets()) if (this.attach(ws).room) this.attach(ws).send(raw);
  }

  peers() {
    return this.ctx.getWebSockets().map(ws => this.attach(ws)).filter(c => c.room && c.readyState === 1).map(c => c.peer);
  }

  async commit() {
    const now = Date.now();
    const botDue = Math.min(...Array.from(this.jobs.values(), j => j.due));
    const nextBot = Number.isFinite(botDue) ? botDue : null;
    if (this.record.botDue !== nextBot) { this.record.botDue = nextBot; this.dirty = true; }
    for (const [ws, c] of this.clients) if (ws.readyState === 1) {
      ws.serializeAttachment({ peer: c.peer, room: c.room, pid: c.pid, officialCredential: c.officialCredential,
        windowAt: c.windowAt, count: c.count });
    }
    const connected = this.ctx.getWebSockets().some(ws => ws.readyState === 1);
    const next = Math.min(botDue, this.service.nextWake(), connected ? Infinity : this.record.expires ?? Infinity);
    // SQLite 事务同时提交牌局和闹钟，避免重启后有状态却没有计时唤醒。
    await this.ctx.storage.transaction(async () => {
      if (this.dirty) await this.ctx.storage.put('room', this.record);
      const alarm = await this.ctx.storage.getAlarm();
      if (Number.isFinite(next)) {
        const due = Math.max(now + 1, next);
        if (alarm !== due) await this.ctx.storage.setAlarm(due);
      } else if (alarm !== null) await this.ctx.storage.deleteAlarm();
    });
    this.dirty = false;
    // 先持久化，后发送成功结果。事件由 blockConcurrencyWhile 串行处理。
    for (const { ws, raw } of this.output.splice(0)) if (ws.readyState === 1) {
      try { ws.send(raw); } catch (_) { /* 断开后由 close 事件处理 */ }
    }
  }

  touch() {
    const expires = Date.now() + ROOM_TTL;
    if (!this.record.expires || expires - this.record.expires > 60000) { this.record.expires = expires; this.dirty = true; }
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url), name = roomName(url);
    if (!name || this.record.name && this.record.name !== name) return new Response('无效的房间', { status: 400 });
    if (url.pathname.startsWith('/audio/')) return this.audio(request, url);
    return this.ctx.blockConcurrencyWhile(async () => {
      if (this.ctx.getWebSockets().filter(ws => ws.readyState === 1).length >= MAX_CONNECTIONS) return new Response('房间连接已满', { status: 429 });
      this.record.name = name;
      this.touch();
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ peer: 'p' + token().slice(0, 18), room: null, pid: null, officialCredential: null });
      this.attach(server);
      await this.commit();
      return new Response(null, { status: 101, webSocket: client });
    });
  }

  async webSocketMessage(ws, raw) {
    await this.ready;
    return this.ctx.blockConcurrencyWhile(async () => {
      if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE) { ws.close(1009, '消息过大'); return; }
      let m;
      try { m = JSON.parse(raw); } catch (_) { return; }
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      const c = this.attach(ws), now = Date.now();
      if (!c.windowAt || now - c.windowAt >= 10000) { c.windowAt = now; c.count = 0; }
      if (++c.count > 60) { ws.close(1008, '消息发送过快'); return; }
      this.service.tick();
      if (m.t === 'join') {
        if (m.room !== this.record.name) { ws.close(1008, '连接的房间编号不匹配'); await this.commit(); return; }
        if (c.room) this.service.disconnect(c);
        c.room = m.room;
        c.send(JSON.stringify({ t: 'welcome', me: c.peer }));
        this.broadcast({ t: 'peers', peers: this.peers() });
      } else if (m.t === 'emit' && c.room && typeof m.topic === 'string') {
        if (m.topic.startsWith('official:') && this.record.custom) { await this.commit(); return; }
        if (!this.service.handle(c, m.topic, m.data) && !m.topic.startsWith('official:')) {
          if (m.topic === 'lobby' || m.topic === 'pub') { this.record.custom = true; this.dirty = true; }
          if (m.topic === 'hello' && typeof m.data?.pid === 'string') c.pid = m.data.pid;
          const packet = { t: 'msg', topic: m.topic, data: m.data, peer: c.peer };
          if (['hand', 'err'].includes(m.topic) && typeof m.data?.to === 'string') {
            for (const client of this.clients.values()) if (client.room && client.pid === m.data.to) client.send(JSON.stringify(packet));
          } else this.broadcast(packet);
        }
      }
      this.touch();
      await this.commit();
    });
  }

  async webSocketClose(ws, code, reason) {
    await this.ready;
    return this.ctx.blockConcurrencyWhile(async () => {
      const c = this.attach(ws);
      this.service.disconnect(c);
      c.room = null; c.pid = null; c.officialCredential = null;
      this.clients.delete(ws);
      try { ws.close(code, reason); } catch (_) {}
      this.broadcast({ t: 'peers', peers: this.peers() });
      // 旧自定义中继不承诺云端存档；最后一条连接断开后可创建新房间。
      if (!this.peers().length && this.record.custom) { this.record.custom = false; this.dirty = true; }
      this.record.expires = Date.now() + ROOM_TTL; this.dirty = true;
      await this.commit();
    });
  }

  webSocketError(ws) { return this.webSocketClose(ws, 1011, '连接错误'); }

  async alarm() {
    await this.ready;
    return this.ctx.blockConcurrencyWhile(async () => {
      if (!this.ctx.getWebSockets().some(ws => ws.readyState === 1) && this.record.expires && this.record.expires <= Date.now()) {
        this.jobs.clear(); this.output = [];
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.record = { version: 1, name: null, snapshot: null, custom: false, expires: null, botDue: null };
        this.service.reset();
        return;
      }
      this.service.tick();
      for (const [id, job] of [...this.jobs]) if (job.due <= Date.now()) {
        this.jobs.delete(id); job.fn();
      }
      await this.commit();
    });
  }

  async audio(request, url) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('method not allowed', { status: 405 });
    const hash = url.pathname.slice(7, -4), asset = this.service.audioAsset(hash);
    if (!asset) return new Response('录音尚未登记', { status: 404 });
    let source = new URL(asset.url), response;
    for (let i = 0; i < 5; i++) {
      if (source.protocol !== 'https:' || !['cdn.pegasus.de', 'www.cocktailgames.com', 'cocktailgames.com'].includes(source.hostname))
        return new Response('录音来源无效', { status: 502 });
      response = await fetch(source, { redirect: 'manual' });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (!response.headers.get('location')) return new Response('录音重定向无效', { status: 502 });
      source = new URL(response.headers.get('location'), source);
      await response.body?.cancel();
    }
    if (!response?.ok) return new Response('无法取得录音', { status: 502 });
    // 限制实际流读取，避免没有 Content-Length 的响应耗尽 Worker 内存。
    const reader = response.body.getReader(), chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32 * 1024 * 1024) { await reader.cancel(); return new Response('录音超过云端限制', { status: 502 }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== hash) return new Response('录音校验失败', { status: 502 });
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(size), 'Cache-Control': 'private, max-age=3600' } });
  }
}
