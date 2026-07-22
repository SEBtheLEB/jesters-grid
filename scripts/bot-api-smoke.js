const { spawn } = require("child_process");
const path = require("path");

const testPort = 33000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${testPort}`;
let serverProcess = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  assert(response.ok, `${pathname} returned HTTP ${response.status}`);
  return data;
}

async function post(pathname, body) {
  return request(pathname, { method: "POST", body: JSON.stringify(body) });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await request("/healthz");
      if (health.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("The bot test server did not start.");
}

function topCard(tile) {
  return tile.stack[tile.stack.length - 1] || null;
}

function canPlace(snapshot, tileIndex, value) {
  const tile = snapshot.game.board[tileIndex];
  const card = topCard(tile);
  if (tile.locked || tile.stunTurns > 0 || card?.stunned) return false;
  if (!card) return true;
  if (card.value === 14 || card.value === 3) return false;
  return value >= card.value;
}

function firstWitchTarget(snapshot) {
  return snapshot.game.board.findIndex((tile, index) => (
    index !== snapshot.game.pendingWitchTile &&
    topCard(tile)?.value !== 14 &&
    tile.stunTurns <= 0 &&
    !topCard(tile)?.stunned
  ));
}

async function playHumanTurn(snapshot, code, player, turnNumber) {
  let current = snapshot;
  let actionNumber = 0;
  while (!current.game.cardPlacedThisTurn || current.game.extraCardPlacement) {
    const hand = current.game.players[0].hand;
    let move = null;
    hand.forEach((value, handIndex) => {
      if (move) return;
      current.game.board.forEach((_tile, tileIndex) => {
        if (!move && canPlace(current, tileIndex, value)) move = { handIndex, tileIndex };
      });
    });
    if (!move) return { snapshot: current, blocked: true };

    const placed = await post("/api/action", {
      ...player,
      code,
      seat: 0,
      action: { type: "placeCard", ...move, actionId: `match-${turnNumber}-place-${actionNumber}` }
    });
    assert(placed.ok, `Long-match card placement failed: ${placed.message || "unknown error"}`);
    current = placed.snapshot;
    actionNumber += 1;

    if (current.game.pendingShot) {
      const cancelled = await post("/api/action", {
        ...player,
        code,
        seat: 0,
        action: { type: "cancel", actionId: `match-${turnNumber}-cancel-${actionNumber}` }
      });
      assert(cancelled.ok, "Could not cancel the scripted human shot.");
      current = cancelled.snapshot;
      actionNumber += 1;
    }

    if (current.game.pendingWitchTile !== null) {
      const tileIndex = firstWitchTarget(current);
      assert(tileIndex >= 0, "Scripted human Witch had no legal forced target.");
      const stunned = await post("/api/action", {
        ...player,
        code,
        seat: 0,
        action: { type: "stunTile", tileIndex, actionId: `match-${turnNumber}-stun-${actionNumber}` }
      });
      assert(stunned.ok, `Could not resolve the scripted human Witch: ${stunned.message || "unknown error"}`);
      current = stunned.snapshot;
      actionNumber += 1;
    }

    if (current.game.gameOver) return { snapshot: current, blocked: false };
  }

  const ended = await post("/api/action", {
    ...player,
    code,
    seat: 0,
    action: { type: "endTurn", actionId: `match-${turnNumber}-end` }
  });
  assert(ended.ok, `Long-match end turn failed: ${ended.message || "unknown error"}`);
  return { snapshot: ended.snapshot, blocked: false };
}

async function run() {
  serverProcess = spawn(process.execPath, [path.join(process.cwd(), "server.js")], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(testPort), SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer();

  const player = { clientId: `bot-smoke-${Date.now()}`, name: "Strategist" };
  const created = await post("/api/create-bot-room", player);
  assert(created.ok && created.code, "Could not create a bot room.");

  const hand = created.snapshot.game.players[0].hand;
  const legalOpeners = hand
    .map((value, index) => ({ value, index }))
    .filter((entry) => ![4, 5, 6].includes(entry.value))
    .sort((left, right) => left.value - right.value);
  const handIndex = legalOpeners[0]?.index ?? -1;
  assert(handIndex >= 0, "Could not find a deterministic human opening card.");

  const placed = await post("/api/action", {
    ...player,
    code: created.code,
    seat: 0,
    action: { type: "placeCard", handIndex, tileIndex: 0, actionId: "human-opening-card" }
  });
  assert(placed.ok, `Human setup move failed: ${placed.message || "unknown error"}`);

  const ended = await post("/api/action", {
    ...player,
    code: created.code,
    seat: 0,
    action: { type: "endTurn", actionId: "human-opening-end" }
  });
  assert(ended.ok, `Human end turn failed: ${ended.message || "unknown error"}`);
  assert(ended.snapshot.game.current === 0, "Bot did not complete its turn and return control.");
  assert(!ended.snapshot.game.pendingShot && ended.snapshot.game.pendingWitchTile === null, "Bot left a required action unresolved.");

  const botCards = ended.snapshot.game.board
    .map((tile, tileIndex) => ({ tile, tileIndex, card: topCard(tile) }))
    .filter((entry) => entry.card?.owner === 2);
  assert(botCards.length > 0, "Bot did not place a card.");
  if (hand[handIndex] < 10) {
    assert(
      botCards.every((entry) => entry.card.value !== 14),
      `Bot auto-played Jester against a low opening card: ${JSON.stringify(botCards.map((entry) => ({ tile: entry.tileIndex, value: entry.card.value })))}`
    );
  }
  assert(botCards.every((entry) => !entry.tile.tokens.some((token) => token.type === "potion" && entry.card.value === 14)), "Bot placed Curious Potion on Jester.");

  let current = ended.snapshot;
  let completedTurns = 1;
  let blocked = false;
  for (let turn = 2; turn <= 14 && !current.game.gameOver; turn += 1) {
    const result = await playHumanTurn(current, created.code, player, turn);
    current = result.snapshot;
    blocked = result.blocked;
    if (blocked) break;
    completedTurns += 1;
    assert(current.game.gameOver || current.game.current === 0, "Bot left the long match on its own turn.");
    assert(
      !current.game.pendingShot && current.game.pendingWitchTile === null,
      `Bot left a long-match action unresolved: ${JSON.stringify({ gameOver: current.game.gameOver, winner: current.game.winner, pendingShot: current.game.pendingShot, pendingWitchTile: current.game.pendingWitchTile, message: current.game.lastMessage })}`
    );
    current.game.board.forEach((tile) => {
      const card = topCard(tile);
      assert(!(card?.owner === 2 && card.value === 14 && tile.tokens.some((token) => token.type === "potion")), "Bot attached Curious Potion to Jester during the long match.");
    });
  }
  assert(current.game.gameOver || completedTurns >= 5 || blocked, "Bot match did not progress far enough to exercise strategy.");

  console.log(`Bot API smoke test passed (room ${created.code}, opening card ${botCards[0].card.value}, ${completedTurns} rounds${blocked ? ", board exhausted" : ""}).`);
}

run()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (serverProcess) serverProcess.kill();
  });
