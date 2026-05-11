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
  { id: "bard", label: "Bard", icon: "B" },
  { id: "ammo", label: "Ammo Crate", icon: "A" },
  { id: "pierce", label: "Armor Pierce", icon: "P" },
  { id: "potion", label: "Curious Potion", icon: "C" },
  { id: "parry", label: "Parry", icon: "R" }
];
const LOCAL_TOKEN_COUNTS = {
  bard: 2,
  ammo: 2,
  pierce: 2,
  potion: 2,
  parry: 1
};
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

const TOKEN_DETAILS = {
  bard: "Place on one of your 1s or 2s to turn it into a shooter. A 1 becomes a diagonal shooter and a 2 becomes a straight shooter.",
  ammo: "Place on one of your shooters to fire a shot. Shooters are 4s, 5s, or cards empowered by Bard.",
  pierce: "Use during a shot to let that shot destroy high cards from 10 through 13.",
  potion: "Use on a stunned tile to clear it, or use your Witch to stun another tile.",
  parry: "Place on one of your cards to block the next shot that would destroy it."
};

const CARD_DETAILS = {
  1: "A low court card. Place it on an empty tile or cover lower-value cards when allowed.",
  2: "A low court card. It can be upgraded by Bard into a straight shooter.",
  3: "Shield cannot be covered, swept, or shot unless Armor Pierce is involved.",
  4: "Archer is a diagonal shooter. Use Ammo Crate on it to shoot along diagonal lines.",
  5: "Crossbow is a straight shooter. Use Ammo Crate on it to shoot along rows and columns.",
  6: "Witch can stun a tile, stopping play and shots on that tile until cleared.",
  7: "A strong court card for covering lower cards and building toward four in a row.",
  8: "A strong court card for covering lower cards and controlling the grid.",
  9: "A strong court card for covering lower cards and blocking opponent lines.",
  10: "Banner is a high court card. It is hard to cover and can anchor a line.",
  11: "Champion is a high court card. It pressures the board and resists most cover attempts.",
  12: "Giant is a high court card. Only very high cards can cover it.",
  13: "King is one of the strongest cards and can only be covered by the Jester.",
  14: "Jester locks the tile. A locked tile cannot be covered."
};

let socket = null;
let autoJoinAttempted = false;
let usingHttpFallback = false;
let pollTimer = null;
let requestId = 1;
const pendingReplies = new Map();
const clientId = getClientId();
const screens = {
  menu: document.getElementById("menuScreen"),
  game: document.getElementById("gameScreen"),
  rules: document.getElementById("rulesScreen")
};

const gameShell = document.getElementById("gameShell");
const waitingRoom = document.getElementById("waitingRoom");
const waitingRoomCode = document.getElementById("waitingRoomCode");
const waitingCopyInvite = document.getElementById("waitingCopyInvite");
const waitingStatus = document.getElementById("waitingStatus");
const waitingJoinBanner = document.getElementById("waitingJoinBanner");
const readyBtn = document.getElementById("readyBtn");
const waitingBackBtn = document.getElementById("waitingBackBtn");
const turnIntroOverlay = document.getElementById("turnIntroOverlay");
const turnIntroText = document.getElementById("turnIntroText");
const turnIntroKicker = document.getElementById("turnIntroKicker");
const boardEl = document.getElementById("board");
const handEl = document.getElementById("hand");
const tokensEl = document.getElementById("tokens");
const emptyTokenLabel = document.getElementById("emptyTokenLabel");
const messageEl = document.getElementById("message");
const turnLabel = document.getElementById("turnLabel");
const handSectionTitle = document.getElementById("handSectionTitle");
const tokenLimit = document.getElementById("tokenLimit");
const cancelBtn = document.getElementById("cancelBtn");
const winModal = document.getElementById("winModal");
const winTitle = document.getElementById("winTitle");
const winText = document.getElementById("winText");
const inspectOverlay = document.getElementById("inspectOverlay");
const inspectTitle = document.getElementById("inspectTitle");
const inspectMeta = document.getElementById("inspectMeta");
const inspectBody = document.getElementById("inspectBody");
const inspectClose = document.getElementById("inspectClose");
const settingsMenu = document.getElementById("settingsMenu");
const tokenPanelBtn = document.getElementById("tokenPanelBtn");
const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCodeInput");
const menuStatus = document.getElementById("menuStatus");
const roomTabBtn = document.getElementById("roomTabBtn");
const quickplayTabBtn = document.getElementById("quickplayTabBtn");
const roomTabPanel = document.getElementById("roomTabPanel");
const quickplayTabPanel = document.getElementById("quickplayTabPanel");
const quickplayBotBtn = document.getElementById("quickplayBotBtn");

let snapshot = null;
let selectedCardIndex = null;
let selectedToken = null;
let showingTokens = false;
let deckExpanded = false;
let inspectedCardIndex = null;
let inspectedTokenId = null;
let heldCardIndex = null;
let heldTokenId = null;
let dragCandidate = null;
let draggedCard = null;
let tokenDragCandidate = null;
let draggedToken = null;
let suppressPieceClickUntil = 0;
let remoteDragPreview = null;
let remoteDragPreviewTimer = null;
let lastSentCardDragTile = null;
let localMessage = "";
let renderRoomCode = "";
let previousHandValues = [];
let previousTokenCounts = {};
let previousBoardTopKeys = [];
let previousBoardTokenKeys = [];
let previousRoomPhase = "";
let previousPlayerTwoConnected = false;
let previousShowingTokens = false;
let introTimer = null;
let botTurnTimer = null;

const DECK_CARD_LAYOUTS = [
  { x: -46, y: -22, r: -8, openX: -90, openY: -42, openR: -9, z: 2 },
  { x: 0, y: -27, r: 0, openX: 0, openY: -48, openR: 0, z: 3 },
  { x: 46, y: -22, r: 8, openX: 90, openY: -42, openR: 9, z: 2 },
  { x: -42, y: 14, r: -5, openX: -84, openY: 16, openR: -6, z: 5 },
  { x: 0, y: 19, r: 0, openX: 0, openY: 22, openR: 0, z: 6 },
  { x: 42, y: 14, r: 5, openX: 84, openY: 16, openR: 6, z: 5 }
];

const TOKEN_LAYOUTS = [
  { x: -2, y: -6, openX: -84, openY: -74, z: 5 },
  { x: 3, y: -3, openX: -48, openY: -108, z: 4 },
  { x: -4, y: 0, openX: -12, openY: -126, z: 3 },
  { x: 4, y: 3, openX: -70, openY: -34, z: 2 },
  { x: -1, y: 6, openX: -28, openY: -52, z: 1 }
];

function getClientId() {
  const existing = localStorage.getItem("jg-client-id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("jg-client-id", id);
  return id;
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("jg-theme", theme);
}

applyTheme(localStorage.getItem("jg-theme") || "dark");
playerNameInput.value = localStorage.getItem("jg-name") || "Jester";

const roomFromUrl = new URLSearchParams(window.location.search).get("room");
if (roomFromUrl) roomCodeInput.value = roomFromUrl.toUpperCase();

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  settingsMenu.classList.remove("open");
}

function setMenuStatus(text) {
  menuStatus.textContent = text;
}

function showMenuTab(tab) {
  const quickplay = tab === "quickplay";
  roomTabBtn.classList.toggle("active", !quickplay);
  quickplayTabBtn.classList.toggle("active", quickplay);
  roomTabBtn.setAttribute("aria-selected", String(!quickplay));
  quickplayTabBtn.setAttribute("aria-selected", String(quickplay));
  roomTabPanel.classList.toggle("active", !quickplay);
  quickplayTabPanel.classList.toggle("active", quickplay);
  setMenuStatus(quickplay ? "Quickplay starts a solo bot duel." : "Connect to start a 1v1 room.");
}

function setLocalMessage(text) {
  localMessage = text;
  render();
}

function isMatchPlaying() {
  return snapshot?.room?.phase === "playing";
}

function isOfflineQuickplay() {
  return snapshot?.room?.offline === true;
}

function playerInitials(name, fallback) {
  const cleaned = String(name || fallback || "").trim();
  if (!cleaned) return fallback;
  return cleaned.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function socketOpen() {
  return !usingHttpFallback && socket?.readyState === WebSocket.OPEN;
}

function connectRealtime() {
  if (usingHttpFallback) return;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

  socket.addEventListener("open", () => {
    setMenuStatus("Connected.");
    if (snapshot?.room?.code) {
      rejoinActiveRoom();
    } else if (roomFromUrl && !autoJoinAttempted) {
      autoJoinAttempted = true;
      joinRoom();
    }
    render();
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "reply") {
      const callback = pendingReplies.get(message.id);
      if (callback) {
        pendingReplies.delete(message.id);
        callback(message.result);
      }
      return;
    }

    if (message.type === "state") {
      if (isOfflineQuickplay()) return;
      snapshot = message.snapshot;
      localMessage = "";
      render();
      return;
    }

    if (message.type === "dragPreview") {
      const preview = message.preview || {};
      if (preview.seat === mySeat()) return;
      window.clearTimeout(remoteDragPreviewTimer);
      if (!preview.active) {
        remoteDragPreview = null;
      } else {
        remoteDragPreview = {
          seat: preview.seat,
          tileIndex: Number.isInteger(preview.tileIndex) ? preview.tileIndex : null
        };
        remoteDragPreviewTimer = window.setTimeout(() => {
          remoteDragPreview = null;
          renderBoard();
        }, 1800);
      }
      renderBoard();
    }
  });

  socket.addEventListener("close", () => {
    if (isOfflineQuickplay()) return;
    if (!snapshot) {
      startHttpFallback();
      return;
    }
    setMenuStatus("Disconnected. Reconnecting...");
    if (snapshot) render();
    window.setTimeout(connectRealtime, 1200);
  });

  socket.addEventListener("error", () => {
    if (!snapshot) startHttpFallback();
  });
}

