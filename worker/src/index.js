/**
 * LumiNote Link Mode — SyncRoom Durable Object.
 *
 * One DO instance per room code (created via idFromName). Coordinates a small
 * number of paired devices (desktop + phone): broadcasts transcript turns,
 * live interim previews, and clipboard pushes between them, and keeps a tiny
 * SQLite snapshot so devices joining late catch up.
 *
 * Uses the Hibernation WebSocket API so an idle room is not billed for
 * duration while clients stay connected.
 * Sources:
 * - https://developers.cloudflare.com/durable-objects/best-practices/websockets/
 * - https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
 */

import {
  validateClientMessage,
  serverEvent,
  parseRole,
  sanitizeRoomCode,
  isValidRoomCode,
} from './protocol.js';

const ROOM_TTL_MS = 12 * 60 * 60 * 1000; // sliding expiry of an inactive room
const MAX_DEVICES = 4;

export class SyncRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Keepalive at the runtime layer: "ping" in → "pong" out without waking the DO.
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  async fetch(request) {
    // Path routing is the caller's job (Pages Function or the worker router
    // both validate /join paths before proxying); the DO only cares about
    // the upgrade itself.
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'expected WebSocket upgrade' }, 426);
    }
    if (this.state.getWebSockets().length >= MAX_DEVICES) {
      return jsonResponse({ error: 'room is full' }, 429);
    }

    const url = new URL(request.url);
    const role = parseRole(url.searchParams.get('role'));
    const device = { role, joinedAt: Date.now() };

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment(device);

    // Do NOT send anything here: fetch-time sends are queued until the
    // client's first outbound message in production. The client sends
    // {type:"hello"} on open, which triggers the init + join broadcast
    // deterministically from webSocketMessage.

    await this.touchTtl();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const result = validateClientMessage(message);
    if (!result.ok) {
      ws.send(serverEvent('error', { message: result.error }));
      return;
    }
    let msg = result.message;
    const device = ws.deserializeAttachment() || { role: 'unknown' };

    // Handshake: first hello receives the room state and announces the
    // device to the others. Repeated hellos re-send state but do not
    // re-broadcast the join.
    if (msg.type === 'hello') {
      const snapshot = (await this.state.storage.get('snapshot')) || {
        text: '',
        clipboard: null,
      };
      ws.send(
        serverEvent('init', {
          room: this.state.id.name || '',
          devices: await this.listDevices(),
          snapshot,
        })
      );
      if (!device.announced) {
        device.announced = true;
        ws.serializeAttachment(device);
        this.broadcastExcept(ws, serverEvent('device_joined', { device }));
      }
      return;
    }

    if (msg.type === 'ping') {
      ws.send(serverEvent('pong'));
      return;
    }

    // Committed turns and clipboard pushes update the late-joiner snapshot.
    if (msg.type === 'turn') {
      const snapshot = (await this.state.storage.get('snapshot')) || {
        text: '',
        clipboard: null,
      };
      snapshot.text = snapshot.text
        ? `${snapshot.text} ${msg.text}`
        : msg.text;
      await this.state.storage.put('snapshot', snapshot);
    } else if (msg.type === 'clipboard') {
      const snapshot = (await this.state.storage.get('snapshot')) || {
        text: '',
        clipboard: null,
      };
      snapshot.clipboard = { text: msg.text, at: Date.now() };
      await this.state.storage.put('snapshot', snapshot);
    }

    this.broadcastExcept(
      ws,
      serverEvent(msg.type, { text: msg.text, from: device.role })
    );
    await this.touchTtl();
  }

  async webSocketClose(ws) {
    // With web_socket_auto_reply_to_close (compat date >= 2026-04-07) the
    // runtime replies to the Close frame; no manual ws.close() needed.
    const device = ws.deserializeAttachment() || { role: 'unknown' };
    this.broadcastExcept(ws, serverEvent('device_left', { device }));
  }

  async webSocketError() {
    // Socket is dead; the runtime cleans it up. Nothing to fan out.
  }

  async alarm() {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.close(1000, 'room expired');
      } catch {
        // already gone
      }
    }
    await this.state.storage.deleteAll();
    await this.state.storage.deleteAlarm();
  }

  async listDevices() {
    return this.state.getWebSockets().map((ws) => {
      const att = ws.deserializeAttachment();
      return { role: att?.role || 'unknown', joinedAt: att?.joinedAt || null };
    });
  }

  broadcastExcept(sender, data) {
    for (const ws of this.state.getWebSockets()) {
      if (ws === sender) continue;
      try {
        ws.send(data);
      } catch {
        // a closed socket must not break the fan-out loop
      }
    }
  }

  /**
   * Sliding TTL: extend the expiry on activity. Extensions are limited to at
   * most one write per TTL/2 so frequent messages stay cheap; the room
   * therefore survives 12-18h past the last activity, then the alarm reaps it.
   */
  async touchTtl() {
    const current = await this.state.storage.getAlarm();
    const now = Date.now();
    if (!current || current < now + ROOM_TTL_MS / 2) {
      await this.state.storage.setAlarm(now + ROOM_TTL_MS);
    }
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Direct /join router, mirroring the Pages Function validation. Lets the
 * worker run standalone (`wrangler dev`, `npm run dev:sync`) and enables
 * end-to-end testing without a Pages deployment in front.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/join') {
      return jsonResponse({ error: 'not found' }, 404);
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'expected WebSocket upgrade' }, 426);
    }
    const room = sanitizeRoomCode(url.searchParams.get('room') || '');
    if (!isValidRoomCode(room)) {
      return jsonResponse({ error: 'invalid room code' }, 400);
    }
    const id = env.SYNC_ROOM.idFromName(room);
    const stub = env.SYNC_ROOM.get(id);
    return stub.fetch(request);
  },
};
