import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { generateRoomCode } from '../worker/src/protocol.js';

// End-to-end fan-out proof: real SyncRoom DO under miniflare, two simulated
// devices joining via WebSocket upgrade, exchanging turns and clipboard.

// Miniflare 4 stable flat options API (wrangler bundles its own miniflare 5
// alpha internally; the test harness pins the stable v4 release). modulesRules
// forces ES-module parsing for .js files (defaults treat them as CommonJS);
// option names verified against miniflare@4's own index.d.ts typings.
const mf = new Miniflare({
  scriptPath: 'worker/src/index.js',
  modules: true,
  modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
  compatibilityDate: '2026-06-01',
  durableObjects: { SYNC_ROOM: 'SyncRoom' },
  // The direct /join route is production-off (the Pages Function owns the
  // auth decision); the e2e suite is one of the two sanctioned opt-ins.
  bindings: { LINK_DIRECT_JOIN: '1' },
});

after(async () => {
  await mf.dispose();
});

async function connect(query) {
  const worker = await mf.getWorker();
  const res = await worker.fetch(`https://luminote.test/join${query}`, {
    headers: { Upgrade: 'websocket' },
  });
  if (res.status !== 101) {
    throw new Error(`expected 101 upgrade, got ${res.status}: ${await res.text()}`);
  }
  const ws = res.webSocket;
  ws.accept();
  return ws;
}

/** Complete the handshake: hello -> init (mirrors the browser client). */
async function connectDevice(query) {
  const ws = await connect(query);
  ws.send(JSON.stringify({ type: 'hello' }));
  return ws;
}

function waitFor(ws, type, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error(`timeout waiting for "${type}"`));
    }, timeoutMs);
    const handler = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
  });
}

describe('Link Mode end-to-end (SyncRoom DO)', () => {
  it('fans turns, interim, and clipboard out between two devices and snapshots for late joiners', async () => {
    const room = generateRoomCode();

    const desktop = await connectDevice(`?room=${room}&role=desktop`);
    const initDesktop = await waitFor(desktop, 'init');
    assert.equal(initDesktop.room, room);
    assert.deepEqual(initDesktop.snapshot, { text: '', clipboard: null });

    // Attach the desktop-side listener BEFORE connecting the phone: the join
    // broadcast fires inside the joining device's own fetch, so waiting on the
    // phone's init first would miss the event.
    const deviceJoinedP = waitFor(desktop, 'device_joined');
    const phone = await connectDevice(`?room=${room}&role=phone`);
    const initPhone = await waitFor(phone, 'init');
    assert.equal(initPhone.room, room);
    assert.ok(initPhone.devices.some((d) => d.role === 'desktop'));

    const joined = await deviceJoinedP;
    assert.equal(joined.device.role, 'phone');

    // Phone dictates a turn -> desktop receives it
    phone.send(JSON.stringify({ type: 'turn', text: 'hello from the phone' }));
    const turn = await waitFor(desktop, 'turn');
    assert.equal(turn.text, 'hello from the phone');
    assert.equal(turn.from, 'phone');

    // Interim previews reach the peer too
    phone.send(JSON.stringify({ type: 'interim', text: 'typing' }));
    const interim = await waitFor(desktop, 'interim');
    assert.equal(interim.text, 'typing');

    // Remote-voice level (drives the receiver's meter) relays like other
    // ephemeral frames and carries the sender's role.
    phone.send(JSON.stringify({ type: 'level', v: 0.42 }));
    const level = await waitFor(desktop, 'level');
    assert.equal(level.v, 0.42);
    assert.equal(level.from, 'phone');

    // Desktop pushes clipboard -> phone receives it
    desktop.send(JSON.stringify({ type: 'clipboard', text: 'clipboard payload' }));
    const clip = await waitFor(phone, 'clipboard');
    assert.equal(clip.text, 'clipboard payload');

    // A late joiner catches up from the snapshot: committed text + clipboard.
    // The live phone frees its slot first — a rejoining device now replaces
    // its role's slot, and this test does not need that collision.
    phone.close();
    await new Promise((r) => setTimeout(r, 100));
    const late = await connectDevice(`?room=${room}&role=phone`);
    const initLate = await waitFor(late, 'init');
    assert.equal(initLate.snapshot.text, 'hello from the phone');
    assert.equal(initLate.snapshot.clipboard.text, 'clipboard payload');

    // Invalid messages produce a server-side error event, not a crash
    late.send('not json');
    const err = await waitFor(late, 'error');
    assert.match(err.message, /invalid JSON/);

    desktop.close();
    late.close();
  });

  it('gives a rejoining device its role slot back so reload ghosts never fill the room', async () => {
    const room = generateRoomCode();
    const first = await connectDevice(`?room=${room}&role=phone`);
    await waitFor(first, 'init');
    const firstClosed = new Promise((resolve) => first.addEventListener('close', resolve, { once: true }));

    // Second device with the SAME role: the ghost slot from the first is
    // replaced instead of the room drifting toward "full" with dead sockets.
    const second = await connectDevice(`?room=${room}&role=phone`);
    const initSecond = await waitFor(second, 'init');
    await firstClosed;
    assert.equal(initSecond.devices.length, 1,
      'exactly one phone remains — the replaced ghost is filtered from the device list');
    assert.equal(initSecond.devices[0].role, 'phone');

    // The room still admits a desktop afterwards — no starvation.
    const desk = await connectDevice(`?room=${room}&role=desktop`);
    const initDesk = await waitFor(desk, 'init');
    assert.equal(initDesk.devices.filter((d) => d.role === 'phone').length, 1);
    assert.equal(initDesk.devices.filter((d) => d.role === 'desktop').length, 1);

    second.close();
    desk.close();
  });

  it('serves the direct /join route only when LINK_DIRECT_JOIN is opted in', async () => {
    // Production leaves the variable unset: the direct route would bypass
    // the Pages Function's auth decision entirely.
    const bare = new Miniflare({
      scriptPath: 'worker/src/index.js',
      modules: true,
      modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
      compatibilityDate: '2026-06-01',
      durableObjects: { SYNC_ROOM: 'SyncRoom' },
    });
    try {
      const worker = await bare.getWorker();
      const res = await worker.fetch('https://luminote.test/join?room=ABCDEF', {
        headers: { Upgrade: 'websocket' },
      });
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.match(body.error, /direct join is disabled/);
    } finally {
      await bare.dispose();
    }
  });

  it('answers application-level pings so client heartbeats keep the link alive', async () => {
    // The browser client sends {type:"ping"} every 25s to survive the
    // Cloudflare edge idle timeout; the DO must answer with pong (the
    // constructor additionally maps the literal "ping" via
    // setWebSocketAutoResponse without waking).
    const room = generateRoomCode();
    const desktop = await connectDevice(`?room=${room}&role=desktop`);
    desktop.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitFor(desktop, 'pong');
    assert.deepEqual(pong, { type: 'pong' });
    desktop.close();
  });

  it('rejects invalid room codes before any DO is created', async () => {
    const worker = await mf.getWorker();
    const res = await worker.fetch('https://luminote.test/join?room=BAD!!', {
      headers: { Upgrade: 'websocket' },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /invalid room code/);
  });

  it('rejects plain HTTP requests without an upgrade header', async () => {
    const worker = await mf.getWorker();
    const res = await worker.fetch('https://luminote.test/join?room=ABCDEF');
    assert.equal(res.status, 426);
  });
});