function sendEvent(event, payload, callback) {
  if (!socketOpen()) {
    sendHttpEvent(event, payload, callback);
    return;
  }

  const id = requestId;
  const outboundPayload = event === "gameAction"
    ? { clientId, code: snapshot?.room?.code, seat: mySeat(), action: payload }
    : { ...(payload || {}), clientId };
  requestId += 1;
  pendingReplies.set(id, callback || (() => {}));
  socket.send(JSON.stringify({ id, event, payload: outboundPayload }));

  window.setTimeout(() => {
    if (!pendingReplies.has(id)) return;
    pendingReplies.delete(id);
    callback?.({ ok: false, message: "The server did not answer in time." });
  }, 8000);
}

function sendCardDragPreview(tileIndex, active = true) {
  if (isOfflineQuickplay()) return;
  if (!socketOpen() || !snapshot?.room?.code) return;
  const normalizedTile = Number.isInteger(tileIndex) ? tileIndex : null;
  if (active && normalizedTile === lastSentCardDragTile) return;
  lastSentCardDragTile = active ? normalizedTile : null;
  socket.send(JSON.stringify({
    event: "dragPreview",
    payload: {
      clientId,
      code: snapshot.room.code,
      seat: mySeat(),
      active,
      tileIndex: normalizedTile
    }
  }));
}

function rejoinActiveRoom() {
  if (isOfflineQuickplay()) return;
  const code = snapshot?.room?.code || roomCodeInput.value.trim().toUpperCase();
  if (!code) return;
  const name = playerNameInput.value.trim() || "Jester";
  sendEvent("joinRoom", { code, name }, (result) => {
    if (!result?.ok) {
      setMenuStatus(result?.message || "Could not rejoin room.");
    }
  });
}

function startHttpFallback() {
  if (usingHttpFallback) return;
  usingHttpFallback = true;
  setMenuStatus("Connected.");
  if (roomFromUrl && !snapshot && !autoJoinAttempted) {
    autoJoinAttempted = true;
    joinRoom();
  }
  startPolling();
  render();
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = window.setInterval(pollState, 1400);
}

