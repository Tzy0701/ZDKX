import { route } from '../cloudflare/room-route.js';
export function onRequest(context) { return route(context.request, context.env); }
