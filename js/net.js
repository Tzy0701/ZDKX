/* 炸弹克星 · 联机传输层
 * 统一接口：{ kind, emit(topic, data), on(topic, fn(msg)), onPeers(fn(peerIds)), leave() }
 * msg = { data, peer, mine }   mine = 本标签页自己发出的回声
 * 1) claude.ai Artifact 内：使用 room 能力（实时房间）
 * 2) 自建 Node 服务器（server/server.js）：使用 WebSocket
 */
(function () {
  var Net = {};

  function emitter() {
    var subs = {}, peerSubs = [];
    return {
      subs: subs, peerSubs: peerSubs,
      on: function (topic, fn) { (subs[topic] = subs[topic] || []).push(fn); },
      onPeers: function (fn) { peerSubs.push(fn); },
      fire: function (topic, msg) { (subs[topic] || []).forEach(function (f) { try { f(msg); } catch (e) { console.error(e); } }); },
      firePeers: function (ids) { peerSubs.forEach(function (f) { try { f(ids); } catch (e) { console.error(e); } }); }
    };
  }

  Net.TOPICS = ['hello', 'lobby', 'pub', 'hand', 'act', 'chat', 'err'];

  var roomCap = null;
  Net.probe = function () {
    if (roomCap) return roomCap;
    roomCap = new Promise(function (resolve) {
      if (window.claude && typeof window.claude.use === 'function') {
        window.claude.use('room').then(function (r) { resolve(r ? { kind: 'claude', room: r } : wsAvail()); }, function () { resolve(wsAvail()); });
      } else resolve(wsAvail());
    });
    return roomCap;
  };
  function wsAvail() {
    // 只有自带的 Node 服务器输出的页面才带这个标记
    return document.querySelector('meta[name="bb-server"]') ? { kind: 'ws' } : null;
  }

  Net.join = function (code) {
    return Net.probe().then(function (cap) {
      if (!cap) throw new Error('当前环境无法联机：请在 claude.ai 中打开本页面，或运行自带的 Node 服务器。');
      return cap.kind === 'claude' ? joinClaude(cap.room, code) : joinWs(code);
    });
  };

  function joinClaude(room, code) {
    return room.join('bb-' + code.toLowerCase()).then(function (r) {
      var E = emitter(), offs = [];
      Net.TOPICS.forEach(function (t) {
        offs.push(r.on(t, function (m) { E.fire(t, { data: m.data, peer: m.peer, mine: m.isMe && m.sameTab }); }));
      });
      offs.push(r.onPeers(function (ch) { E.firePeers(ch.peers.map(function (p) { return p.peer; })); }));
      return {
        kind: 'claude',
        emit: function (t, d) { return r.emit(t, d).catch(function (e) { console.warn('emit', t, e && e.code); throw e; }); },
        on: E.on, onPeers: E.onPeers,
        connected: function () { return r.connected(); },
        leave: function () { offs.forEach(function (f) { try { f(); } catch (e) {} }); return r.leave(); }
      };
    });
  }

  function joinWs(code) {
    return new Promise(function (resolve, reject) {
      var url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      var E = emitter(), ws, me = null, closed = false, queue = [], ready = false, opened = false;
      function open() {
        ws = new WebSocket(url);
        ws.onopen = function () {
          ws.send(JSON.stringify({ t: 'join', room: 'bb-' + code.toLowerCase() }));
        };
        ws.onmessage = function (ev) {
          var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.t === 'welcome') {
            me = m.me; ready = true;
            queue.splice(0).forEach(function (s) { ws.send(s); });
            if (!opened) { opened = true; resolve(api); }
          } else if (m.t === 'peers') E.firePeers(m.peers);
          else if (m.t === 'msg') E.fire(m.topic, { data: m.data, peer: m.peer, mine: m.peer === me });
        };
        ws.onclose = function () {
          ready = false;
          if (!opened) { reject(new Error('连接服务器失败')); return; }
          if (!closed) setTimeout(open, 1500);
        };
      }
      var api = {
        kind: 'ws',
        emit: function (t, d) {
          var s = JSON.stringify({ t: 'emit', topic: t, data: d });
          if (ready) ws.send(s); else queue.push(s);
          return Promise.resolve();
        },
        on: E.on, onPeers: E.onPeers,
        connected: function () { return ready; },
        leave: function () { closed = true; try { ws.close(); } catch (e) {} return Promise.resolve(); }
      };
      open();
    });
  }

  window.BBNet = Net;
})();