function stopPolling() {
  if (!pollTimer) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function pollState() {
  if (isOfflineQuickplay()) return;
  if (!usingHttpFallback || !snapshot?.room?.code) return;
  const seat = mySeat();
  const params = new URLSearchParams({ code: snapshot.room.code, clientId, seat: String(seat ?? "") });
  try {
    const response = await fetch(`/api/state?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();
    if (result.ok && result.snapshot) {
      snapshot = result.snapshot;
      render();
    }
  } catch {
    setMenuStatus("Reconnecting...");
  }
}

async function sendHttpEvent(event, payload, callback) {
  const routes = {
    createRoom: "/api/create-room",
    createBotRoom: "/api/create-bot-room",
    joinRoom: "/api/join-room",
    leaveRoom: "/api/leave-room",
    gameAction: "/api/action"
  };
  const route = routes[event];
  if (!route) {
    callback?.({ ok: false, message: "Unknown action." });
    return;
  }

  const body = event === "gameAction"
    ? { clientId, code: snapshot?.room?.code, seat: mySeat(), action: payload }
    : { ...payload, clientId };

  try {
    const response = await fetch(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (result.snapshot) {
      snapshot = result.snapshot;
      startPolling();
      render();
    }
    callback?.(result);
  } catch {
    callback?.({ ok: false, message: "Could not reach the server." });
  }
}

function currentGame() {
  return snapshot?.game || null;
}

function mySeat() {
  return snapshot?.you?.seat ?? null;
}

function isPlayer() {
  return mySeat() === 0 || mySeat() === 1;
}

function isMyTurn() {
  const game = currentGame();
  return isPlayer() && game.current === mySeat() && !game.gameOver;
}

function myPlayer() {
  const seat = mySeat();
  return seat === null ? null : currentGame()?.players[seat] || null;
}

function topCard(tile) {
  return tile.stack[tile.stack.length - 1] || null;
}

function countTokens(tokens) {
  return Object.values(tokens || {}).reduce((total, value) => total + value, 0);
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

function getCardHint(value) {
  if (value === 3) return "Cannot cover.";
  if (value === 4) return "Shoots diagonal.";
  if (value === 5) return "Shoots straight.";
  if (value === 6) return "Stuns tile.";
  if (value === 14) return "Locks tile.";
  return "Place or cover.";
}

function getCardInspectInfo(value) {
  return {
    title: CARD_NAMES[value],
    meta: `Card ${value}`,
    body: `${CARD_DETAILS[value] || getCardHint(value)} ${getCardHint(value)}`
  };
}

function getTokenInspectInfo(token) {
  return {
    title: token.label,
    meta: "Token",
    body: TOKEN_DETAILS[token.id] || "Use this token on a valid tile during your turn."
  };
}

function resetRenderMemory() {
  previousHandValues = [];
  previousTokenCounts = {};
  previousBoardTopKeys = [];
  previousBoardTokenKeys = [];
}

function openInspect(info) {
  if (!info) return;
  inspectTitle.textContent = info.title;
  inspectMeta.textContent = info.meta;
  inspectBody.textContent = info.body;
  inspectOverlay.classList.add("show");
  inspectOverlay.setAttribute("aria-hidden", "false");
}

function closeInspect() {
  inspectOverlay.classList.remove("show");
  inspectOverlay.setAttribute("aria-hidden", "true");
}

function bindHoldInfo(element, getInfo, delay = 560) {
  let holdTimer = null;
  let startX = 0;
  let startY = 0;

  const clearHold = () => {
    window.clearTimeout(holdTimer);
    holdTimer = null;
    element.classList.remove("is-holding");
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    element.classList.add("is-holding");
    holdTimer = window.setTimeout(() => {
      element.dataset.suppressClick = "true";
      element.classList.remove("is-holding");
      openInspect(getInfo());
    }, delay);
  });

  element.addEventListener("pointermove", (event) => {
    if (!holdTimer) return;
    if (Math.abs(event.clientX - startX) > 12 || Math.abs(event.clientY - startY) > 12) clearHold();
  });
  element.addEventListener("pointerup", clearHold);
  element.addEventListener("pointercancel", clearHold);
  element.addEventListener("pointerleave", clearHold);
}

function consumeHeldClick(element) {
  if (Date.now() < suppressPieceClickUntil) return true;
  if (element.dataset.suppressClick !== "true") return false;
  delete element.dataset.suppressClick;
  return true;
}

function tapFeedback(element) {
  element.classList.remove("tap-feedback");
  void element.offsetWidth;
  element.classList.add("tap-feedback");
  window.setTimeout(() => element.classList.remove("tap-feedback"), 280);
  if (navigator.vibrate) navigator.vibrate(9);
}

function setInspectOrigin(element, finalWidth) {
  const rect = element.getBoundingClientRect();
  const fromX = rect.left + rect.width / 2 - window.innerWidth / 2;
  const fromY = rect.top + rect.height / 2 - window.innerHeight * 0.45;
  const scale = Math.max(0.2, Math.min(0.8, rect.width / finalWidth));
  document.documentElement.style.setProperty("--inspect-from-x", `${fromX}px`);
  document.documentElement.style.setProperty("--inspect-from-y", `${fromY}px`);
  document.documentElement.style.setProperty("--inspect-from-scale", scale.toFixed(3));
}

function inspectCardFromElement(card, index, value) {
  setInspectOrigin(card, Math.min(window.innerWidth * 0.82, 315));
  suppressPieceClickUntil = Date.now() + 520;
  inspectedCardIndex = index;
  inspectedTokenId = null;
  selectedCardIndex = null;
  selectedToken = null;
  heldCardIndex = null;
  heldTokenId = null;
  deckExpanded = false;
  localMessage = `${CARD_NAMES[value]} revealed.`;
  render();
}

function inspectTokenFromElement(button, token) {
  setInspectOrigin(button, Math.min(window.innerWidth * 0.76, 292));
  suppressPieceClickUntil = Date.now() + 520;
  inspectedTokenId = token.id;
  inspectedCardIndex = null;
  selectedCardIndex = null;
  selectedToken = null;
  heldCardIndex = null;
  heldTokenId = null;
  deckExpanded = false;
  localMessage = `${token.label} revealed.`;
  render();
}

function getDeckLayout(index) {
  return DECK_CARD_LAYOUTS[index] || {
    x: (index - 2.5) * 20,
    y: 10,
    r: 0,
    openX: (index - 2.5) * 42,
    openY: 20,
    openR: 0,
    z: index + 1
  };
}

function getTokenLayout(index) {
  return TOKEN_LAYOUTS[index] || {
    x: 0,
    y: index * 4,
    openX: index % 2 === 0 ? -8 : 10,
    openY: -18 - index * 22,
    z: index + 1
  };
}

function clearHandFocus() {
  inspectedCardIndex = null;
  inspectedTokenId = null;
  heldCardIndex = null;
  heldTokenId = null;
  selectedCardIndex = null;
  selectedToken = null;
}

function tuckPlayPieces() {
  deckExpanded = false;
  showingTokens = false;
  inspectedCardIndex = null;
  inspectedTokenId = null;
  heldCardIndex = null;
  heldTokenId = null;
  selectedCardIndex = null;
  selectedToken = null;
  clearCardDrag();
  clearTokenDrag();
}

function isInsideDeckArea(x, y) {
  const deckRect = handEl.getBoundingClientRect();
  return x >= deckRect.left && x <= deckRect.right && y >= deckRect.top && y <= deckRect.bottom;
}

function isInsideTokenArea(x, y) {
  const tokenRect = tokenPanelBtn.getBoundingClientRect();
  const tokensRect = tokensEl.getBoundingClientRect();
  const left = Math.min(tokenRect.left, tokensRect.left);
  const right = Math.max(tokenRect.right, tokensRect.right);
  const top = Math.min(tokenRect.top, tokensRect.top);
  const bottom = Math.max(tokenRect.bottom, tokensRect.bottom);
  return x >= left - 24 && x <= right + 24 && y >= top - 144 && y <= bottom + 24;
}

function canPlaceCard(first, second, third) {
  if (first && typeof first === "object" && Array.isArray(first.board)) {
    return canPlaceCardInGame(first, second, third);
  }
  const game = currentGame();
  if (!game) return false;
  return canPlaceCardInGame(game, first, second);
}

function canPlaceCardInGame(game, index, value) {
  const tile = game.board[index];
  if (!tile) return false;
  const top = topCard(tile);
  if (tile.locked || tile.stunTurns > 0 || top?.stunned) return false;
  if (!top) return true;
  if (top.value === 14) return false;
  if (top.value === 3) return false;
  return value >= top.value;
}

function isSelectableTile(index) {
  const game = currentGame();
  const player = myPlayer();
  if (!game || !player || !isMyTurn()) return false;
  if (game.pendingWitchTile !== null) return true;
  if (game.pendingShot) return false;
  if (selectedToken) return true;
  if (selectedCardIndex === null) return false;
  return canPlaceCard(index, player.hand[selectedCardIndex]);
}

function clearBoardDragTargets() {
  boardEl.classList.remove("drag-targeting");
  boardEl.querySelectorAll(".tile").forEach((tile) => {
    tile.classList.remove("drag-selectable", "drag-hover");
  });
}

function updateBoardDragTargets(value, hoverIndex = null) {
  const game = currentGame();
  if (!game || !isMyTurn()) return;
  boardEl.classList.add("drag-targeting");
  boardEl.querySelectorAll(".tile").forEach((tile) => {
    const tileIndex = Number(tile.dataset.tileIndex);
    const valid = Number.isInteger(tileIndex) && canPlaceCard(tileIndex, value);
    tile.classList.toggle("drag-selectable", valid);
    tile.classList.toggle("drag-hover", valid && tileIndex === hoverIndex);
  });
}

function updateTokenDragTargets(hoverIndex = null) {
  const game = currentGame();
  if (!game || !isMyTurn()) return;
  boardEl.classList.add("drag-targeting");
  boardEl.querySelectorAll(".tile").forEach((tile) => {
    const tileIndex = Number(tile.dataset.tileIndex);
    const valid = Number.isInteger(tileIndex);
    tile.classList.toggle("drag-selectable", valid);
    tile.classList.toggle("drag-hover", valid && tileIndex === hoverIndex);
  });
}

function getTileIndexAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const tile = element?.closest?.(".tile");
  if (!tile || !boardEl.contains(tile)) return null;
  const index = Number(tile.dataset.tileIndex);
  return Number.isInteger(index) ? index : null;
}

function updateDragGhostPosition(x, y) {
  if (!draggedCard?.ghost) return;
  draggedCard.ghost.style.left = `${x}px`;
  draggedCard.ghost.style.top = `${y}px`;
}

function animateCardToTile(handIndex, tileIndex) {
  const source = handEl.querySelector(`[data-hand-index="${handIndex}"]`);
  const target = boardEl.querySelector(`[data-tile-index="${tileIndex}"]`);
  if (!source || !target) return;

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  ghost.classList.remove("selected", "held-card", "inspected", "drawn-card");
  ghost.classList.add("drag-ghost", "place-ghost");
  ghost.style.width = `${sourceRect.width}px`;
  ghost.style.height = `${sourceRect.height}px`;
  ghost.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  ghost.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  document.body.appendChild(ghost);

  window.requestAnimationFrame(() => {
    ghost.style.left = `${targetRect.left + targetRect.width / 2}px`;
    ghost.style.top = `${targetRect.top + targetRect.height / 2}px`;
    ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(.74)";
    ghost.style.opacity = ".94";
  });
  window.setTimeout(() => ghost.remove(), 300);
}

function animateDraggedCardToTile(ghost, tileIndex) {
  const target = boardEl.querySelector(`[data-tile-index="${tileIndex}"]`);
  if (!ghost || !target) {
    ghost?.remove();
    return;
  }

  const targetRect = target.getBoundingClientRect();
  ghost.classList.add("place-ghost");
  ghost.style.transition = "";
  window.requestAnimationFrame(() => {
    ghost.style.left = `${targetRect.left + targetRect.width / 2}px`;
    ghost.style.top = `${targetRect.top + targetRect.height / 2}px`;
    ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(.74)";
    ghost.style.opacity = ".94";
  });
  window.setTimeout(() => ghost.remove(), 320);
}

function clearCardDrag() {
  sendCardDragPreview(null, false);
  draggedCard?.ghost?.remove();
  draggedCard?.card?.classList.remove("drag-source");
  draggedCard = null;
  dragCandidate = null;
  handEl.classList.remove("deck-dragging", "deck-holding");
  handEl.querySelectorAll(".held-card").forEach((card) => card.classList.remove("held-card"));
  gameShell.classList.remove("dragging-card");
  clearBoardDragTargets();
}

function clearTokenDrag() {
  draggedToken?.ghost?.remove();
  draggedToken?.button?.classList.remove("drag-source");
  draggedToken = null;
  tokenDragCandidate = null;
  tokensEl.classList.remove("token-dragging", "token-holding");
  tokensEl.querySelectorAll(".held-token").forEach((token) => token.classList.remove("held-token"));
  gameShell.classList.remove("dragging-token");
  clearBoardDragTargets();
}

function startCardDrag(candidate, event) {
  if (!deckExpanded || !candidate || draggedCard || inspectOverlay.classList.contains("show")) return;
  if (candidate.isUnavailable) return;
  if (inspectedCardIndex !== null || inspectedTokenId !== null) return;
  if (candidate.card.dataset.suppressClick === "true") return;

  selectedCardIndex = candidate.index;
  selectedToken = null;
  inspectedCardIndex = null;
  inspectedTokenId = null;
  heldCardIndex = candidate.index;
  heldTokenId = null;

  const rect = candidate.card.getBoundingClientRect();
  const ghost = candidate.card.cloneNode(true);
  ghost.classList.remove("selected", "held-card", "inspected", "drawn-card", "is-holding");
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);

  candidate.card.dataset.suppressClick = "true";
  candidate.card.classList.add("drag-source");
  handEl.classList.add("deck-dragging");
  gameShell.classList.add("dragging-card");

  draggedCard = { ...candidate, ghost };
  const hoverIndex = getTileIndexAtPoint(event.clientX, event.clientY);
  updateBoardDragTargets(candidate.value, hoverIndex);
  sendCardDragPreview(hoverIndex, true);
  updateDragGhostPosition(event.clientX, event.clientY);
}

function finishCardDrag(event) {
  if (!draggedCard) return;
  const { index, value, ghost } = draggedCard;
  const tileIndex = getTileIndexAtPoint(event.clientX, event.clientY);
  if (tileIndex !== null && canPlaceCard(tileIndex, value)) {
    draggedCard.ghost = null;
  }
  clearCardDrag();

  if (tileIndex === null) {
    deckExpanded = true;
    heldCardIndex = null;
    selectedCardIndex = null;
    inspectedCardIndex = null;
    if (isInsideDeckArea(event.clientX, event.clientY)) {
      setLocalMessage("Card returned to the deck.");
      return;
    }
    setLocalMessage("Drag a card onto a valid tile, or release it over the deck.");
    return;
  }

  if (!canPlaceCard(tileIndex, value)) {
    deckExpanded = true;
    heldCardIndex = null;
    selectedCardIndex = null;
    setLocalMessage("That tile cannot take this card.");
    return;
  }

  selectedCardIndex = index;
  selectedToken = null;
  animateDraggedCardToTile(ghost, tileIndex);
  sendAction({ type: "placeCard", handIndex: index, tileIndex });
}

function updateCardDragFromPointer(event) {
  if (!dragCandidate || dragCandidate.pointerId !== event.pointerId) return;
  if (inspectOverlay.classList.contains("show")) return;
  window.clearTimeout(dragCandidate.holdTimer);
  const dx = event.clientX - dragCandidate.startX;
  const dy = event.clientY - dragCandidate.startY;
  if (!dragCandidate.dragging && Math.hypot(dx, dy) > 10) {
    dragCandidate.dragging = true;
    startCardDrag(dragCandidate, event);
  }
  if (!dragCandidate.dragging || !draggedCard) return;
  event.preventDefault();
  const hoverIndex = getTileIndexAtPoint(event.clientX, event.clientY);
  updateBoardDragTargets(dragCandidate.value, hoverIndex);
  sendCardDragPreview(hoverIndex, true);
  updateDragGhostPosition(event.clientX, event.clientY);
}

function endCardDragFromPointer(event, cancelled = false) {
  if (!dragCandidate || dragCandidate.pointerId !== event.pointerId) return;
  const wasDragging = dragCandidate.dragging;
  try {
    dragCandidate.card.releasePointerCapture(event.pointerId);
  } catch {
    // Ignore capture release failures from browser-generated cleanup.
  }
  if (wasDragging) {
    event.preventDefault();
    if (cancelled) {
      deckExpanded = true;
      heldCardIndex = null;
      selectedCardIndex = null;
      clearCardDrag();
      render();
      return;
    }
    finishCardDrag(event);
    return;
  }
  window.clearTimeout(dragCandidate.holdTimer);
  dragCandidate = null;
}

function bindCardDrag(card, index, value, isUnavailable) {
  card.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (!deckExpanded || !isMyTurn()) return;
    if (inspectedCardIndex !== null || inspectedTokenId !== null) return;
    dragCandidate = {
      card,
      index,
      value,
      isUnavailable,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      holdTimer: null,
      dragging: false
    };
    dragCandidate.holdTimer = window.setTimeout(() => {
      if (!dragCandidate || dragCandidate.card !== card || dragCandidate.pointerId !== event.pointerId) return;
      card.dataset.suppressClick = "true";
      dragCandidate = null;
      inspectCardFromElement(card, index, value);
    }, 330);
    try {
      card.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic pointer events cannot be captured.
    }
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragCandidate || dragCandidate.card !== card || dragCandidate.pointerId !== event.pointerId) return;
    updateCardDragFromPointer(event);
  });

  card.addEventListener("pointerup", (event) => {
    endCardDragFromPointer(event);
  });

  card.addEventListener("pointercancel", (event) => {
    endCardDragFromPointer(event, true);
  });
}

function updateTokenGhostPosition(x, y) {
  if (!draggedToken?.ghost) return;
  draggedToken.ghost.style.left = `${x}px`;
  draggedToken.ghost.style.top = `${y}px`;
}

function animateTokenToTile(tokenId, tileIndex) {
  const source = tokensEl.querySelector(`[data-token-id="${tokenId}"]`);
  const target = boardEl.querySelector(`[data-tile-index="${tileIndex}"]`);
  if (!source || !target) return;

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  ghost.classList.remove("selected", "held-token", "inspected", "token-enter", "token-changed", "is-holding");
  ghost.classList.add("drag-ghost", "place-ghost");
  ghost.style.width = `${sourceRect.width}px`;
  ghost.style.height = `${sourceRect.height}px`;
  ghost.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  ghost.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  document.body.appendChild(ghost);

  window.requestAnimationFrame(() => {
    ghost.style.left = `${targetRect.left + targetRect.width / 2}px`;
    ghost.style.top = `${targetRect.top + targetRect.height / 2}px`;
    ghost.style.transform = "translate(-50%, -50%) scale(.48)";
    ghost.style.opacity = ".35";
  });
  window.setTimeout(() => ghost.remove(), 300);
}

function startTokenDrag(candidate, event) {
  if (!showingTokens || !candidate || draggedToken || inspectOverlay.classList.contains("show")) return;
  if (candidate.isUnavailable) return;
  if (inspectedCardIndex !== null || inspectedTokenId !== null) return;
  if (candidate.button.dataset.suppressClick === "true") return;

  selectedToken = candidate.id;
  selectedCardIndex = null;
  inspectedCardIndex = null;
  inspectedTokenId = null;
  heldCardIndex = null;
  heldTokenId = candidate.id;

  const rect = candidate.button.getBoundingClientRect();
  const ghost = candidate.button.cloneNode(true);
  ghost.classList.remove("selected", "held-token", "inspected", "token-enter", "token-changed", "is-holding");
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);

  candidate.button.dataset.suppressClick = "true";
  candidate.button.classList.add("drag-source");
  tokensEl.classList.add("token-dragging");
  gameShell.classList.add("dragging-token");

  draggedToken = { ...candidate, ghost };
  updateTokenDragTargets(getTileIndexAtPoint(event.clientX, event.clientY));
  updateTokenGhostPosition(event.clientX, event.clientY);
}

function finishTokenDrag(event) {
  if (!draggedToken) return;
  const { id } = draggedToken;
  const game = currentGame();
  const tileIndex = getTileIndexAtPoint(event.clientX, event.clientY);
  clearTokenDrag();

  if (tileIndex === null) {
    showingTokens = true;
    heldTokenId = null;
    selectedToken = null;
    if (isInsideTokenArea(event.clientX, event.clientY)) {
      setLocalMessage("Token returned to the pile.");
      return;
    }
    setLocalMessage("Drag a token onto a tile, or release it over the token pile.");
    return;
  }

  if (game?.pendingShot && id === "pierce") {
    selectedToken = id;
    sendAction({ type: "armorPierce" });
    return;
  }

  selectedToken = id;
  animateTokenToTile(id, tileIndex);
  sendAction({ type: "useToken", tokenType: id, tileIndex });
}

function updateTokenDragFromPointer(event) {
  if (!tokenDragCandidate || tokenDragCandidate.pointerId !== event.pointerId) return;
  if (inspectOverlay.classList.contains("show")) return;
  window.clearTimeout(tokenDragCandidate.holdTimer);
  const dx = event.clientX - tokenDragCandidate.startX;
  const dy = event.clientY - tokenDragCandidate.startY;
  if (!tokenDragCandidate.dragging && Math.hypot(dx, dy) > 9) {
    tokenDragCandidate.dragging = true;
    startTokenDrag(tokenDragCandidate, event);
  }
  if (!tokenDragCandidate.dragging || !draggedToken) return;
  event.preventDefault();
  const hoverIndex = getTileIndexAtPoint(event.clientX, event.clientY);
  updateTokenDragTargets(hoverIndex);
  updateTokenGhostPosition(event.clientX, event.clientY);
}

function endTokenDragFromPointer(event, cancelled = false) {
  if (!tokenDragCandidate || tokenDragCandidate.pointerId !== event.pointerId) return;
  const wasDragging = tokenDragCandidate.dragging;
  try {
    tokenDragCandidate.button.releasePointerCapture(event.pointerId);
  } catch {
    // Ignore capture release failures from browser-generated cleanup.
  }
  if (wasDragging) {
    event.preventDefault();
    if (cancelled) {
      showingTokens = true;
      heldTokenId = null;
      selectedToken = null;
      clearTokenDrag();
      render();
      return;
    }
    finishTokenDrag(event);
    return;
  }
  window.clearTimeout(tokenDragCandidate.holdTimer);
  tokenDragCandidate = null;
}

function bindTokenDrag(button, token, isUnavailable) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (!showingTokens || !isMyTurn()) return;
    if (inspectedCardIndex !== null || inspectedTokenId !== null) return;
    tokenDragCandidate = {
      button,
      id: token.id,
      isUnavailable,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      holdTimer: null,
      dragging: false
    };
    tokenDragCandidate.holdTimer = window.setTimeout(() => {
      if (!tokenDragCandidate || tokenDragCandidate.button !== button || tokenDragCandidate.pointerId !== event.pointerId) return;
      button.dataset.suppressClick = "true";
      tokenDragCandidate = null;
      inspectTokenFromElement(button, token);
    }, 330);
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic pointer events cannot be captured.
    }
  });

  button.addEventListener("pointermove", (event) => {
    if (!tokenDragCandidate || tokenDragCandidate.button !== button || tokenDragCandidate.pointerId !== event.pointerId) return;
    updateTokenDragFromPointer(event);
  });

  button.addEventListener("pointerup", (event) => {
    endTokenDragFromPointer(event);
  });

  button.addEventListener("pointercancel", (event) => {
    endTokenDragFromPointer(event, true);
  });
}

function isTargetableTile(index) {
  const game = currentGame();
  return !!game?.pendingShot && game.pendingShot.targets.includes(index);
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

function emptyTile() {
  return { stack: [], tokens: [], stunnedBy: null, stunTurns: 0, locked: false };
}

function createLocalPlayer(id) {
  const deck = shuffleCards(Array.from({ length: 14 }, (_value, index) => index + 1));
  const tokens = {};
  TOKEN_TYPES.forEach((token) => {
    tokens[token.id] = LOCAL_TOKEN_COUNTS[token.id] || 0;
  });
  return { id, deck, hand: [], tokens };
}

function createLocalGame(playerName) {
  const game = {
    board: Array.from({ length: 16 }, emptyTile),
    players: [createLocalPlayer(1), createLocalPlayer(2)],
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
    lastMessage: "Offline quickplay begins. You go first."
  };
  game.players[0].name = playerName || "Jester";
  game.players[0].rank = "Jester Initiate";
  game.players[1].name = BOT_NAME;
  game.players[1].rank = BOT_RANK;
  drawUpToSix(game.players[0]);
  drawUpToSix(game.players[1]);
  refreshLocalPlayerStats(game);
  return game;
}

function refreshLocalPlayerStats(game = currentGame()) {
  if (!game) return;
  game.players.forEach((player, index) => {
    player.connected = true;
    player.ready = true;
    player.handCount = player.hand.length;
    player.deckCount = player.deck.length;
    player.tokenTotal = countTokens(player.tokens);
    if (index === 0) {
      player.name = player.name || "Jester";
      player.rank = player.rank || "Jester Initiate";
    } else {
      player.name = BOT_NAME;
      player.rank = BOT_RANK;
    }
  });
}

function shuffleCards(cards) {
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

function setMessage(game, text) {
  game.lastMessage = text;
}

function performOfflineAction(action) {
  const game = currentGame();
  if (!game) return fail("Start quickplay first.");

  if (action.type === "restart") {
    const name = playerNameInput.value.trim() || game.players[0]?.name || "Jester";
    snapshot.game = createLocalGame(name);
    localMessage = "";
    resetRenderMemory();
    return ok();
  }

  if (action.type === "ready") return ok("Offline quickplay is already underway.");
  if (game.gameOver) return fail("The match is over.");
  if (game.current !== 0) return fail(`${BOT_NAME} is taking its turn.`);

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
    setMessage(game, `${player.name || `Player ${player.id}`} placed ${value} - ${CARD_NAMES[value]}.`);
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
  setMessage(game, `Shot landed. ${game.players[removed.owner - 1].name}'s ${removed.value} was removed.`);
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
  setMessage(game, `${game.players[winner - 1].name || `Player ${winner}`} wins.`);
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
  setMessage(game, `${currentPlayer(game).name || `Player ${currentPlayer(game).id}`}'s turn. Drawn up to 6 cards.`);
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

function scheduleOfflineBotTurn() {
  if (!isOfflineQuickplay() || currentGame()?.current !== 1 || currentGame()?.gameOver) return;
  window.clearTimeout(botTurnTimer);
  localMessage = `${BOT_NAME} is thinking...`;
  render();
  botTurnTimer = window.setTimeout(() => {
    if (!isOfflineQuickplay() || currentGame()?.current !== 1 || currentGame()?.gameOver) return;
    runBotTurn({ mode: "quickplay", phase: "playing", botSeat: 1, game: currentGame() });
    refreshLocalPlayerStats();
    localMessage = "";
    clearHandFocus();
    render();
  }, 520);
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
    else cancelSelection(game);
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
    const score = card.value * 90 + tileLinePressure(game, index, card.owner) + (card.protected ? -160 : 0);
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
    if (index === game.pendingWitchTile) return;
    const card = topCard(tile);
    if (!card || card.owner !== enemyId || card.stunned || tile.stunTurns > 0) return;
    const score = card.value * 85 + tileLinePressure(game, index, enemyId);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });

  return best;
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
  if (value === 6) score += 180 + bestEnemyTileValue(game) * 12;
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

function bestEnemyTileValue(game) {
  const botId = currentPlayer(game).id;
  return game.board.reduce((best, tile) => {
    const card = topCard(tile);
    return card && card.owner !== botId ? Math.max(best, card.value) : best;
  }, 0);
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

function render() {
  if (!snapshot) {
    boardEl.innerHTML = "";
    return;
  }

  if (isOfflineQuickplay()) refreshLocalPlayerStats();

  if (renderRoomCode !== snapshot.room.code) {
    renderRoomCode = snapshot.room.code;
    resetRenderMemory();
    previousRoomPhase = "";
    previousPlayerTwoConnected = false;
  }

  const phase = snapshot.room.phase || "playing";
  const phaseChanged = previousRoomPhase !== phase;
  if (phaseChanged) {
    resetRenderMemory();
    previousShowingTokens = false;
    deckExpanded = false;
    showingTokens = false;
    inspectedCardIndex = null;
    inspectedTokenId = null;
    heldCardIndex = null;
    heldTokenId = null;
    selectedToken = null;
    selectedCardIndex = null;
    remoteDragPreview = null;
    lastSentCardDragTile = null;
    clearCardDrag();
    clearTokenDrag();
  }

  renderWaitingRoom();
  const playing = isMatchPlaying();
  waitingRoom.classList.toggle("show", !playing);
  gameShell.classList.toggle("hidden", !playing);

  if (!playing) {
    gameShell.classList.remove("inspecting-piece", "dragging-card", "dragging-token");
    previousRoomPhase = phase;
    renderWin();
    return;
  }

  gameShell.classList.toggle("inspecting-piece", inspectedCardIndex !== null || inspectedTokenId !== null);
  renderStatus();
  renderBoard();
  renderHand();
  renderTokens();
  renderTokenView();
  renderWin();
  if (phaseChanged) showTurnIntro();
  previousRoomPhase = phase;
}

function renderWaitingRoom() {
  if (!snapshot) return;
  const players = snapshot.game.players;
  const playerOne = players[0];
  const playerTwo = players[1];
  const bothConnected = players.every((player) => player.connected);
  const seat = mySeat();
  const myPlayerState = seat === 0 || seat === 1 ? players[seat] : null;
  const playerTwoJustJoined = playerTwo.connected && !previousPlayerTwoConnected;

  waitingRoomCode.textContent = snapshot.room.code;
  document.getElementById("waitingNameOne").textContent = playerOne.name || "Player 1";
  document.getElementById("waitingNameTwo").textContent = playerTwo.connected ? (playerTwo.name || "Player 2") : "Awaiting Player";
  document.getElementById("waitingRankOne").textContent = playerOne.rank || "Jester Initiate";
  document.getElementById("waitingRankTwo").textContent = playerTwo.rank || "Masked Challenger";
  document.getElementById("waitingAvatarOne").textContent = playerInitials(playerOne.name, "P1");
  document.getElementById("waitingAvatarTwo").textContent = playerTwo.connected ? playerInitials(playerTwo.name, "P2") : "P2";
  document.getElementById("waitingReadyOne").textContent = playerOne.ready ? "Ready" : "Waiting";
  document.getElementById("waitingReadyTwo").textContent = playerTwo.ready ? "Ready" : "Waiting";
  document.getElementById("waitingReadyOne").classList.toggle("ready", playerOne.ready);
  document.getElementById("waitingReadyTwo").classList.toggle("ready", playerTwo.ready);
  document.getElementById("waitingPlayerOne").classList.toggle("connected", playerOne.connected);
  document.getElementById("waitingPlayerTwo").classList.toggle("connected", playerTwo.connected);
  document.getElementById("waitingPlayerTwo").classList.toggle("joined-now", playerTwoJustJoined);
  waitingJoinBanner.classList.toggle("show", playerTwoJustJoined || (playerTwo.connected && !playerTwo.ready));

  if (!bothConnected) {
    waitingStatus.textContent = "Share the code. The duel begins after both players ready up.";
  } else if (players.every((player) => player.ready)) {
    waitingStatus.textContent = "Both duelists are ready. Opening the board...";
  } else if (myPlayerState?.ready) {
    waitingStatus.textContent = "You are ready. Waiting for your opponent.";
  } else {
    waitingStatus.textContent = "Both players are here. Tap Ready to begin.";
  }

  readyBtn.disabled = !bothConnected || !myPlayerState || myPlayerState.ready;
  readyBtn.textContent = myPlayerState?.ready ? "Ready Locked" : "Ready";
  previousPlayerTwoConnected = playerTwo.connected;
}

function renderStatus() {
  const game = currentGame();
  const seat = mySeat();
  const players = game.players;
  const topIndex = seat === 1 ? 0 : 1;
  const bottomIndex = seat === 1 ? 1 : 0;
  const top = players[topIndex];
  const bottom = players[bottomIndex];
  const current = players[game.current];

  document.getElementById("roomCodeDisplay").textContent = isOfflineQuickplay() ? "Offline Bot" : (snapshot.room.mode === "quickplay" ? "Quickplay" : `Room ${snapshot.room.code}`);
  document.getElementById("seatLabel").textContent = isOfflineQuickplay() ? (isMyTurn() ? "Your Turn" : "Bot Turn") : (seat === null ? "Spectator" : `Player ${seat + 1}`);
  document.getElementById("onlineStatus").textContent = isOfflineQuickplay() ? "Local" : (socketOpen() || usingHttpFallback ? "Online" : "Offline");
  document.getElementById("opponentName").textContent = top.name || `Player ${topIndex + 1}`;
  document.getElementById("opponentTitle").textContent = top.connected ? (top.rank || `Player ${topIndex + 1}`) : "Disconnected";
  document.getElementById("opponentInfo").textContent = `C ${top.handCount} - T ${top.tokenTotal}`;
  document.getElementById("opponentDeck").textContent = `Deck ${top.deckCount}`;
  document.getElementById("playerNameLabel").textContent = bottom.name || `Player ${bottomIndex + 1}`;
  document.getElementById("playerTitle").textContent = bottom.rank || `Player ${bottomIndex + 1}`;
  document.getElementById("playerInfo").textContent = `C ${bottom.handCount} - T ${bottom.tokenTotal}`;
  document.getElementById("playerDeck").textContent = `Deck ${bottom.deckCount}`;

  const opponentCards = document.getElementById("opponentCards");
  opponentCards.innerHTML = "";
  for (let i = 0; i < top.handCount; i += 1) {
    const card = document.createElement("span");
    card.className = "card-back";
    opponentCards.appendChild(card);
  }

  turnLabel.textContent = game.gameOver ? "Game Over" : `${current.name || `Player ${game.current + 1}`} Turn`;
  tokenLimit.textContent = `${game.tokensUsed}/2`;
  cancelBtn.textContent = game.pendingShot ? "Skip" : "Cancel";
  messageEl.textContent = localMessage || game.lastMessage || "Make your move.";
  document.getElementById("endTurnBtn").disabled = !isMyTurn() || !game.cardPlacedThisTurn;
  cancelBtn.disabled = !isMyTurn();
}

function renderBoard() {
  const game = currentGame();
  const hadBoardMemory = previousBoardTopKeys.length > 0;
  const nextTopKeys = [];
  const nextTokenKeys = [];
  boardEl.innerHTML = "";
  game.board.forEach((tile, index) => {
    const tileEl = document.createElement("button");
    tileEl.className = "tile";
    tileEl.dataset.tileIndex = String(index);
    const top = topCard(tile);
    const topKey = top ? `${top.owner}:${top.value}:${tile.stack.length}:${tile.locked}:${top.stunned}:${tile.stunTurns}` : "empty";
    const tokenKeys = tile.tokens.map((token, tokenIndex) => String(token.id ?? `${token.owner}-${token.type}-${tokenIndex}`));
    const previousTileTokens = new Set(previousBoardTokenKeys[index] || []);
    nextTopKeys[index] = topKey;
    nextTokenKeys[index] = tokenKeys;

    if (tile.stunTurns > 0 || top?.stunned) tileEl.classList.add("stunned");
    if (game.lastPlacedTileIndex === index) tileEl.classList.add("last-placed");
    if (isSelectableTile(index)) tileEl.classList.add("selectable");
    if (isTargetableTile(index)) tileEl.classList.add("targetable");
    if (remoteDragPreview?.tileIndex === index) tileEl.classList.add("remote-drag-hover");

    if (top) {
      const card = document.createElement("div");
      card.className = `card p${top.owner}-card`;
      if (top.value === 14 || tile.locked) card.classList.add("locked");
      if (top.stunned || tile.stunTurns > 0) card.classList.add("stunned");
      if (game.pendingShot && game.pendingShot.fromIndex === index) card.classList.add("shooter-ready");
      card.innerHTML = `
        <div class="power-badge">${effectiveValue(top, tile)}</div>
        <div class="suit-badge">JG</div>
        <div class="card-art"></div>
        <div class="card-name">${CARD_NAMES[top.value]}</div>
      `;

      const strip = document.createElement("div");
      strip.className = "token-strip";
      tile.tokens.forEach((token, tokenIndex) => {
        const marker = document.createElement("span");
        marker.className = "mini-token";
        const tokenKey = String(token.id ?? `${token.owner}-${token.type}-${tokenIndex}`);
        if (hadBoardMemory && !previousTileTokens.has(tokenKey)) marker.classList.add("token-added");
        marker.textContent = TOKEN_TYPES.find((item) => item.id === token.type)?.icon || "?";
        strip.appendChild(marker);
      });
      card.appendChild(strip);
      tileEl.appendChild(card);
    }

    if (remoteDragPreview?.tileIndex === index) {
      const preview = document.createElement("div");
      preview.className = `remote-card-preview p${(remoteDragPreview.seat ?? 0) + 1}-card`;
      preview.innerHTML = `<span>JG</span>`;
      tileEl.appendChild(preview);
    }

    tileEl.addEventListener("click", () => onTileClick(index));
    boardEl.appendChild(tileEl);
  });
  previousBoardTopKeys = nextTopKeys;
  previousBoardTokenKeys = nextTokenKeys;
}

function renderHand() {
  const game = currentGame();
  const player = myPlayer();
  const hadHandMemory = previousHandValues.length > 0;
  handEl.innerHTML = "";
  handEl.classList.toggle("needs-card-glow", isMyTurn() && inspectedCardIndex === null && inspectedTokenId === null && !game.cardPlacedThisTurn && !game.extraCardPlacement && !game.pendingShot && game.pendingWitchTile === null);
  handEl.classList.toggle("deck-expanded", deckExpanded);
  handEl.classList.toggle("deck-dragging", !!draggedCard);
  handEl.classList.toggle("deck-holding", heldCardIndex !== null && !draggedCard);
  handEl.closest(".hand-panel")?.classList.toggle("deck-expanded", deckExpanded);
  handEl.closest(".hand-panel")?.classList.toggle("deck-dragging", !!draggedCard);
  handEl.closest(".hand-panel")?.classList.toggle("tokens-expanded", showingTokens);

  if (!player) {
    handEl.innerHTML = `<div class="token-view-label show">Spectating</div>`;
    previousHandValues = [];
    return;
  }

  player.hand.forEach((value, index) => {
    const card = document.createElement("button");
    card.className = `hand-card p${player.id}-card`;
    card.draggable = false;
    card.style.setProperty("--draw-order", index);
    const layout = getDeckLayout(index);
    card.style.setProperty("--deck-x", `${layout.x}px`);
    card.style.setProperty("--deck-y", `${layout.y}px`);
    card.style.setProperty("--deck-rot", `${layout.r}deg`);
    card.style.setProperty("--deck-open-x", `${layout.openX}px`);
    card.style.setProperty("--deck-open-y", `${layout.openY}px`);
    card.style.setProperty("--deck-open-rot", `${layout.openR}deg`);
    card.style.setProperty("--deck-z", layout.z);
    card.dataset.handIndex = String(index);
    if (!hadHandMemory || previousHandValues[index] !== value) card.classList.add("drawn-card");
    if (selectedCardIndex === index) card.classList.add("selected");
    if (inspectedCardIndex === index) card.classList.add("inspected");
    if (heldCardIndex === index && !draggedCard) card.classList.add("held-card");
    const isUnavailable = !isMyTurn() || (game.cardPlacedThisTurn && !game.extraCardPlacement) || !!game.pendingShot || game.pendingWitchTile !== null;
    card.classList.toggle("is-disabled", isUnavailable);
    card.setAttribute("aria-disabled", String(isUnavailable));
    card.setAttribute("aria-label", `${CARD_NAMES[value]}, ${value}. ${deckExpanded ? "Tap to select. Hold to inspect, or drag onto the board." : "Tap to open the deck."}`);
    card.innerHTML = `
      <div class="power-badge">${value}</div>
      <div class="suit-badge">JG</div>
      <div class="hand-art"></div>
      <div class="hand-name">${CARD_NAMES[value]}</div>
      <div class="hand-rules">${inspectedCardIndex === index ? CARD_DETAILS[value] : getCardHint(value)}</div>
    `;
    bindCardDrag(card, index, value, isUnavailable);
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      if (consumeHeldClick(card)) return;
      if (!deckExpanded) {
        if (!isMyTurn()) {
          setLocalMessage("Waiting for your turn.");
          return;
        }
        deckExpanded = true;
        inspectedCardIndex = null;
        inspectedTokenId = null;
        heldCardIndex = null;
        heldTokenId = null;
        selectedCardIndex = null;
        selectedToken = null;
        setLocalMessage("Deck opened. Tap a card to select it, hold to inspect it, or drag it.");
        return;
      }
      if (inspectedCardIndex === index) {
        card.classList.add("returning");
        window.setTimeout(() => {
          inspectedCardIndex = null;
          deckExpanded = true;
          selectedCardIndex = null;
          heldCardIndex = null;
          setLocalMessage("Deck opened. Pick your next card.");
        }, 220);
        return;
      }
      if (isUnavailable) {
        setLocalMessage(game.cardPlacedThisTurn && !game.extraCardPlacement ? "You already placed a card this turn." : "That card is not playable right now.");
        tapFeedback(card);
        return;
      }
      selectedCardIndex = index;
      selectedToken = null;
      heldCardIndex = null;
      heldTokenId = null;
      inspectedTokenId = null;
      inspectedCardIndex = null;
      localMessage = `${CARD_NAMES[value]} selected. Tap a tile to place it.`;
      render();
      window.requestAnimationFrame(() => {
        const selected = handEl.querySelector(`[data-hand-index="${index}"]`);
        if (selected) tapFeedback(selected);
      });
    });
    handEl.appendChild(card);
  });
  previousHandValues = [...player.hand];
}

function renderTokens() {
  const game = currentGame();
  const player = myPlayer();
  const nextTokenCounts = {};
  tokensEl.innerHTML = "";

  if (!player) {
    previousTokenCounts = {};
    return;
  }

  TOKEN_TYPES.forEach((token) => {
    const button = document.createElement("button");
    const available = player.tokens[token.id] || 0;
    const tokenIndex = TOKEN_TYPES.findIndex((item) => item.id === token.id);
    const layout = getTokenLayout(tokenIndex);
    nextTokenCounts[token.id] = available;
    button.className = "token-button";
    button.style.setProperty("--draw-order", tokenIndex);
    button.style.setProperty("--token-x", `${layout.x}px`);
    button.style.setProperty("--token-y", `${layout.y}px`);
    button.style.setProperty("--token-open-x", `${layout.openX}px`);
    button.style.setProperty("--token-open-y", `${layout.openY}px`);
    button.style.setProperty("--token-z", layout.z);
    if (showingTokens && !previousShowingTokens) button.classList.add("token-enter");
    if (previousTokenCounts[token.id] !== undefined && previousTokenCounts[token.id] !== available) button.classList.add("token-changed");
    button.dataset.tokenId = token.id;
    button.innerHTML = `
      <span class="token-icon">${token.icon}</span>
      <span class="token-name">${token.label}</span>
      <span class="token-count">x${available}</span>
      <span class="token-detail">${TOKEN_DETAILS[token.id] || "Use this token on a valid tile during your turn."}</span>
    `;
    const isUnavailable = !isMyTurn() || available <= 0 || game.tokensUsed >= 2 || (game.pendingShot && token.id !== "pierce") || game.pendingWitchTile !== null;
    button.classList.toggle("is-disabled", isUnavailable);
    button.setAttribute("aria-disabled", String(isUnavailable));
    if (selectedToken === token.id) button.classList.add("selected");
    if (inspectedTokenId === token.id) button.classList.add("inspected");
    if (heldTokenId === token.id && !draggedToken) button.classList.add("held-token");
    bindTokenDrag(button, token, isUnavailable);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (consumeHeldClick(button)) return;
      if (!showingTokens) {
        if (!isMyTurn()) {
          setLocalMessage("Waiting for your turn.");
          return;
        }
        showingTokens = true;
        selectedToken = null;
        inspectedTokenId = null;
        heldTokenId = null;
        setLocalMessage("Tokens opened. Tap a token to select it, or hold to inspect it.");
        return;
      }
      if (inspectedTokenId === token.id) {
        inspectedTokenId = null;
        setLocalMessage("Token tucked back into the pile.");
        return;
      }
      if (isUnavailable) {
        setLocalMessage(available <= 0 ? "You do not have that token." : "That token is not playable right now.");
        tapFeedback(button);
        return;
      }
      selectedCardIndex = null;
      selectedToken = token.id;
      heldCardIndex = null;
      heldTokenId = null;
      inspectedCardIndex = null;
      inspectedTokenId = null;
      localMessage = `${token.label} selected. Tap a tile to use it.`;
      render();
      window.requestAnimationFrame(() => {
        const selected = tokensEl.querySelector(`[data-token-id="${token.id}"]`);
        if (selected) tapFeedback(selected);
      });
    });
    tokensEl.appendChild(button);
  });
  previousTokenCounts = nextTokenCounts;
}

