const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
let webpush = null;
try {
  webpush = require("web-push");
} catch {
  webpush = null;
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createStableVapidKeys() {
  const seed = process.env.VAPID_SEED ||
    process.env.VERCEL_PROJECT_ID ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "jesters-grid-default-vapid-seed";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const privateKey = crypto.createHash("sha256").update(`${seed}:${attempt}`).digest();
      const ecdh = crypto.createECDH("prime256v1");
      ecdh.setPrivateKey(privateKey);
      return {
        publicKey: base64Url(ecdh.getPublicKey(null, "uncompressed")),
        privateKey: base64Url(ecdh.getPrivateKey())
      };
    } catch {
      // Try the next hash if the curve rejects this private key.
    }
  }
  return webpush.generateVAPIDKeys();
}

const PORT = process.env.PORT || 3000;
const GENERATED_VAPID_KEYS = webpush && (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
  ? createStableVapidKeys()
  : null;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || GENERATED_VAPID_KEYS?.publicKey || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || GENERATED_VAPID_KEYS?.privateKey || "";
const VAPID_CONTACT = process.env.VAPID_CONTACT || "mailto:notifications@jesters-grid.app";
const PUSH_READY = !!(webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
const REDIS_REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ROOM_TABLE = process.env.SUPABASE_ROOM_TABLE || "jesters_grid_rooms";
const SUPABASE_ROOM_STORE = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const REDIS_ROOM_STORE = !!(REDIS_REST_URL && REDIS_REST_TOKEN);
const DURABLE_ROOM_STORE = SUPABASE_ROOM_STORE || REDIS_ROOM_STORE;
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const PLAYER_PRESENCE_TTL_MS = 22_000;
const ROOM_MUTATION_RETRIES = 6;
if (PUSH_READY) {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
const CARD_NAMES = {
  1: "Squire",
  2: "Page",
  3: "Shield",
  4: "Archer",
  5: "Crossbow",
  6: "Witch",
  7: "Knight",
  8: "Guard",
  9: "Rogue",
  10: "Banner",
  11: "Champion",
  12: "Giant",
  13: "King",
  14: "Jester"
};
const TOKEN_TYPES = [
  { id: "bard", count: 2 },
  { id: "ammo", count: 2 },
  { id: "pierce", count: 2 },
  { id: "potion", count: 2 },
  { id: "parry", count: 1 }
];
const VISUAL_RANKS = ["Unranked", "Masked Challenger"];
const BOT_NAME = "Clockwork Jester";
const BOT_RANK = "Gilded Automaton";
const WIN_LINES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15],
  [3, 6, 9, 12]
];

const rooms = new Map();
const clients = new Map();
const server = http.createServer(handleHttpRequest);

server.on("upgrade", handleUpgrade);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const empty = room.players.every((player, index) => !player.connected || index === room.botSeat);
    if (empty && now - room.createdAt > 1000 * 60 * 60 * 6) void removeRoom(code);
  }
}, 1000 * 60 * 15).unref();

server.listen(PORT, () => {
  console.log(`Jester's Grid listening on http://localhost:${PORT}`);
});

function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    sendJsonResponse(res, { ok: true });
    return;
  }

  if (url.pathname === "/healthz") {
    sendJsonResponse(res, {
      ok: true,
      rooms: rooms.size,
      clients: clients.size,
      roomStore: SUPABASE_ROOM_STORE ? "supabase" : REDIS_ROOM_STORE ? "redis" : "memory",
      durableRooms: DURABLE_ROOM_STORE,
      push: PUSH_READY
    });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    serveAsset(res, url.pathname);
    return;
  }

  const files = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/client.js": ["client.js", "text/javascript; charset=utf-8"],
    "/styles.css": ["styles.css", "text/css; charset=utf-8"],
    "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json; charset=utf-8"],
    "/service-worker.js": ["service-worker.js", "text/javascript; charset=utf-8"],
    "/icon.svg": ["icon.svg", "image/svg+xml; charset=utf-8"]
  };
  const match = files[url.pathname] || files["/"];
  serveFile(res, path.join(__dirname, match[0]), match[1]);
}

function serveAsset(res, pathname) {
  const relative = pathname.replace(/^\/assets\//, "");
  const normalized = path.normalize(relative);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    sendJsonResponse(res, fail("Asset not found."), 404);
    return;
  }
  const ext = path.extname(normalized).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml; charset=utf-8"
  };
  const contentType = contentTypes[ext];
  if (!contentType) {
    sendJsonResponse(res, fail("Asset not found."), 404);
    return;
  }
  serveFile(res, path.join(__dirname, "assets", normalized), contentType);
}

async function handleApiRequest(req, res, url) {
  try {
    if (url.pathname === "/api/state" && req.method === "GET") {
      const room = await loadRoom(url.searchParams.get("code"));
      if (!room) {
        sendJsonResponse(res, fail("Room not found."));
        return;
      }
      const seat = resolveSeat(room, url.searchParams.get("clientId"), url.searchParams.get("seat"));
      sendJsonResponse(res, { ok: true, snapshot: snapshotFor(room, seat) });
      return;
    }

    if (url.pathname === "/api/push-public-key" && req.method === "GET") {
      if (!PUSH_READY) {
        sendJsonResponse(res, fail("Push notifications are not configured on this server."));
        return;
      }
      sendJsonResponse(res, { ok: true, publicKey: VAPID_PUBLIC_KEY });
      return;
    }

    if (req.method !== "POST") {
      sendJsonResponse(res, fail("Unsupported method."), 405);
      return;
    }

    const body = await readJsonBody(req);
    if (url.pathname === "/api/create-room") {
      const clientId = cleanClientId(body.clientId);
      const room = await createPersistedRoom((code) => createRoomState(code, cleanName(body.name, "Player 1"), clientId, cleanName(body.rank, "Unranked")));
      const code = room.code;
      sendJsonResponse(res, { ok: true, code, seat: 0, snapshot: snapshotFor(room, 0) });
      return;
    }

    if (url.pathname === "/api/create-bot-room") {
      const clientId = cleanClientId(body.clientId);
      const room = await createPersistedRoom((code) => createBotRoomState(code, cleanName(body.name, "Player 1"), clientId));
      const code = room.code;
      sendJsonResponse(res, { ok: true, code, seat: 0, snapshot: snapshotFor(room, 0) });
      return;
    }

    if (url.pathname === "/api/join-room") {
      const stableClientId = cleanClientId(body.clientId);
      const mutation = await mutateRoom(body.code, (room) => {
        const wasDisconnected = room.players.some((player) => player.clientId === stableClientId && !isSeatConnected(room, room.players.indexOf(player)));
        const wasPlayerTwoConnected = isSeatConnected(room, 1);
        const seat = claimSeat(room, stableClientId, body.name, body.seat, body.rank);
        if (seat === null) return { result: fail("Room is full."), seat: null, skipSave: true };
        return {
          result: ok(),
          seat,
          shouldNotify: seat === 1 && !wasPlayerTwoConnected,
          shouldEmit: !body.heartbeat || wasDisconnected
        };
      });
      if (!mutation.room) {
        sendJsonResponse(res, fail("Room not found."));
        return;
      }
      if (!mutation.value?.result?.ok) {
        sendJsonResponse(res, mutation.value?.result || fail("Could not join room."));
        return;
      }
      const room = mutation.room;
      const seat = mutation.value.seat;
      if (mutation.value.shouldNotify) notifyPlayerJoined(room, 0, seat);
      if (mutation.value.shouldEmit) emitRoom(room);
      sendJsonResponse(res, { ok: true, code: room.code, seat, snapshot: snapshotFor(room, seat) });
      return;
    }

    if (url.pathname === "/api/register-room-notification") {
      if (!PUSH_READY) {
        sendJsonResponse(res, fail("Push notifications are not configured on this server."));
        return;
      }
      const mutation = await mutateRoom(body.code, (room) => {
        const seat = resolveSeat(room, body.clientId, body.seat);
        touchSeatConnection(room, seat);
        if (seat !== 0 && seat !== 1) return { result: fail("Join a room first."), seat, skipSave: true };
        if (!isValidPushSubscription(body.subscription)) return { result: fail("Invalid notification subscription."), seat, skipSave: true };
        room.pushSubscriptions[seat] = body.subscription;
        room.notificationOptInAt[seat] = Date.now();
        return { result: ok("Notifications enabled."), seat };
      });
      if (!mutation.room) {
        sendJsonResponse(res, fail("Room not found."));
        return;
      }
      sendJsonResponse(res, mutation.value?.result || fail("Could not enable notifications."));
      return;
    }

    if (url.pathname === "/api/leave-room") {
      const mutation = await mutateRoom(body.code, (room) => {
        const seat = resolveSeat(room, body.clientId, body.seat);
        releaseSeat(room, seat);
        return { result: ok(), seat };
      });
      if (!mutation.room) {
        sendJsonResponse(res, ok());
        return;
      }
      emitRoom(mutation.room);
      await deleteRoomIfEmpty(mutation.room);
      sendJsonResponse(res, ok());
      return;
    }

    if (url.pathname === "/api/action") {
      const mutation = await mutateRoom(body.code, (room) => {
        const seat = resolveSeat(room, body.clientId, body.seat);
        touchSeatConnection(room, seat);
        const action = body.action || {};
        const existing = findProcessedAction(room, seat, action.actionId);
        if (existing) return { result: existing.result, seat, duplicate: true, skipSave: true };
        const result = performAction(room, seat, action);
        if (result.ok) {
          rememberProcessedAction(room, seat, action.actionId, result);
          advanceBotIfNeeded(room);
        }
        return { result, seat };
      });
      if (!mutation.room) {
        sendJsonResponse(res, fail("Join a room first."));
        return;
      }
      const { result, seat, duplicate } = mutation.value;
      if (result.ok && !duplicate) emitRoom(mutation.room);
      sendJsonResponse(res, { ...result, snapshot: snapshotFor(mutation.room, seat) });
      return;
    }

    sendJsonResponse(res, fail("Unknown API route."), 404);
  } catch (error) {
    sendJsonResponse(res, fail(error.message || "API error."), 500);
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJsonResponse(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": contentType,
      "content-length": content.length,
      "cache-control": "no-store"
    });
    res.end(content);
  });
}

