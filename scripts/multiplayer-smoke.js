const { spawn } = require("child_process");
const path = require("path");

const testPort = 32000 + Math.floor(Math.random() * 1000);
const externalBaseUrl = process.env.TEST_BASE_URL;
const baseUrl = externalBaseUrl || `http://127.0.0.1:${testPort}`;
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
      if (health.ok) return health;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("The test server did not start.");
}

async function run() {
  if (!externalBaseUrl) {
    serverProcess = spawn(process.execPath, [path.join(process.cwd(), "server.js")], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(testPort), SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
  }

  const health = await waitForServer();
  const playerOne = { clientId: `smoke-p1-${Date.now()}`, name: "Harlequin" };
  const playerTwo = { clientId: `smoke-p2-${Date.now()}`, name: "Pierrot" };

  const created = await post("/api/create-room", playerOne);
  assert(created.ok && created.code && created.seat === 0, "Player 1 could not create a room.");
  const code = created.code;

  const joined = await post("/api/join-room", { ...playerTwo, code });
  assert(joined.ok && joined.seat === 1, "Player 2 could not join the room.");

  const readyOne = await post("/api/action", {
    ...playerOne,
    code,
    seat: 0,
    action: { type: "ready", actionId: "ready-p1" }
  });
  const readyTwo = await post("/api/action", {
    ...playerTwo,
    code,
    seat: 1,
    action: { type: "ready", actionId: "ready-p2" }
  });
  assert(readyOne.ok && readyTwo.ok && readyTwo.snapshot.room.phase === "playing", "Ready-up did not start the match.");

  const earlyEnd = await post("/api/action", {
    ...playerOne,
    code,
    seat: 0,
    action: { type: "endTurn", actionId: "early-end" }
  });
  assert(!earlyEnd.ok && /place one card/i.test(earlyEnd.message), "End Turn was allowed before a card was played.");

  const actionId = "place-card-once";
  const placed = await post("/api/action", {
    ...playerOne,
    code,
    seat: 0,
    action: { type: "placeCard", handIndex: 0, tileIndex: 0, actionId }
  });
  assert(placed.ok, `Card placement failed: ${placed.message || "unknown error"}`);
  const placedRevision = placed.snapshot.room.revision;

  const duplicate = await post("/api/action", {
    ...playerOne,
    code,
    seat: 0,
    action: { type: "placeCard", handIndex: 0, tileIndex: 0, actionId }
  });
  assert(duplicate.ok, "An idempotent retry did not return the original success.");
  assert(duplicate.snapshot.room.revision === placedRevision, "An idempotent retry mutated the room twice.");

  const ended = await post("/api/action", {
    ...playerOne,
    code,
    seat: 0,
    action: { type: "endTurn", actionId: "end-after-card" }
  });
  assert(ended.ok && ended.snapshot.game.current === 1, "Turn did not pass to Player 2.");

  const state = await request(`/api/state?code=${code}&clientId=${playerTwo.clientId}&seat=1`);
  assert(state.ok && state.snapshot.game.current === 1, "Player 2 did not receive the authoritative state.");

  console.log(`Multiplayer smoke test passed (${health.roomStore} store, room ${code}).`);
}

run()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (serverProcess) serverProcess.kill();
  });