function renderTokenView() {
  handEl.classList.remove("hidden");
  tokensEl.classList.toggle("hidden", tokensEl.children.length === 0);
  tokensEl.classList.toggle("token-expanded", showingTokens);
  emptyTokenLabel.classList.toggle("show", showingTokens && tokensEl.children.length === 0);
  if (handSectionTitle) handSectionTitle.textContent = "Your Hand";
  const pouchTitle = tokenPanelBtn.querySelector(".pouch-title");
  if (pouchTitle) pouchTitle.textContent = "Tokens";
  tokenPanelBtn.classList.toggle("is-open", showingTokens);
  tokenPanelBtn.setAttribute("aria-pressed", String(showingTokens));
  tokenPanelBtn.setAttribute("aria-label", showingTokens ? "Tuck tokens" : "Open tokens");
  previousShowingTokens = showingTokens;
}

function bindHorizontalWheel(element) {
  element.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    element.scrollBy({ left: event.deltaY, behavior: "auto" });
  }, { passive: false });
}

function showTurnIntro() {
  const game = currentGame();
  const seat = mySeat();
  let text = "The duel begins.";
  let kicker = "Match Begins";
  if (seat === game.current) {
    text = "You go first.";
    kicker = "First Move";
  } else if (seat === 0 || seat === 1) {
    text = "You go second.";
    kicker = "Second Move";
  } else {
    text = `Player ${game.current + 1} goes first.`;
    kicker = "Spectating";
  }

  window.clearTimeout(introTimer);
  turnIntroKicker.textContent = kicker;
  turnIntroText.textContent = text;
  gameShell.classList.add("intro-blur");
  turnIntroOverlay.classList.add("show");
  turnIntroOverlay.setAttribute("aria-hidden", "false");
  introTimer = window.setTimeout(() => {
    turnIntroOverlay.classList.remove("show");
    turnIntroOverlay.setAttribute("aria-hidden", "true");
    gameShell.classList.remove("intro-blur");
  }, 2300);
}

