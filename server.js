const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;
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
    const empty = room.players.every((player) => !player.connected);
    if (empty && now - room.createdAt > 1000 * 60 * 60 * 6) rooms.delete(code);
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
    sendJsonResponse(res, { ok: true, rooms: rooms.size, clients: clients.size });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, url);
    return;
  }

  const files = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/client.js": ["client.js", "text/javascript; charset=utf-8"],
    "/styles.css": ["styles.css", "text/css; charset=utf-8"]
  };
  const match = files[url.pathname] || files["/"];
  serveFile(res, path.join(__dirname, match[0]), match[1]);
}

async function handleApiRequest(req, res, url) {
  try {
    if (url.pathname === "/api/state" && req.method === "GET") {
      const room = rooms.get(String(url.searchParams.get("code") || "").trim().toUpperCase());
      if (!room) {
        sendJsonResponse(res, fail("Room not found."));
        return;
      }
      const seat = resolveSeat(room, url.searchParams.get("clientId"), url.searchParams.get("seat"));
      sendJsonResponse(res, { ok: true, snapshot: snapshotFor(room, seat) });
      return;
    }

    if (req.method !== "POST") {
      sendJsonResponse(res, fail("Unsupported method."), 405);
      return;
    }

    const body = await readJsonBody(req);
    if (url.pathname === "/api/create-room") {
      const code = createRoomCode();
      const clientId = cleanClientId(body.clientId);
      const room = {
        code,
        createdAt: Date.now(),
        players: [
          makeSeat(1, cleanName(body.name, "Player 1"), clientId),
          makeSeat(2, "Player 2", null)
        ],
        game: newGame()
      };
      rooms.set(code, room);
      sendJsonResponse(res, { ok: true, code, seat: 0, snapshot: snapshotFor(room, 0) });
      return;
    }

    if (url.pathname === "/api/join-room") {
      const room = rooms.get(String(body.code || "").trim().toUpperCase());
      if (!room) {
        sendJsonResponse(res, fail("Room not found."));
        return;
      }
      const seat = claimSeat(room, cleanClientId(body.clientId), body.name);
      sendJsonResponse(res, { ok: true, code: room.code, seat, snapshot: snapshotFor(room, seat) });
      return;
    }

    if (url.pathname === "/api/action") {
      const room = rooms.get(String(body.code || "").trim().toUpperCase());
      if (!room) {
        sendJsonResponse(res, fail("Join a room first."));
        return;
      }
      const seat = resolveSeat(room, body.clientId, body.seat);
      const result = performAction(room, seat, body.action || {});
      sendJsonResponse(res, { ...result, snapshot: snapshotFor(room, seat) });
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
    socket,
    roomCode: null,
    seat: null,
    buffer: Buffer.alloc(0),
    closed: false
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
      handleClientMessage(client, payload.toString("utf8"));
    }

    offset = frameEnd;
  }

  client.buffer = client.buffer.subarray(offset);
}

function handleClientMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    reply(client, null, fail("Invalid message."));
    return;
  }

  const { id, event, payload } = message;
  if (event === "createRoom") {
    const code = createRoomCode();
    const room = {
      code,
      createdAt: Date.now(),
      players: [
        makeSeat(1, cleanName(payload?.name, "Player 1"), client.id),
        makeSeat(2, "Player 2", null)
      ],
      game: newGame()
    };
    rooms.set(code, room);
    client.roomCode = code;
    client.seat = 0;
    reply(client, id, { ok: true, code, seat: 0 });
    emitRoom(room);
    return;
  }

  if (event === "joinRoom") {
    const room = rooms.get(String(payload?.code || "").trim().toUpperCase());
    if (!room) {
      reply(client, id, fail("Room not found."));
      return;
    }

    const seat = claimSeat(room, client.id, payload?.name);
    client.roomCode = room.code;
    client.seat = seat;
    reply(client, id, { ok: true, code: room.code, seat });
    emitRoom(room);
    return;
  }

  if (event === "gameAction") {
    const room = rooms.get(client.roomCode);
    if (!room) {
      reply(client, id, fail("Join a room first."));
      return;
    }

    const result = performAction(room, client.seat, payload || {});
    reply(client, id, result);
    if (result.ok) emitRoom(room);
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

function handleClientDisconnect(client) {
  if (!clients.has(client.id)) return;
  clients.delete(client.id);

  const room = rooms.get(client.roomCode);
  if (!room) return;
  const player = room.players.find((seat) => seat.socketId === client.id);
  if (player) {
    player.socketId = null;
    player.connected = false;
    setMessage(room.game, `${player.name} disconnected.`);
    emitRoom(room);
  }
}

function makeSeat(id, name, socketId) {
  return { id, name, socketId, connected: !!socketId };
}

function cleanClientId(value) {
  const cleaned = String(value || "").replace(/[^\w-]/g, "").slice(0, 80);
  return cleaned || crypto.randomUUID();
}

function cleanName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[^\w .'-]/g, "").slice(0, 18);
  return cleaned || fallback;
}

function claimSeat(room, socketId, name) {
  const existingIndex = room.players.findIndex((seat) => seat.socketId === socketId);
  if (existingIndex >= 0) {
    room.players[existingIndex].connected = true;
    room.players[existingIndex].name = cleanName(name, `Player ${existingIndex + 1}`);
    return existingIndex;
  }

  const openIndex = room.players.findIndex((seat) => !seat.connected);
  if (openIndex >= 0) {
    room.players[openIndex].socketId = socketId;
    room.players[openIndex].connected = true;
    room.players[openIndex].name = cleanName(name, `Player ${openIndex + 1}`);
    setMessage(room.game, `${room.players[openIndex].name} joined as Player ${openIndex + 1}.`);
    return openIndex;
  }
  return null;
}

function resolveSeat(room, clientId, requestedSeat) {
  const cleanId = cleanClientId(clientId);
  const seat = Number(requestedSeat);
  if (Number.isInteger(seat) && seat >= 0 && seat <= 1 && room.players[seat]?.socketId === cleanId) {
    return seat;
  }
  const found = room.players.findIndex((player) => player.socketId === cleanId);
  return found >= 0 ? found : null;
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

function snapshotFor(room, seat) {
  return {
    room: { code: room.code },
    you: { seat },
    game: {
      board: room.game.board,
      players: room.game.players.map((player, index) => ({
        id: player.id,
        name: room.players[index]?.name || `Player ${index + 1}`,
        connected: room.players[index]?.connected || false,
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

function newGame() {
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
    lastMessage: "Choose a card, then tap a tile to place it. Player 1 starts."
  };
  drawUpToSix(game.players[0]);
  drawUpToSix(game.players[1]);
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

function performAction(room, seat, action) {
  const game = room.game;
  if (action.type === "restart") {
    if (seat !== 0 && seat !== 1) return fail("Only seated players can restart.");
    room.game = newGame();
    setMessage(room.game, "New match started.");
    return ok();
  }

  if (seat !== 0 && seat !== 1) return fail("Spectators cannot move.");
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
    game.pendingWitchTile = tileIndex;
    setMessage(game, "Witch placed. Tap one other tile to stun it.");
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
      game.pendingWitchTile = tileIndex;
      setMessage(game, "Curious Potion awakened the Witch. Tap any tile to stun it.");
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
  game.pendingShot = null;
  game.pendingWitchTile = null;
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
    game.pendingWitchTile = null;
    setMessage(game, "Witch stun skipped.");
    return ok();
  }
  setMessage(game, "Selection cancelled.");
  return ok();
}
