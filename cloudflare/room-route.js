// Pages 和 Worker 使用相同路由；房间编号必须在 WebSocket 升级之前确定。
export function roomName(url) {
  const room = url.searchParams.get('room');
  return typeof room === 'string' && /^bb-[a-z0-9_.-]{1,45}$/.test(room) ? room : null;
}

export function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/healthz') return Response.json({ ok: true, hosting: 'cloudflare' });
  if (url.pathname !== '/ws' && !/^\/audio\/[a-f0-9]{64}\.mp3$/.test(url.pathname))
    return new Response('not found', { status: 404 });
  const room = roomName(url);
  if (!room) return new Response('缺少或无效的房间编号', { status: 400 });
  if (url.pathname === '/ws' && (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'))
    return new Response('需要 WebSocket 连接', { status: 426 });
  return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
}