function renderWin() {
  const game = currentGame();
  if (game.gameOver && game.winner) {
    const player = game.players[game.winner - 1];
    winTitle.textContent = `${player.name || `Player ${game.winner}`} Wins!`;
    winText.textContent = "Four in a row.";
    winModal.classList.add("show");
  } else {
    winModal.classList.remove("show");
  }
}

function explainToken(id) {
  const lines = {
    bard: "Bard: tap one of your 1s or 2s to enhance it into a shooter.",
    ammo: "Ammo Crate: tap one of your 4s, 5s, or Bard-enhanced cards to shoot.",
    pierce: "Armor Pierce: use during a shot if you want to destroy a card 10-13.",
    potion: "Curious Potion: tap a stunned tile, or your Witch to stun another tile.",
    parry: "Parry: tap one of your cards to protect it from the next shot."
  };
  localMessage = lines[id] || "";
}

function onTileClick(index) {
  const game = currentGame();
  if (!game || !isMyTurn()) {
    setLocalMessage("Waiting for your turn.");
    return;
  }
  if (inspectedCardIndex !== null || inspectedTokenId !== null) {
    inspectedCardIndex = null;
    inspectedTokenId = null;
    render();
    return;
  }
  if (game.pendingWitchTile !== null) {
    sendAction({ type: "stunTile", tileIndex: index });
    return;
  }
  if (game.pendingShot) {
    if (selectedToken === "pierce") {
      sendAction({ type: "armorPierce" });
      return;
    }
    sendAction({ type: "shoot", tileIndex: index });
    return;
  }
  if (selectedToken) {
    animateTokenToTile(selectedToken, index);
    sendAction({ type: "useToken", tokenType: selectedToken, tileIndex: index });
    return;
  }
  if (selectedCardIndex !== null) {
    const player = myPlayer();
    if (player && canPlaceCard(index, player.hand[selectedCardIndex])) {
      animateCardToTile(selectedCardIndex, index);
    }
    sendAction({ type: "placeCard", handIndex: selectedCardIndex, tileIndex: index });
    return;
  }
  if (deckExpanded || inspectedCardIndex !== null) {
    deckExpanded = false;
    inspectedCardIndex = null;
    heldCardIndex = null;
    selectedCardIndex = null;
    render();
    return;
  }
  sendAction({ type: "removeToken", tileIndex: index }, false);
}

