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

function setLocalMessage(text) {
  localMessage = text;
  render();
}

function isMatchPlaying() {
  return snapshot?.room?.phase === "playing";
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
      snapshot = message.snapshot;
      localMessage = "";
      render();
    }
  });

  socket.addEventListener("close", () => {
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

function rejoinActiveRoom() {
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
  showingTokens = false;
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

function canPlaceCard(index, value) {
  const game = currentGame();
  if (!game) return false;
  const tile = game.board[index];
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
    ghost.style.opacity = ".35";
  });
  window.setTimeout(() => ghost.remove(), 300);
}

function clearCardDrag() {
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
  showingTokens = false;
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
  updateBoardDragTargets(candidate.value, getTileIndexAtPoint(event.clientX, event.clientY));
  updateDragGhostPosition(event.clientX, event.clientY);
}

function finishCardDrag(event) {
  if (!draggedCard) return;
  const { index, value } = draggedCard;
  const tileIndex = getTileIndexAtPoint(event.clientX, event.clientY);
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
  animateCardToTile(index, tileIndex);
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
  deckExpanded = false;
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

function render() {
  if (!snapshot) {
    boardEl.innerHTML = "";
    return;
  }

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

  document.getElementById("roomCodeDisplay").textContent = `Room ${snapshot.room.code}`;
  document.getElementById("seatLabel").textContent = seat === null ? "Spectator" : `Player ${seat + 1}`;
  document.getElementById("onlineStatus").textContent = socketOpen() || usingHttpFallback ? "Online" : "Offline";
  document.getElementById("opponentName").textContent = top.name || `Player ${topIndex + 1}`;
  document.getElementById("opponentTitle").textContent = top.connected ? `Player ${topIndex + 1}` : "Disconnected";
  document.getElementById("opponentInfo").textContent = `C ${top.handCount} - T ${top.tokenTotal}`;
  document.getElementById("opponentDeck").textContent = `Deck ${top.deckCount}`;
  document.getElementById("playerNameLabel").textContent = bottom.name || `Player ${bottomIndex + 1}`;
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

    if (top) {
      const card = document.createElement("div");
      card.className = `card p${top.owner}-card`;
      if (hadBoardMemory && previousBoardTopKeys[index] !== topKey) card.classList.add("card-placed");
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
        showingTokens = false;
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
        inspectedCardIndex = null;
        setLocalMessage("Card tucked back into the deck.");
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
      showingTokens = false;
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
        deckExpanded = false;
        clearHandFocus();
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
      deckExpanded = false;
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
  if (deckExpanded || showingTokens || inspectedCardIndex !== null) {
    tuckPlayPieces();
    render();
    return;
  }
  sendAction({ type: "removeToken", tileIndex: index }, false);
}

function sendAction(action, clearSelection = true) {
  sendEvent("gameAction", action, (result) => {
    if (!result?.ok) {
      setLocalMessage(result?.message || "That move is not available.");
      return;
    }
    localMessage = "";
    if (clearSelection) {
      selectedCardIndex = null;
      selectedToken = null;
      showingTokens = false;
      deckExpanded = false;
      inspectedCardIndex = null;
      inspectedTokenId = null;
      heldCardIndex = null;
      heldTokenId = null;
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
  if (code) {
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
  showingTokens = false;
  clearHandFocus();
  setLocalMessage("Deck opened. Tap a card to select it, hold to inspect it, or drag it.");
});
window.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!deckExpanded && !showingTokens && inspectedCardIndex === null && inspectedTokenId === null && heldCardIndex === null && heldTokenId === null && selectedToken === null) return;
  if (target.closest(".settings-menu, .settings-button, .modal, .inspect-overlay, .waiting-room")) return;
  if (inspectedCardIndex !== null || inspectedTokenId !== null) {
    inspectedCardIndex = null;
    inspectedTokenId = null;
    render();
    return;
  }
  if (target.closest(".hand-stage")) return;
  if (target.closest(".tile") && (selectedCardIndex !== null || selectedToken !== null)) return;
  deckExpanded = false;
  showingTokens = false;
  clearHandFocus();
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
  deckExpanded = false;
  clearHandFocus();
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
  setLocalMessage(game ? `Room ${snapshot.room.code}. Player ${game.current + 1} to move.` : "No room joined.");
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