async function redisCommand(command) {
  if (!REDIS_ROOM_STORE) return null;
  const response = await fetch(REDIS_REST_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${REDIS_REST_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error("Room store unavailable.");
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

function roomStateForStorage(room) {
  const state = structuredClone(room);
  delete state._revision;
  return state;
}

async function supabaseRequest(pathname, options = {}) {
  if (!SUPABASE_ROOM_STORE) return null;
  const authHeaders = SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")
    ? { apikey: SUPABASE_SERVICE_ROLE_KEY }
    : { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Supabase room store unavailable.");
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function hydrateStoredRoom(row) {
  if (!row?.state || !row.code) return null;
  const room = row.state;
  room.code = normalizeRoomCode(row.code);
  room._revision = Number(row.revision || 1);
  rooms.set(room.code, room);
  return room;
}

async function loadRoom(code) {
  const normalizedCode = normalizeRoomCode(code);
  if (!normalizedCode) return null;
  if (SUPABASE_ROOM_STORE) {
    const params = new URLSearchParams({
      code: `eq.${normalizedCode}`,
      expires_at: `gt.${new Date().toISOString()}`,
      select: "code,state,revision",
      limit: "1"
    });
    const rows = await supabaseRequest(`${SUPABASE_ROOM_TABLE}?${params.toString()}`);
    return hydrateStoredRoom(rows?.[0]);
  }
  if (REDIS_ROOM_STORE) {
    const raw = await redisCommand(["GET", `room:${normalizedCode}`]);
    if (!raw) return null;
    const room = JSON.parse(raw);
    room._revision = Number(room._revision || 1);
    rooms.set(normalizedCode, room);
    return room;
  }
  return rooms.get(normalizedCode) || null;
}

async function createRoomRecord(room) {
  if (!room?.code) return null;
  room.code = normalizeRoomCode(room.code);
  if (SUPABASE_ROOM_STORE) {
    const rows = await supabaseRequest(SUPABASE_ROOM_TABLE, {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: {
        code: room.code,
        state: roomStateForStorage(room),
        revision: 1,
        expires_at: new Date(Date.now() + ROOM_TTL_MS).toISOString()
      }
    });
    return hydrateStoredRoom(rows?.[0]);
  }
  room._revision = Number(room._revision || 1);
  rooms.set(room.code, room);
  if (REDIS_ROOM_STORE) {
    await redisCommand(["SET", `room:${room.code}`, JSON.stringify(room), "EX", String(ROOM_TTL_MS / 1000)]);
  }
  return room;
}

async function saveRoom(room, expectedRevision = null) {
  if (!room?.code) return null;
  room.code = normalizeRoomCode(room.code);
  if (SUPABASE_ROOM_STORE) {
    const revision = Number(expectedRevision ?? room._revision ?? 1);
    const params = new URLSearchParams({
      code: `eq.${room.code}`,
      revision: `eq.${revision}`,
      select: "code,state,revision"
    });
    const rows = await supabaseRequest(`${SUPABASE_ROOM_TABLE}?${params.toString()}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: {
        state: roomStateForStorage(room),
        revision: revision + 1,
        expires_at: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
        updated_at: new Date().toISOString()
      }
    });
    return hydrateStoredRoom(rows?.[0]);
  }
  room._revision = Number(room._revision || 1) + 1;
  rooms.set(room.code, room);
  if (REDIS_ROOM_STORE) {
    await redisCommand(["SET", `room:${room.code}`, JSON.stringify(room), "EX", String(ROOM_TTL_MS / 1000)]);
  }
  return room;
}

async function removeRoom(code) {
  const normalizedCode = normalizeRoomCode(code);
  if (!normalizedCode) return;
  rooms.delete(normalizedCode);
  if (SUPABASE_ROOM_STORE) {
    const params = new URLSearchParams({ code: `eq.${normalizedCode}` });
    await supabaseRequest(`${SUPABASE_ROOM_TABLE}?${params.toString()}`, { method: "DELETE" });
  } else if (REDIS_ROOM_STORE) {
    await redisCommand(["DEL", `room:${normalizedCode}`]);
  }
}

async function mutateRoom(code, mutator, maxAttempts = ROOM_MUTATION_RETRIES) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const source = await loadRoom(code);
    if (!source) return { room: null, value: null };
    const expectedRevision = Number(source._revision || 1);
    const draft = structuredClone(source);
    const value = await mutator(draft);
    if (value?.skipSave) return { room: source, value };
    const saved = await saveRoom(draft, expectedRevision);
    if (saved) return { room: saved, value };
    await new Promise((resolve) => setTimeout(resolve, 18 + attempt * 24 + Math.random() * 25));
  }
  throw new Error("The room changed at the same time. Please try that move again.");
}

async function createUniqueRoomCode() {
  let code = createRoomCode();
  while (await loadRoom(code)) code = createRoomCode();
  return code;
}

async function createPersistedRoom(factory) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = await createUniqueRoomCode();
    try {
      const room = await createRoomRecord(factory(code));
      if (room) return room;
    } catch (error) {
      if (error?.status !== 409) throw error;
    }
  }
  throw new Error("Could not reserve a room code. Please try again.");
}

function handleUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));

  const client = {
    id: crypto.randomUUID(),
    clientId: null,
    socket,
    roomCode: null,
    seat: null,
    buffer: Buffer.alloc(0),
    closed: false,
    messageQueue: Promise.resolve()
  };

  clients.set(client.id, client);
  socket.on("data", (chunk) => handleSocketData(client, chunk));
  socket.on("close", () => handleClientDisconnect(client));
  socket.on("error", () => handleClientDisconnect(client));
}

function handleSocketData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  let offset = 0;

  while (client.buffer.length - offset >= 2) {
    const first = client.buffer[offset];
    const second = client.buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (client.buffer.length - offset < 4) break;
      length = client.buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (client.buffer.length - offset < 10) break;
      const bigLength = client.buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        closeClient(client);
        return;
      }
      length = Number(bigLength);
      headerLength = 10;
    }

    const maskOffset = offset + headerLength;
    const payloadOffset = maskOffset + (masked ? 4 : 0);
    const frameEnd = payloadOffset + length;
    if (client.buffer.length < frameEnd) break;

    if (opcode === 0x8) {
      closeClient(client);
      return;
    }

    if (opcode === 0x1) {
      let payload = Buffer.from(client.buffer.subarray(payloadOffset, frameEnd));
      if (masked) {
        const mask = client.buffer.subarray(maskOffset, maskOffset + 4);
        payload = payload.map((byte, index) => byte ^ mask[index % 4]);
      }
      const rawMessage = payload.toString("utf8");
      client.messageQueue = client.messageQueue
        .then(() => handleClientMessage(client, rawMessage))
        .catch((error) => reply(client, null, fail(error.message || "Realtime action failed.")));
    }

    offset = frameEnd;
  }

  client.buffer = client.buffer.subarray(offset);
}

async function handleClientMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    reply(client, null, fail("Invalid message."));
    return;
  }

  const { id, event, payload } = message;
  if (event === "createRoom") {
    const stableClientId = cleanClientId(payload?.clientId);
    const room = await createPersistedRoom((code) => createRoomState(code, cleanName(payload?.name, "Player 1"), stableClientId, cleanName(payload?.rank, "Unranked")));
    const code = room.code;
    client.clientId = stableClientId;
    client.roomCode = code;
    client.seat = 0;
    reply(client, id, { ok: true, code, seat: 0, snapshot: snapshotFor(room, 0) });
    emitRoom(room);
    return;
  }

  if (event === "createBotRoom") {
    const stableClientId = cleanClientId(payload?.clientId);
    const room = await createPersistedRoom((code) => createBotRoomState(code, cleanName(payload?.name, "Player 1"), stableClientId));
    const code = room.code;
    client.clientId = stableClientId;
    client.roomCode = code;
    client.seat = 0;
    reply(client, id, { ok: true, code, seat: 0, snapshot: snapshotFor(room, 0) });
    emitRoom(room);
    return;
  }

  if (event === "joinRoom") {
    const stableClientId = cleanClientId(payload?.clientId);
    const mutation = await mutateRoom(payload?.code, (room) => {
      const wasDisconnected = room.players.some((player, index) => player.clientId === stableClientId && !isSeatConnected(room, index));
      const wasPlayerTwoConnected = isSeatConnected(room, 1);
      const seat = claimSeat(room, stableClientId, payload?.name, payload?.seat, payload?.rank);
      if (seat === null) return { result: fail("Room is full."), seat: null, skipSave: true };
      return {
        result: ok(),
        seat,
        shouldNotify: seat === 1 && !wasPlayerTwoConnected,
        shouldEmit: !payload?.heartbeat || wasDisconnected
      };
    });
    if (!mutation.room) {
      reply(client, id, fail("Room not found."));
      return;
    }
    if (!mutation.value?.result?.ok) {
      reply(client, id, mutation.value?.result || fail("Could not join room."));
      return;
    }
    const room = mutation.room;
    const seat = mutation.value.seat;
    client.clientId = stableClientId;
    client.roomCode = room.code;
    client.seat = seat;
    reply(client, id, { ok: true, code: room.code, seat, snapshot: snapshotFor(room, seat) });
    if (mutation.value.shouldNotify) notifyPlayerJoined(room, 0, seat);
    if (mutation.value.shouldEmit) emitRoom(room);
    return;
  }

  if (event === "gameAction") {
    const code = normalizeRoomCode(payload?.code || client.roomCode);
    const stableClientId = cleanClientId(payload?.clientId || client.clientId);
    const mutation = await mutateRoom(code, (room) => {
      const seat = resolveSeat(room, stableClientId, payload?.seat ?? client.seat);
      touchSeatConnection(room, seat);
      const action = payload?.action || payload || {};
      const existing = findProcessedAction(room, seat, action.actionId);
      if (existing) return { result: existing.result, seat, duplicate: true, skipSave: true };
      const result = performAction(room, seat, action);
      if (result.ok) {
        rememberProcessedAction(room, seat, action.actionId, result);
        advanceBotIfNeeded(room);
      }
      return { result, seat };
    });
    if (!mutation.room) {
      reply(client, id, fail("Join a room first."));
      return;
    }
    const room = mutation.room;
    const { seat, result, duplicate } = mutation.value;
    if (seat !== null) {
      client.clientId = stableClientId;
      client.roomCode = room.code;
      client.seat = seat;
    }
    if (result.ok && !duplicate) emitRoom(room);
    reply(client, id, { ...result, snapshot: snapshotFor(room, seat) });
    return;
  }

  if (event === "dragPreview") {
    const room = await getRoomForClientPayload(client, payload);
    if (!room) return;
    const stableClientId = cleanClientId(payload?.clientId || client.clientId);
    const seat = resolveSeat(room, stableClientId, payload?.seat ?? client.seat);
    if (seat !== 0 && seat !== 1) return;
    client.clientId = stableClientId;
    client.roomCode = room.code;
    client.seat = seat;
    emitDragPreview(room, client, {
      seat,
      active: !!payload?.active,
      tileIndex: payload?.active ? numberInRange(payload?.tileIndex, 0, 15) : null
    });
    return;
  }

  if (event === "leaveRoom") {
    const code = normalizeRoomCode(payload?.code || client.roomCode);
    const mutation = await mutateRoom(code, (room) => {
      const seat = resolveSeat(room, payload?.clientId || client.clientId, payload?.seat ?? client.seat);
      releaseSeat(room, seat);
      return { seat };
    });
    if (mutation.room) {
      emitRoom(mutation.room);
      await deleteRoomIfEmpty(mutation.room);
    }
    client.roomCode = null;
    client.seat = null;
    reply(client, id, ok());
    return;
  }

  reply(client, id, fail("Unknown event."));
}

function send(client, data) {
  if (client.closed || client.socket.destroyed) return;
  client.socket.write(encodeFrame(Buffer.from(JSON.stringify(data))));
}

function reply(client, id, result) {
  send(client, { type: "reply", id, result });
}

function sendState(client, room) {
  send(client, { type: "state", snapshot: snapshotFor(room, client.seat) });
}

async function getRoomForClientPayload(client, payload) {
  const requestedCode = normalizeRoomCode(payload?.code || client.roomCode);
  return requestedCode ? loadRoom(requestedCode) : null;
}

function encodeFrame(payload) {
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function closeClient(client) {
  if (client.closed) return;
  client.closed = true;
  try {
    client.socket.end(Buffer.from([0x88, 0x00]));
  } catch {
    client.socket.destroy();
  }
  handleClientDisconnect(client);
}

async function handleClientDisconnect(client) {
  if (!clients.has(client.id)) return;
  clients.delete(client.id);

  const hasReplacement = Array.from(clients.values()).some((other) => (
    !other.closed &&
    other.roomCode === client.roomCode &&
    other.clientId === client.clientId
  ));
  if (hasReplacement) return;

  const mutation = await mutateRoom(client.roomCode, (room) => {
    const player = room.players.find((seat) => seat.clientId === client.clientId);
    if (!player) return { skipSave: true };
    const seatIndex = room.players.indexOf(player);
    player.connected = false;
    if (seatIndex >= 0 && room.phase !== "playing") room.ready[seatIndex] = false;
    setMessage(room.game, `${player.name} disconnected.`);
    return { seatIndex };
  }).catch(() => ({ room: null }));
  if (!mutation.room || mutation.value?.skipSave) return;
  emitRoom(mutation.room);
  await deleteRoomIfEmpty(mutation.room);
}

function makeSeat(id, name, clientId, rank) {
  return {
    id,
    name,
    clientId,
    connected: !!clientId,
    lastSeenAt: clientId ? Date.now() : 0,
    rank: rank || VISUAL_RANKS[id - 1] || "Court Duelist"
  };
}

function createRoomState(code, playerName, clientId, playerRank = "Unranked") {
  return {
    code,
    mode: "room",
    botSeat: null,
    phase: "waiting",
    ready: [false, false],
    createdAt: Date.now(),
    joinedAt: null,
    startedAt: null,
    pushSubscriptions: [null, null],
    notificationOptInAt: [0, 0],
    lastJoinNotificationAt: [0, 0],
    recentActions: [],
    players: [
      makeSeat(1, playerName, clientId, playerRank),
      makeSeat(2, "Player 2", null)
    ],
    game: newGame(false)
  };
}

function createBotRoomState(code, playerName, clientId) {
  const room = createRoomState(code, playerName, clientId);
  room.mode = "quickplay";
  room.botSeat = 1;
  room.phase = "playing";
  room.ready = [true, true];
  room.joinedAt = Date.now();
  room.startedAt = Date.now();
  room.players[1] = makeSeat(2, BOT_NAME, `bot-${code}`, BOT_RANK);
  room.players[1].bot = true;
  room.game = newGame(true);
  setMessage(room.game, "Quickplay begins. Player 1 starts.");
  return room;
}

function cleanClientId(value) {
  const cleaned = String(value || "").replace(/[^\w-]/g, "").slice(0, 80);
  return cleaned || crypto.randomUUID();
}

function cleanName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[^\w .'-]/g, "").slice(0, 18);
  return cleaned || fallback;
}

function claimSeat(room, clientId, name, requestedSeat = null, rank = "Unranked") {
  const existingIndex = room.players.findIndex((seat) => seat.clientId === clientId);
  if (existingIndex >= 0) {
    const wasDisconnected = !room.players[existingIndex].connected;
    room.players[existingIndex].connected = true;
    room.players[existingIndex].lastSeenAt = Date.now();
    room.players[existingIndex].name = cleanName(name, `Player ${existingIndex + 1}`);
    room.players[existingIndex].rank = cleanName(rank, room.players[existingIndex].rank || "Unranked");
    if (wasDisconnected) setMessage(room.game, `${room.players[existingIndex].name} reconnected.`);
    return existingIndex;
  }

  const preferredSeat = normalizeSeat(requestedSeat);
  if (preferredSeat !== null) {
    const player = room.players[preferredSeat];
    if (player && !player.connected && !player.clientId) {
      assignSeat(room, preferredSeat, clientId, name, rank);
      return preferredSeat;
    }
  }

  const openIndex = room.players.findIndex((seat) => !seat.connected && !seat.clientId);
  if (openIndex >= 0) {
    assignSeat(room, openIndex, clientId, name, rank);
    return openIndex;
  }
  return null;
}

function assignSeat(room, seatIndex, clientId, name, rank = "Unranked") {
  room.players[seatIndex].clientId = clientId;
  room.players[seatIndex].connected = true;
  room.players[seatIndex].lastSeenAt = Date.now();
  room.players[seatIndex].name = cleanName(name, `Player ${seatIndex + 1}`);
  room.players[seatIndex].rank = cleanName(rank, "Unranked");
  if (room.phase !== "playing") room.ready[seatIndex] = false;
  room.joinedAt = Date.now();
  setMessage(room.game, `${room.players[seatIndex].name} joined as Player ${seatIndex + 1}.`);
}

function normalizeSeat(value) {
  const seat = Number(value);
  return Number.isInteger(seat) && seat >= 0 && seat <= 1 ? seat : null;
}

function resolveSeat(room, clientId, requestedSeat) {
  const cleanId = cleanClientId(clientId);
  const seat = normalizeSeat(requestedSeat);
  if (seat !== null && room.players[seat]?.clientId === cleanId) {
    return seat;
  }
  const found = room.players.findIndex((player) => player.clientId === cleanId);
  return found >= 0 ? found : null;
}

function touchSeatConnection(room, seatIndex) {
  if (seatIndex !== 0 && seatIndex !== 1) return;
  if (seatIndex === room.botSeat) return;
  if (room.players[seatIndex]?.clientId) {
    room.players[seatIndex].connected = true;
    room.players[seatIndex].lastSeenAt = Date.now();
  }
}

function isSeatConnected(room, seatIndex) {
  if (seatIndex === room.botSeat) return true;
  const player = room.players?.[seatIndex];
  if (!player?.clientId || !player.connected) return false;
  if (!player.lastSeenAt) return true;
  return Date.now() - Number(player.lastSeenAt) < PLAYER_PRESENCE_TTL_MS;
}

function releaseSeat(room, seatIndex) {
  if (seatIndex !== 0 && seatIndex !== 1) return;
  if (seatIndex === room.botSeat) return;
  const player = room.players[seatIndex];
  player.connected = false;
  player.lastSeenAt = 0;
  player.clientId = null;
  room.ready[seatIndex] = false;
  if (room.phase !== "playing") setMessage(room.game, `${player.name} left the waiting room.`);
}

async function deleteRoomIfEmpty(room) {
  const noHumansConnected = room.players.every((player, index) => !player.connected || index === room.botSeat);
  if (!noHumansConnected) return;
  const hasReservedHumanSeat = room.players.some((player, index) => index !== room.botSeat && !!player.clientId);
  if (room.mode !== "quickplay" && hasReservedHumanSeat) return;
  if (room.phase === "playing" && room.mode !== "quickplay") return;
  await removeRoom(room.code);
}

function isValidPushSubscription(subscription) {
  return !!(
    subscription &&
    typeof subscription.endpoint === "string" &&
    subscription.keys &&
    typeof subscription.keys.p256dh === "string" &&
    typeof subscription.keys.auth === "string"
  );
}

function notifyPlayerJoined(room, targetSeat, joinedSeat) {
  if (!PUSH_READY || room.phase !== "waiting") return;
  if (targetSeat === joinedSeat) return;
  const subscription = room.pushSubscriptions?.[targetSeat];
  if (!isValidPushSubscription(subscription)) return;
  const now = Date.now();
  if (now - (room.lastJoinNotificationAt?.[targetSeat] || 0) < 15000) return;
  room.lastJoinNotificationAt[targetSeat] = now;

  const joinedPlayer = room.players[joinedSeat];
  const joinedName = cleanName(joinedPlayer?.name, `Player ${joinedSeat + 1}`);
  const payload = JSON.stringify({
    title: "Jester's Grid",
    body: `${joinedName} is waiting in room ${room.code}.`,
    url: `/?room=${room.code}`,
    code: room.code
  });

  webpush.sendNotification(subscription, payload).catch((error) => {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      room.pushSubscriptions[targetSeat] = null;
    }
  });
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function emitRoom(room) {
  for (const client of clients.values()) {
    if (client.roomCode === room.code) sendState(client, room);
  }
}

function emitDragPreview(room, sourceClient, preview) {
  for (const client of clients.values()) {
    if (client === sourceClient || client.roomCode !== room.code) continue;
    send(client, { type: "dragPreview", preview });
  }
}

function snapshotFor(room, seat) {
  return {
    room: {
      code: room.code,
      mode: room.mode || "room",
      phase: room.phase,
      ready: room.ready,
      joinedAt: room.joinedAt,
      startedAt: room.startedAt,
      revision: Number(room._revision || 1),
      serverTime: Date.now()
    },
    you: { seat },
    game: {
      board: room.game.board,
      players: room.game.players.map((player, index) => ({
        id: player.id,
        name: room.players[index]?.name || `Player ${index + 1}`,
        connected: isSeatConnected(room, index),
        ready: room.ready[index] || false,
        rank: room.players[index]?.rank || VISUAL_RANKS[index] || "Court Duelist",
        hand: seat === index ? player.hand : null,
        handCount: player.hand.length,
        deckCount: player.deck.length,
        tokenTotal: countTokens(player),
        tokens: seat === index ? player.tokens : null
      })),
      current: room.game.current,
      tokensUsed: room.game.tokensUsed,
      cardPlacedThisTurn: room.game.cardPlacedThisTurn,
      extraCardPlacement: room.game.extraCardPlacement,
      pendingShot: room.game.pendingShot,
      pendingWitchTile: room.game.pendingWitchTile,
      gameOver: room.game.gameOver,
      winner: room.game.winner,
      lastPlacedTileIndex: room.game.lastPlacedTileIndex,
      lastMessage: room.game.lastMessage
    }
  };
}

function emptyTile() {
  return { stack: [], tokens: [], stunnedBy: null, stunTurns: 0, locked: false };
}

function createPlayer(id) {
  const deck = shuffle(Array.from({ length: 14 }, (_value, index) => index + 1));
  const tokens = {};
  TOKEN_TYPES.forEach((token) => {
    tokens[token.id] = token.count;
  });
  return { id, deck, hand: [], tokens };
}

function newGame(dealHands = true) {
  const game = {
    board: Array.from({ length: 16 }, emptyTile),
    players: [createPlayer(1), createPlayer(2)],
    current: 0,
    tokensUsed: 0,
    cardPlacedThisTurn: false,
    extraCardPlacement: false,
    pendingShot: null,
    pendingWitchTile: null,
    gameOver: false,
    winner: null,
    lastPlacedTileIndex: null,
    placedTokensThisTurn: [],
    nextTokenId: 1,
    lastMessage: dealHands ? "Choose a card, then tap a tile to place it. Player 1 starts." : "Waiting for both duelists to ready up."
  };
  if (dealHands) {
    drawUpToSix(game.players[0]);
    drawUpToSix(game.players[1]);
  }
  return game;
}

function shuffle(cards) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[target]] = [cards[target], cards[index]];
  }
  return cards;
}

function drawUpToSix(player) {
  while (player.hand.length < 6 && player.deck.length > 0) {
    player.hand.push(player.deck.shift());
  }
}

function currentPlayer(game) {
  return game.players[game.current];
}

function topCard(tile) {
  return tile.stack[tile.stack.length - 1] || null;
}

function setMessage(game, text) {
  game.lastMessage = text;
}

function countTokens(player) {
  return Object.values(player.tokens).reduce((total, value) => total + value, 0);
}

function startMatch(room) {
  room.phase = "playing";
  room.startedAt = Date.now();
  room.game = newGame(true);
  setMessage(room.game, "Both duelists are ready. Player 1 starts.");
}

function cleanActionId(value) {
  return String(value || "").replace(/[^\w-]/g, "").slice(0, 80);
}

function findProcessedAction(room, seat, actionId) {
  const id = cleanActionId(actionId);
  if (!id) return null;
  return (room.recentActions || []).find((entry) => entry.seat === seat && entry.id === id) || null;
}

function rememberProcessedAction(room, seat, actionId, result) {
  const id = cleanActionId(actionId);
  if (!id) return;
  room.recentActions ||= [];
  room.recentActions.push({ seat, id, result: { ok: !!result.ok, message: result.message }, at: Date.now() });
  if (room.recentActions.length > 48) room.recentActions.splice(0, room.recentActions.length - 48);
}

function performAction(room, seat, action) {
  const game = room.game;
  if (action.type === "restart") {
    if (seat !== 0 && seat !== 1) return fail("Only seated players can restart.");
    if (room.mode === "quickplay") {
      room.phase = "playing";
      room.ready = [true, true];
      room.joinedAt = Date.now();
      room.startedAt = Date.now();
      room.players[room.botSeat].connected = true;
      room.game = newGame(true);
      setMessage(room.game, "Quickplay restarted. Player 1 starts.");
      return ok();
    }
    room.phase = "waiting";
    room.ready = [false, false];
    room.startedAt = null;
    room.game = newGame(false);
    setMessage(room.game, "New match waiting for both duelists.");
    return ok();
  }

  if (seat !== 0 && seat !== 1) return fail("Spectators cannot move.");
  if (action.type === "ready") {
    if (room.mode === "quickplay") return ok("Quickplay is already underway.");
    if (![0, 1].every((index) => isSeatConnected(room, index))) return fail("Wait for both duelists to connect.");
    if (room.phase === "playing") return ok("Match already started.");
    room.ready[seat] = true;
    setMessage(game, `${room.players[seat].name} is ready.`);
    if (room.ready[0] && room.ready[1]) startMatch(room);
    return ok();
  }

  if (room.phase !== "playing") return fail("Both duelists must ready up before the match begins.");
  if (game.gameOver) return fail("The match is over.");
  if (seat !== game.current) return fail(`Waiting for Player ${game.current + 1}.`);

  switch (action.type) {
    case "placeCard":
      return placeCard(game, action.handIndex, action.tileIndex);
    case "useToken":
      return useTokenOnTile(game, action.tokenType, action.tileIndex);
    case "armorPierce":
      return applyArmorPierceToPendingShot(game);
    case "shoot":
      return resolveShot(game, action.tileIndex);
    case "stunTile":
      return resolveWitchStun(game, action.tileIndex);
    case "removeToken":
      return tryRemoveTokenFromTile(game, action.tileIndex);
    case "endTurn":
      return endTurn(game);
    case "cancel":
      return cancelSelection(game);
    default:
      return fail("Unknown action.");
  }
}

function ok(message) {
  return { ok: true, message };
}

function fail(message) {
  return { ok: false, message };
}

function numberInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function effectiveValue(card, tile) {
  if (!card) return 0;
  const hasBard = tile.tokens.some((token) => token.owner === card.owner && token.type === "bard");
  if (hasBard && card.value === 1) return 4;
  if (hasBard && card.value === 2) return 5;
  return card.value;
}

function isShooter(card, tile) {
  const value = effectiveValue(card, tile);
  return value === 4 || value === 5;
}

function canStunTile(game, tileIndex, sourceTileIndex = null) {
  const tile = game.board[tileIndex];
  if (!tile) return false;
  if (tileIndex === sourceTileIndex) return false;
  const card = topCard(tile);
  if (card?.value === 14) return false;
  if (tile.stunTurns > 0 || card?.stunned) return false;
  return true;
}

function canPlaceCard(game, tileIndex, value) {
  const tile = game.board[tileIndex];
  const top = topCard(tile);
  if (tile.locked || tile.stunTurns > 0 || top?.stunned) return false;
  if (!top) return true;
  if (top.value === 14) return false;
  if (top.value === 3) return false;
  return value >= top.value;
}

function placeCard(game, rawHandIndex, rawTileIndex) {
  if (game.pendingShot) return fail("Finish or skip the shot first.");
  if (game.pendingWitchTile !== null) return fail("Choose a tile for the Witch stun first.");

  const handIndex = numberInRange(rawHandIndex, 0, currentPlayer(game).hand.length - 1);
  const tileIndex = numberInRange(rawTileIndex, 0, 15);
  if (handIndex === null || tileIndex === null) return fail("Invalid card or tile.");
  if (game.cardPlacedThisTurn && !game.extraCardPlacement) return fail("You already placed a card this turn.");

  const player = currentPlayer(game);
  const value = player.hand[handIndex];
  if (!canPlaceCard(game, tileIndex, value)) return fail("That card cannot be placed there.");

  const tile = game.board[tileIndex];
  const top = topCard(tile);
  const sweep = !!top && top.value === value;
  player.hand.splice(handIndex, 1);

  if (sweep) {
    game.lastPlacedTileIndex = null;
    sweepTile(game, tileIndex);
    bottomDeck(player, value);
    game.extraCardPlacement = true;
    game.cardPlacedThisTurn = false;
    setMessage(game, "Sweep! The tile was cleared. Place another card immediately.");
    return ok();
  }

  tile.stack.push({ owner: player.id, value, stunned: false, protected: false, pierce: false });
  game.lastPlacedTileIndex = tileIndex;
  if (value === 14) tile.locked = true;
  game.cardPlacedThisTurn = true;
  game.extraCardPlacement = false;

  if (value === 6) {
    applyStun(game, tileIndex, player.id, 2);
    if (game.board.some((_tile, index) => canStunTile(game, index, tileIndex))) {
      game.pendingWitchTile = tileIndex;
      setMessage(game, "Witch placed. Her tile is stunned. Tap a non-Jester tile for the second stun.");
    } else {
      setMessage(game, "Witch placed. No other non-Jester tile can be stunned.");
    }
  } else if (value === 4 || value === 5) {
    prepareShot(game, tileIndex, false);
  } else {
    setMessage(game, `Player ${player.id} placed ${value} - ${CARD_NAMES[value]}.`);
  }

  checkWin(game);
  return ok();
}

function sweepTile(game, tileIndex) {
  const tile = game.board[tileIndex];
  tile.stack.forEach((card) => bottomDeck(game.players[card.owner - 1], card.value));
  tile.tokens.forEach((token) => {
    game.players[token.owner - 1].tokens[token.type] += 1;
  });
  game.board[tileIndex] = emptyTile();
}

function bottomDeck(player, value) {
  player.deck.push(value);
}

function applyStun(game, tileIndex, owner, turns = 2) {
  const tile = game.board[tileIndex];
  tile.stunnedBy = owner;
  tile.stunTurns = turns;
  const top = topCard(tile);
  if (top) top.stunned = true;
}

function resolveWitchStun(game, rawTileIndex) {
  if (game.pendingWitchTile === null) return fail("No Witch stun is pending.");
  const tileIndex = numberInRange(rawTileIndex, 0, 15);
  if (tileIndex === null) return fail("Invalid tile.");
  if (tileIndex === game.pendingWitchTile) return fail("Choose a different tile for the second Witch stun.");
  if (!canStunTile(game, tileIndex, game.pendingWitchTile)) {
    const card = topCard(game.board[tileIndex]);
    return fail(card?.value === 14 ? "The Jester cannot be stunned." : "That tile cannot be stunned.");
  }
  applyStun(game, tileIndex, currentPlayer(game).id, 2);
  game.pendingWitchTile = null;
  setMessage(game, "Witch stunned a tile. You may continue.");
  checkWin(game);
  return ok();
}

function decrementStunsForCurrentPlayer(game) {
  const id = currentPlayer(game).id;
  game.board.forEach((tile) => {
    if (tile.stunnedBy === id && tile.stunTurns > 0) {
      tile.stunTurns -= 1;
      if (tile.stunTurns <= 0) {
        tile.stunnedBy = null;
        const top = topCard(tile);
        if (top) top.stunned = false;
      }
    }
  });
}

function useTokenOnTile(game, type, rawTileIndex) {
  const tileIndex = numberInRange(rawTileIndex, 0, 15);
  if (tileIndex === null) return fail("Invalid tile.");
  if (!TOKEN_TYPES.some((token) => token.id === type)) return fail("Unknown token.");
  if (game.pendingShot && type !== "pierce") return fail("Finish or skip the shot first.");
  if (game.pendingWitchTile !== null) return fail("Choose a tile for the Witch stun first.");

  const player = currentPlayer(game);
  const tile = game.board[tileIndex];
  const card = topCard(tile);
  if (player.tokens[type] <= 0 || game.tokensUsed >= 2) return fail("No token use available.");

  if (type === "bard") {
    if (!card || card.owner !== player.id || ![1, 2].includes(card.value)) return fail("Bard can only be placed on your own 1 or 2.");
    addToken(game, type, tileIndex);
    prepareShot(game, tileIndex, true);
    return ok();
  }

  if (type === "ammo") {
    if (!card || card.owner !== player.id || !isShooter(card, tile)) return fail("Ammo Crate needs one of your shooting cards.");
    addToken(game, type, tileIndex);
    prepareShot(game, tileIndex, true);
    return ok();
  }

  if (type === "pierce") return fail("Armor Pierce is added during a shot.");

  if (type === "potion") {
    if (tile.stunTurns > 0 || card?.stunned) {
      tile.stunTurns = 0;
      tile.stunnedBy = null;
      if (card) card.stunned = false;
      addToken(game, type, tileIndex);
      setMessage(game, "Curious Potion removed the stun from that tile.");
      return ok();
    }
    if (card && card.owner === player.id && card.value === 6) {
      addToken(game, type, tileIndex);
      if (game.board.some((_tile, index) => canStunTile(game, index, tileIndex))) {
        game.pendingWitchTile = tileIndex;
        setMessage(game, "Curious Potion awakened the Witch. Tap a non-Jester tile to stun it.");
      } else {
        setMessage(game, "Curious Potion awakened the Witch, but no non-Jester tile can be stunned.");
      }
      return ok();
    }
    return fail("Curious Potion can remove stun or activate your Witch.");
  }

  if (type === "parry") {
    if (!card || card.owner !== player.id) return fail("Parry must be placed on your own card.");
    card.protected = true;
    addToken(game, type, tileIndex);
    setMessage(game, "Parry is set. This card will dodge the next incoming shot.");
    return ok();
  }

  return fail("Unknown token.");
}

function addToken(game, type, tileIndex) {
  const player = currentPlayer(game);
  const token = { owner: player.id, type, id: game.nextTokenId, removable: true };
  game.nextTokenId += 1;
  player.tokens[type] -= 1;
  game.tokensUsed += 1;
  game.board[tileIndex].tokens.push(token);
  game.placedTokensThisTurn.push({ tileIndex, tokenId: token.id, type });
  return token;
}

function tryRemoveTokenFromTile(game, rawTileIndex) {
  if (game.pendingShot || game.pendingWitchTile !== null) return fail("Finish the pending move first.");
  const tileIndex = numberInRange(rawTileIndex, 0, 15);
  if (tileIndex === null) return fail("Invalid tile.");

  const tile = game.board[tileIndex];
  const top = topCard(tile);
  if (!top) return fail("No removable token on that tile.");

  for (let index = game.placedTokensThisTurn.length - 1; index >= 0; index -= 1) {
    const placed = game.placedTokensThisTurn[index];
    if (placed.tileIndex !== tileIndex) continue;
    const tokenIndex = tile.tokens.findIndex((token) => token.id === placed.tokenId && token.owner === currentPlayer(game).id && token.removable !== false);
    if (tokenIndex < 0) continue;

    const [token] = tile.tokens.splice(tokenIndex, 1);
    currentPlayer(game).tokens[token.type] += 1;
    game.tokensUsed = Math.max(0, game.tokensUsed - 1);
    game.placedTokensThisTurn.splice(index, 1);
    if (token.type === "parry" && top.owner === currentPlayer(game).id) top.protected = false;
    if (token.type === "pierce" && top.owner === currentPlayer(game).id && !tile.tokens.some((item) => item.type === "pierce" && item.owner === currentPlayer(game).id)) top.pierce = false;
    setMessage(game, "Token returned to your hand.");
    return ok();
  }

  return fail("No removable token on that tile.");
}

function prepareShot(game, tileIndex, fromToken) {
  const tile = game.board[tileIndex];
  const card = topCard(tile);
  if (!card) return;

  const value = effectiveValue(card, tile);
  const targets = getShotTargets(game, tileIndex, value, card);
  const highTargets = getHighCardShotTargets(game, tileIndex, value, card);
  const canAddPierce = highTargets.length > 0 && currentPlayer(game).tokens.pierce > 0 && game.tokensUsed < 2 && !card.pierce;

  if (targets.length === 0 && !canAddPierce) {
    setMessage(game, fromToken ? "No valid shot targets. The shot is wasted." : "No valid shot targets available.");
    return;
  }

  game.pendingShot = { fromIndex: tileIndex, targets, shooterOwner: card.owner, fromToken };
  setMessage(game, `${CARD_NAMES[card.value]} can shoot. ${targets.length > 0 ? "Tap a highlighted enemy card, or press Cancel to skip." : "Tap Armor Pierce to shoot a high card, or press Cancel to skip."}`);
}

function applyArmorPierceToPendingShot(game) {
  if (!game.pendingShot) return fail("No shot is pending.");

  const tileIndex = game.pendingShot.fromIndex;
  const tile = game.board[tileIndex];
  const card = topCard(tile);
  if (!card || card.owner !== currentPlayer(game).id || !isShooter(card, tile)) return fail("Armor Pierce cannot be applied to this shooter.");
  if (card.pierce || tile.tokens.some((token) => token.owner === currentPlayer(game).id && token.type === "pierce")) return fail("This shooter already has Armor Pierce.");
  if (game.tokensUsed >= 2 || currentPlayer(game).tokens.pierce <= 0) return fail("No Armor Pierce token is available this turn.");

  const highTargets = getHighCardShotTargets(game, tileIndex, effectiveValue(card, tile), card);
  if (highTargets.length === 0) return fail("Armor Pierce is only needed for Shield or cards 10-13.");

  card.pierce = true;
  addToken(game, "pierce", tileIndex);
  game.pendingShot.targets = getShotTargets(game, tileIndex, effectiveValue(card, tile), card);
  setMessage(game, "Armor Pierce added. Choose who to shoot.");
  return ok();
}

function getHighCardShotTargets(game, tileIndex, value, shooter) {
  if (value !== 4 && value !== 5) return [];
  const piercedShooter = { ...shooter, pierce: true };
  return getShotTargets(game, tileIndex, value, piercedShooter).filter((index) => {
    const card = topCard(game.board[index]);
    return card && ((card.value >= 10 && card.value !== 14) || card.value === 3);
  });
}

function getShotTargets(game, tileIndex, value, shooter) {
  if (value !== 4 && value !== 5) return [];
  const dirs = value === 4 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const startRow = Math.floor(tileIndex / 4);
  const startCol = tileIndex % 4;
  const targets = [];

  dirs.forEach(([rowDelta, colDelta]) => {
    let row = startRow + rowDelta;
    let col = startCol + colDelta;
    while (row >= 0 && row < 4 && col >= 0 && col < 4) {
      const index = row * 4 + col;
      const tile = game.board[index];
      const target = topCard(tile);
      if (target) {
        if (tile.stunTurns <= 0 && !target.stunned && target.owner !== shooter.owner && canShootCard(target, shooter)) targets.push(index);
        break;
      }
      row += rowDelta;
      col += colDelta;
    }
  });

  return targets;
}

function canShootCard(target, shooter) {
  if (target.value === 14) return false;
  if (target.value === 3) return !!shooter.pierce;
  if (target.value >= 10) return !!shooter.pierce;
  return target.value < 10;
}

function resolveShot(game, rawTileIndex) {
  if (!game.pendingShot) return fail("No shot is pending.");
  const tileIndex = numberInRange(rawTileIndex, 0, 15);
  if (tileIndex === null || !game.pendingShot.targets.includes(tileIndex)) return fail("That tile is not in this card's shooting path.");

  const shot = game.pendingShot;
  const tile = game.board[tileIndex];
  const target = topCard(tile);
  if (!target) return fail("No target there.");

  if (tile.stunTurns > 0 || target.stunned) {
    game.pendingShot = null;
    setMessage(game, "That tile is stunned, so it cannot be shot.");
    return ok();
  }

  if (target.protected) {
    target.protected = false;
    const parryIndex = tile.tokens.findIndex((token) => token.type === "parry" && token.owner === target.owner);
    if (parryIndex >= 0) tile.tokens.splice(parryIndex, 1);
    game.pendingShot = null;
    setMessage(game, "Parry! The shot was dodged.");
    return ok();
  }

  if (shot.fromToken) {
    const shooterTile = game.board[shot.fromIndex];
    const ammo = [...shooterTile.tokens].reverse().find((token) => token.owner === shot.shooterOwner && token.type === "ammo");
    if (ammo) ammo.removable = false;
  }

  const removed = tile.stack.pop();
  bottomDeck(game.players[removed.owner - 1], removed.value);
  tile.tokens.forEach((token) => {
    game.players[token.owner - 1].tokens[token.type] += 1;
  });
  tile.tokens = [];
  if (!topCard(tile)) tile.locked = false;
  game.pendingShot = null;
  setMessage(game, `Shot landed. Player ${removed.owner}'s ${removed.value} was removed.`);
  checkWin(game);
  return ok();
}

function getWinner(game) {
  for (const line of WIN_LINES) {
    const owners = line.map((index) => topCard(game.board[index])?.owner || 0);
    if (owners[0] && owners.every((owner) => owner === owners[0])) return owners[0];
  }
  return null;
}

function checkWin(game) {
  const winner = getWinner(game);
  if (!winner) return;
  game.gameOver = true;
  game.winner = winner;
  setMessage(game, `Player ${winner} wins.`);
}

function endTurn(game) {
  if (!game.cardPlacedThisTurn) return fail("You must place one card before ending your turn.");
  if (game.pendingWitchTile !== null) return fail("Choose a tile for the Witch stun first.");
  game.pendingShot = null;
  game.tokensUsed = 0;
  game.placedTokensThisTurn = [];
  game.cardPlacedThisTurn = false;
  game.extraCardPlacement = false;
  decrementStunsForCurrentPlayer(game);
  game.current = 1 - game.current;
  drawUpToSix(currentPlayer(game));
  setMessage(game, `Player ${currentPlayer(game).id}'s turn. Drawn up to 6 cards.`);
  return ok();
}

function cancelSelection(game) {
  if (game.pendingShot) {
    game.pendingShot = null;
    setMessage(game, "Shot skipped.");
    return ok();
  }
  if (game.pendingWitchTile !== null) {
    return fail("Choose a tile for the Witch stun first.");
  }
  setMessage(game, "Selection cancelled.");
  return ok();
}

function advanceBotIfNeeded(room) {
  if (!room || room.mode !== "quickplay") return;
  let guard = 0;
  while (isBotTurn(room) && guard < 3) {
    runBotTurn(room);
    guard += 1;
  }
}

function isBotTurn(room) {
  return room.mode === "quickplay" &&
    room.phase === "playing" &&
    room.botSeat === room.game.current &&
    !room.game.gameOver;
}

function runBotTurn(room) {
  const game = room.game;
  let guard = 0;
  setMessage(game, `${BOT_NAME} is plotting its move.`);

  while (isBotTurn(room) && guard < 16) {
    guard += 1;

    if (resolveBotPending(game)) continue;
    if (game.gameOver) return;

    if (!game.cardPlacedThisTurn || game.extraCardPlacement) {
      const move = chooseBotCardMove(game);
      if (!move) {
        forceBotTurnEnd(game);
        return;
      }
      placeCard(game, move.handIndex, move.tileIndex);
      continue;
    }

    if (maybeBotUseSupportToken(game)) continue;
    if (resolveBotPending(game)) continue;
    if (game.gameOver) return;

    const result = endTurn(game);
    if (result.ok) setMessage(game, `Your turn. ${BOT_NAME} has moved.`);
    return;
  }

  if (isBotTurn(room)) forceBotTurnEnd(game);
}

function forceBotTurnEnd(game) {
  game.pendingShot = null;
  game.pendingWitchTile = null;
  game.tokensUsed = 0;
  game.placedTokensThisTurn = [];
  game.cardPlacedThisTurn = false;
  game.extraCardPlacement = false;
  decrementStunsForCurrentPlayer(game);
  game.current = 1 - game.current;
  drawUpToSix(currentPlayer(game));
  setMessage(game, `${BOT_NAME} found no legal card. Your turn.`);
}

function resolveBotPending(game) {
  if (game.pendingShot) {
    let target = chooseBotShotTarget(game);
    if (target === null) {
      const pierced = applyArmorPierceToPendingShot(game);
      if (pierced.ok) target = chooseBotShotTarget(game);
    }
    if (target !== null) resolveShot(game, target);
    else cancelSelection(game);
    return true;
  }

  if (game.pendingWitchTile !== null) {
    const target = chooseBotWitchTarget(game);
    if (target !== null) resolveWitchStun(game, target);
    else {
      game.pendingWitchTile = null;
      setMessage(game, `${BOT_NAME} found no non-Jester tile to stun.`);
    }
    return true;
  }

  return false;
}

function chooseBotShotTarget(game) {
  const targets = game.pendingShot?.targets || [];
  if (targets.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  targets.forEach((index) => {
    const card = topCard(game.board[index]);
    if (!card) return;
    const score = card.value * 90 + tileLinePressure(game, index, card.owner) + (card.protected ? -900 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function chooseBotWitchTarget(game) {
  const botId = currentPlayer(game).id;
  const enemyId = botId === 1 ? 2 : 1;
  let best = null;
  let bestScore = -Infinity;

  game.board.forEach((tile, index) => {
    const score = botStunTargetScore(game, index, botId, enemyId, game.pendingWitchTile);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });

  return bestScore > -Infinity ? best : null;
}

function bestBotStunTargetScore(game, sourceTileIndex, botId) {
  const enemyId = botId === 1 ? 2 : 1;
  return game.board.reduce((best, _tile, index) => {
    const score = botStunTargetScore(game, index, botId, enemyId, sourceTileIndex);
    return Math.max(best, score);
  }, -Infinity);
}

function botStunTargetScore(game, index, botId, enemyId, sourceTileIndex = null) {
  if (!canStunTile(game, index, sourceTileIndex)) return -Infinity;

  const tile = game.board[index];
  const card = topCard(tile);
  const enemyThreats = getThreatTilesForOwner(game, enemyId);
  const botThreats = getThreatTilesForOwner(game, botId);
  let score = 0;

  if (enemyThreats.has(index)) score += 1800;
  if (botThreats.has(index)) score -= 220;
  if ([5, 6, 9, 10].includes(index)) score += 42;
  if ([0, 3, 12, 15].includes(index)) score += 18;

  if (!card) return score + (enemyThreats.has(index) ? 460 : 18);

  if (card.owner === enemyId) {
    score += card.value * 70 + tileLinePressure(game, index, enemyId);
    if (isShooter(card, tile)) score += 520;
    if (card.value >= 10) score += 180;
    if (card.protected) score -= 70;
    return score;
  }

  score -= 380;
  score += Math.max(0, 14 - card.value) * 6;
  if (card.value <= 2) score += 80;
  return score;
}

function chooseBotCardMove(game) {
  const player = currentPlayer(game);
  const blockThreats = getThreatTilesForOwner(game, player.id === 1 ? 2 : 1);
  let best = null;
  let bestScore = -Infinity;

  player.hand.forEach((value, handIndex) => {
    game.board.forEach((_tile, tileIndex) => {
      if (!canPlaceCard(game, tileIndex, value)) return;
      const score = scoreBotCardMove(game, handIndex, tileIndex, blockThreats) + Math.random() * 6;
      if (score > bestScore) {
        bestScore = score;
        best = { handIndex, tileIndex, score };
      }
    });
  });

  return best;
}

function scoreBotCardMove(game, handIndex, tileIndex, blockThreats) {
  const player = currentPlayer(game);
  const enemyId = player.id === 1 ? 2 : 1;
  const value = player.hand[handIndex];
  const tile = game.board[tileIndex];
  const top = topCard(tile);
  const sweep = !!top && top.value === value;
  let score = value * 8;

  if (sweep) {
    score += top.owner === enemyId ? 380 + top.value * 42 : -620;
    if (blockThreats.has(tileIndex)) score += 700;
    return score;
  }

  if (wouldWinAfterMove(game, tileIndex, player.id)) score += 20000;
  if (blockThreats.has(tileIndex)) score += 6500;

  if (top?.owner === enemyId) {
    score += 240 + top.value * 40;
    if (top.value >= 10) score += 360;
  } else if (!top) {
    score += 70;
  }

  if ([5, 6, 9, 10].includes(tileIndex)) score += 95;
  if ([0, 3, 12, 15].includes(tileIndex)) score += 36;
  if (value === 14) score += 460;
  if (value === 3) score += 230;
  if (value === 6) {
    const stunScore = bestBotStunTargetScore(game, tileIndex, player.id);
    score += stunScore > -Infinity ? 160 + Math.min(stunScore, 2200) : -5000;
  }
  if (value === 4 || value === 5) score += 120 + botShooterPotential(game, tileIndex, value, player.id);

  WIN_LINES.forEach((line) => {
    if (!line.includes(tileIndex)) return;
    let own = 0;
    let enemy = 0;
    let empty = 0;
    line.forEach((index) => {
      const owner = ownerAfterBotMove(game, index, tileIndex, player.id, false);
      if (owner === player.id) own += 1;
      else if (owner === enemyId) enemy += 1;
      else empty += 1;
    });
    if (own === 4) score += 20000;
    if (own === 3 && empty === 1) score += 1250;
    if (own === 2 && empty >= 1) score += 320;
    if (enemy === 3 && empty === 1) score += 520;
    score += own * own * 140;
    score -= enemy * enemy * 48;
  });

  return score;
}

function ownerAfterBotMove(game, index, tileIndex, ownerId, sweep) {
  if (index === tileIndex) return sweep ? 0 : ownerId;
  return topCard(game.board[index])?.owner || 0;
}

function wouldWinAfterMove(game, tileIndex, ownerId) {
  return WIN_LINES.some((line) => (
    line.includes(tileIndex) &&
    line.every((index) => ownerAfterBotMove(game, index, tileIndex, ownerId, false) === ownerId)
  ));
}

function getThreatTilesForOwner(game, ownerId) {
  const threats = new Set();
  WIN_LINES.forEach((line) => {
    let owned = 0;
    line.forEach((index) => {
      if (topCard(game.board[index])?.owner === ownerId) owned += 1;
    });
    if (owned !== 3) return;
    line.forEach((index) => {
      if (topCard(game.board[index])?.owner !== ownerId) threats.add(index);
    });
  });
  return threats;
}

function tileLinePressure(game, tileIndex, ownerId) {
  let score = 0;
  WIN_LINES.forEach((line) => {
    if (!line.includes(tileIndex)) return;
    const owned = line.filter((index) => topCard(game.board[index])?.owner === ownerId).length;
    if (owned === 3) score += 520;
    else if (owned === 2) score += 170;
  });
  return score;
}

function botShooterPotential(game, tileIndex, value, ownerId, pierce = false) {
  if (value !== 4 && value !== 5) return 0;
  const dirs = value === 4 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const startRow = Math.floor(tileIndex / 4);
  const startCol = tileIndex % 4;
  let score = 0;

  dirs.forEach(([rowDelta, colDelta]) => {
    let row = startRow + rowDelta;
    let col = startCol + colDelta;
    while (row >= 0 && row < 4 && col >= 0 && col < 4) {
      const index = row * 4 + col;
      const card = topCard(game.board[index]);
      if (card) {
        if (card.owner !== ownerId && canShootCard(card, { owner: ownerId, pierce })) {
          score += 180 + card.value * 45 + tileLinePressure(game, index, card.owner);
        } else if (card.owner !== ownerId && !pierce && card.value >= 10 && currentPlayer(game).tokens.pierce > 0) {
          score += 95 + card.value * 15;
        }
        break;
      }
      row += rowDelta;
      col += colDelta;
    }
  });

  return score;
}

function maybeBotUseSupportToken(game) {
  const player = currentPlayer(game);
  if (game.tokensUsed >= 2) return false;

  if (player.tokens.potion > 0) {
    const potionTile = chooseBotPotionTile(game);
    if (potionTile !== null && useTokenOnTile(game, "potion", potionTile).ok) return true;
  }

  if (player.tokens.ammo > 0) {
    const ammoTile = chooseBotAmmoTile(game);
    if (ammoTile !== null && useTokenOnTile(game, "ammo", ammoTile).ok) return true;
  }

  if (player.tokens.bard > 0) {
    const bardTile = chooseBotBardTile(game);
    if (bardTile !== null && useTokenOnTile(game, "bard", bardTile).ok) return true;
  }

  if (player.tokens.parry > 0 && game.tokensUsed < 2) {
    const parryTile = chooseBotParryTile(game);
    if (parryTile !== null && useTokenOnTile(game, "parry", parryTile).ok) return true;
  }

  return false;
}

function chooseBotPotionTile(game) {
  const playerId = currentPlayer(game).id;
  let best = null;
  let bestScore = -Infinity;
  game.board.forEach((tile, index) => {
    const card = topCard(tile);
    if (!card || card.owner !== playerId || (tile.stunTurns <= 0 && !card.stunned)) return;
    const score = card.value * 70 + tileLinePressure(game, index, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function chooseBotAmmoTile(game) {
  const playerId = currentPlayer(game).id;
  let best = null;
  let bestScore = 0;
  game.board.forEach((tile, index) => {
    const card = topCard(tile);
    if (!card || card.owner !== playerId || !isShooter(card, tile)) return;
    if (tile.tokens.some((token) => token.owner === playerId && token.type === "ammo")) return;
    const score = botShooterPotential(game, index, effectiveValue(card, tile), playerId, card.pierce);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function chooseBotBardTile(game) {
  const playerId = currentPlayer(game).id;
  let best = null;
  let bestScore = 0;
  game.board.forEach((tile, index) => {
    const card = topCard(tile);
    if (!card || card.owner !== playerId || ![1, 2].includes(card.value)) return;
    if (tile.tokens.some((token) => token.owner === playerId && token.type === "bard")) return;
    const shooterValue = card.value === 1 ? 4 : 5;
    const score = botShooterPotential(game, index, shooterValue, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function chooseBotParryTile(game) {
  const playerId = currentPlayer(game).id;
  let best = null;
  let bestScore = 0;
  game.board.forEach((tile, index) => {
    const card = topCard(tile);
    if (!card || card.owner !== playerId || card.protected) return;
    if (tile.tokens.some((token) => token.owner === playerId && token.type === "parry")) return;
    const score = card.value * 34 + tileLinePressure(game, index, playerId);
    if (score > bestScore && (card.value >= 10 || score >= 520)) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