function sendAction(action, clearSelection = true) {
  if (isOfflineQuickplay()) {
    const result = performOfflineAction(action);
    if (!result?.ok) {
      setLocalMessage(result?.message || "That move is not available.");
      return;
    }
    localMessage = "";
    refreshLocalPlayerStats();
    if (clearSelection) {
      selectedCardIndex = null;
      selectedToken = null;
      inspectedCardIndex = null;
      inspectedTokenId = null;
      heldCardIndex = null;
      heldTokenId = null;
      if (action.type === "placeCard") deckExpanded = false;
      if (action.type === "endTurn") {
        deckExpanded = false;
        showingTokens = false;
      }
    }
    render();
    if (action.type === "endTurn" && result.ok) scheduleOfflineBotTurn();
    return;
  }

  sendEvent("gameAction", action, (result) => {
    if (!result?.ok) {
      setLocalMessage(result?.message || "That move is not available.");
      return;
    }
    localMessage = "";
    if (clearSelection) {
      selectedCardIndex = null;
      selectedToken = null;
      inspectedCardIndex = null;
      inspectedTokenId = null;
      heldCardIndex = null;
      heldTokenId = null;
      if (action.type === "placeCard") deckExpanded = false;
      if (action.type === "endTurn") {
        deckExpanded = false;
        showingTokens = false;
      }
    }
  });
}

function createRoom() {
  const name = playerNameInput.value.trim() || "Jester";
  localStorage.setItem("jg-name", name);
  sendEvent("createRoom", { name }, (result) => {
    if (!result?.ok) {
      setMenuStatus(result?.message || "Could not create room.");
      return;
    }
    roomCodeInput.value = result.code;
    window.history.replaceState(null, "", `?room=${result.code}`);
    showScreen("game");
  });
}

function createBotRoom() {
  const name = playerNameInput.value.trim() || "Jester";
  localStorage.setItem("jg-name", name);
  window.clearTimeout(botTurnTimer);
  if (snapshot?.room?.code && !isOfflineQuickplay()) {
    sendEvent("leaveRoom", { code: snapshot.room.code, seat: mySeat() }, () => {});
  }
  stopPolling();
  snapshot = {
    room: {
      code: "",
      mode: "quickplay",
      offline: true,
      phase: "playing",
      ready: [true, true],
      joinedAt: Date.now(),
      startedAt: Date.now()
    },
    you: { seat: 0 },
    game: createLocalGame(name)
  };
  renderRoomCode = "";
  previousRoomPhase = "";
  previousPlayerTwoConnected = true;
  previousShowingTokens = false;
  localMessage = "";
  roomCodeInput.value = "";
  autoJoinAttempted = true;
  window.history.replaceState(null, "", window.location.pathname);
  showScreen("game");
  render();
}

function joinRoom() {
  const name = playerNameInput.value.trim() || "Jester";
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) {
    setMenuStatus("Enter a room code.");
    return;
  }
  localStorage.setItem("jg-name", name);
  sendEvent("joinRoom", { code, name }, (result) => {
    if (!result?.ok) {
      setMenuStatus(result?.message || "Could not join room.");
      return;
    }
    window.history.replaceState(null, "", `?room=${code}`);
    showScreen("game");
  });
}

function leaveRoom() {
  const code = snapshot?.room?.code;
  const seat = mySeat();
  window.clearTimeout(botTurnTimer);
  if (code && !isOfflineQuickplay()) {
    sendEvent("leaveRoom", { code, seat }, () => {});
  }
  snapshot = null;
  renderRoomCode = "";
  previousRoomPhase = "";
  localMessage = "";
  roomCodeInput.value = "";
  autoJoinAttempted = true;
  window.history.replaceState(null, "", window.location.pathname);
  showScreen("menu");
}

async function copyInvite() {
  if (isOfflineQuickplay()) {
    setLocalMessage("Quickplay is offline on this device. No room invite needed.");
    settingsMenu.classList.remove("open");
    return;
  }
  if (!snapshot?.room?.code) return;
  const url = `${window.location.origin}${window.location.pathname}?room=${snapshot.room.code}`;
  try {
    await navigator.clipboard.writeText(url);
    setLocalMessage("Invite link copied.");
  } catch {
    setLocalMessage(url);
  }
  settingsMenu.classList.remove("open");
}

connectRealtime();

document.getElementById("createRoomBtn").addEventListener("click", createRoom);
document.getElementById("joinRoomBtn").addEventListener("click", joinRoom);
quickplayBotBtn.addEventListener("click", createBotRoom);
roomTabBtn.addEventListener("click", () => showMenuTab("room"));
quickplayTabBtn.addEventListener("click", () => showMenuTab("quickplay"));
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});
document.getElementById("rulesBtn").addEventListener("click", () => showScreen("rules"));
document.getElementById("backRules").addEventListener("click", () => showScreen(snapshot ? "game" : "menu"));
document.getElementById("backToMenu").addEventListener("click", () => showScreen("menu"));
waitingBackBtn.addEventListener("click", leaveRoom);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (snapshot) sendAction({ type: "restart" });
});
document.getElementById("endTurnBtn").addEventListener("click", () => sendAction({ type: "endTurn" }));
document.getElementById("cancelBtn").addEventListener("click", () => sendAction({ type: "cancel" }));
window.addEventListener("pointermove", updateCardDragFromPointer, { passive: false });
window.addEventListener("pointerup", endCardDragFromPointer);
window.addEventListener("pointercancel", (event) => endCardDragFromPointer(event, true));
window.addEventListener("pointermove", updateTokenDragFromPointer, { passive: false });
window.addEventListener("pointerup", endTokenDragFromPointer);
window.addEventListener("pointercancel", (event) => endTokenDragFromPointer(event, true));
handEl.addEventListener("click", (event) => {
  if (event.target !== handEl) return;
  if (deckExpanded || showingTokens) return;
  if (!isMyTurn()) {
    setLocalMessage("Waiting for your turn.");
    return;
  }
  deckExpanded = true;
  clearHandFocus();
  setLocalMessage("Deck opened. Tap a card to select it, hold to inspect it, or drag it.");
});
window.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!deckExpanded && !showingTokens && inspectedCardIndex === null && inspectedTokenId === null && heldCardIndex === null && heldTokenId === null && selectedToken === null) return;
  if (target.closest(".settings-menu, .settings-button, .modal, .inspect-overlay, .waiting-room")) return;
  if (inspectedCardIndex !== null) {
    inspectedCardIndex = null;
    deckExpanded = true;
    heldCardIndex = null;
    selectedCardIndex = null;
    render();
    return;
  }
  if (inspectedTokenId !== null) {
    inspectedTokenId = null;
    heldTokenId = null;
    render();
    return;
  }
  if (target.closest(".hand-stage")) return;
  if (target.closest(".tile") && (selectedCardIndex !== null || selectedToken !== null)) return;
  if (deckExpanded) {
    deckExpanded = false;
    selectedCardIndex = null;
    heldCardIndex = null;
    handEl.classList.remove("deck-expanded", "deck-holding");
    handEl.closest(".hand-panel")?.classList.remove("deck-expanded");
    handEl.querySelectorAll(".selected, .held-card").forEach((card) => card.classList.remove("selected", "held-card"));
    renderBoard();
    return;
  }
  selectedToken = null;
  heldTokenId = null;
  render();
});
readyBtn.addEventListener("click", () => sendAction({ type: "ready" }, false));
waitingCopyInvite.addEventListener("click", copyInvite);
tokenPanelBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!isMyTurn()) {
    setLocalMessage("Waiting for your turn.");
    return;
  }
  showingTokens = !showingTokens;
  selectedToken = null;
  inspectedTokenId = null;
  heldTokenId = null;
  setLocalMessage(showingTokens ? "Tokens opened. Tap a token to select it, or hold to inspect it." : "Tokens tucked.");
});
inspectClose.addEventListener("click", closeInspect);
inspectOverlay.addEventListener("click", (event) => {
  if (event.target === inspectOverlay) closeInspect();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInspect();
});
document.getElementById("themeGear").addEventListener("click", () => settingsMenu.classList.toggle("open"));
document.getElementById("settingsThemeBtn").addEventListener("click", () => {
  applyTheme(document.body.getAttribute("data-theme") === "light" ? "dark" : "light");
  settingsMenu.classList.remove("open");
});
document.getElementById("copyInviteBtn").addEventListener("click", copyInvite);
document.getElementById("settingsStatusBtn").addEventListener("click", () => {
  const game = currentGame();
  setLocalMessage(game ? (isOfflineQuickplay() ? `Offline quickplay. ${game.current === 0 ? "Your turn" : `${BOT_NAME}'s turn`}.` : `Room ${snapshot.room.code}. Player ${game.current + 1} to move.`) : "No room joined.");
  settingsMenu.classList.remove("open");
});
document.getElementById("settingsHistoryBtn").addEventListener("click", () => {
  setLocalMessage("Match history is local to this live room.");
  settingsMenu.classList.remove("open");
});
document.getElementById("settingsTutorialBtn").addEventListener("click", () => {
  settingsMenu.classList.remove("open");
  showScreen("rules");
});
document.getElementById("playAgainBtn").addEventListener("click", () => sendAction({ type: "restart" }));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
