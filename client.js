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
let dragCandidate = null;
let draggedCard = null;
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
    if (roomFromUrl && !snapshot && !autoJoinAttempted) {
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
  requestId += 1;
  pendingReplies.set(id, callback || (() => {}));
  socket.send(JSON.stringify({ id, event, payload }));

  window.setTimeout(() => {
    if (!pendingReplies.has(id)) return;
    pendingReplies.delete(id);
    callback?.({ ok: false, message: "The server did not answer in time." });
  }, 8000);
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
  if (element.dataset.suppressClick !== "true") return false;
  delete element.dataset.suppressClick;
  return true;
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

function clearCardDrag() {
  draggedCard?.ghost?.remove();
  draggedCard?.card?.classList.remove("drag-source");
  draggedCard = null;
  dragCandidate = null;
  handEl.classList.remove("deck-dragging", "deck-expanded");
  gameShell.classList.remove("dragging-card");
  clearBoardDragTargets();
}

function startCardDrag(candidate, event) {
  if (!candidate || draggedCard || inspectOverlay.classList.contains("show")) return;
  if (candidate.card.dataset.suppressClick === "true") return;

  selectedCardIndex = candidate.index;
  selectedToken = null;
  showingTokens = false;
  deckExpanded = false;

  const rect = candidate.card.getBoundingClientRect();
  const ghost = candidate.card.cloneNode(true);
  ghost.classList.remove("selected", "drawn-card", "is-holding");
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);

  candidate.card.dataset.suppressClick = "true";
  candidate.card.classList.add("drag-source");
  handEl.classList.remove("deck-expanded");
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
    setLocalMessage("Drag a card onto the board to place it.");
    return;
  }

  if (!canPlaceCard(tileIndex, value)) {
    deckExpanded = true;
    setLocalMessage("That tile cannot take this card.");
    return;
  }

  selectedCardIndex = index;
  selectedToken = null;
  sendAction({ type: "placeCard", handIndex: index, tileIndex });
}

function updateCardDragFromPointer(event) {
  if (!dragCandidate || dragCandidate.pointerId !== event.pointerId) return;
  if (inspectOverlay.classList.contains("show")) return;
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
      clearCardDrag();
      render();
      return;
    }
    finishCardDrag(event);
    return;
  }
  dragCandidate = null;
}

function bindCardDrag(card, index, value, isUnavailable) {
  card.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (isUnavailable || showingTokens) return;
    dragCandidate = {
      card,
      index,
      value,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
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
  }

  renderWaitingRoom();
  const playing = isMatchPlaying();
  waitingRoom.classList.toggle("show", !playing);
  gameShell.classList.toggle("hidden", !playing);

  if (!playing) {
    previousRoomPhase = phase;
    renderWin();
    return;
  }

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
  document.getElementById("endTurnBtn").disabled = !isMyTurn();
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
  handEl.classList.toggle("needs-card-glow", isMyTurn() && !game.cardPlacedThisTurn && !game.extraCardPlacement && !game.pendingShot && game.pendingWitchTile === null);
  handEl.classList.toggle("deck-expanded", deckExpanded && !showingTokens);
  handEl.classList.toggle("deck-dragging", !!draggedCard);
  handEl.closest(".hand-panel")?.classList.toggle("deck-expanded", deckExpanded && !showingTokens);
  handEl.closest(".hand-panel")?.classList.toggle("deck-dragging", !!draggedCard);

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
    const isUnavailable = !isMyTurn() || !!game.pendingShot || game.pendingWitchTile !== null;
    card.classList.toggle("is-disabled", isUnavailable);
    card.setAttribute("aria-disabled", String(isUnavailable));
    card.setAttribute("aria-label", `${CARD_NAMES[value]}, ${value}. ${deckExpanded ? "Tap to select or drag to a board tile." : "Tap to open the deck."}`);
    card.innerHTML = `
      <div class="power-badge">${value}</div>
      <div class="suit-badge">JG</div>
      <div class="hand-art"></div>
      <div class="hand-name">${CARD_NAMES[value]}</div>
      <div class="hand-rules">${getCardHint(value)}</div>
    `;
    bindHoldInfo(card, () => getCardInspectInfo(value), 760);
    bindCardDrag(card, index, value, isUnavailable);
    card.addEventListener("click", () => {
      if (consumeHeldClick(card) || isUnavailable) return;
      if (!deckExpanded) {
        deckExpanded = true;
        selectedCardIndex = null;
        selectedToken = null;
        showingTokens = false;
        setLocalMessage("Deck opened. Drag a card to the board, or tap a card then tile.");
        return;
      }
      selectedCardIndex = selectedCardIndex === index ? null : index;
      selectedToken = null;
      showingTokens = false;
      setLocalMessage(`Selected ${value} - ${CARD_NAMES[value]}. Tap a valid tile.`);
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
    nextTokenCounts[token.id] = available;
    button.className = "token-button";
    button.style.setProperty("--draw-order", TOKEN_TYPES.findIndex((item) => item.id === token.id));
    if (showingTokens && !previousShowingTokens) button.classList.add("token-enter");
    if (previousTokenCounts[token.id] !== undefined && previousTokenCounts[token.id] !== available) button.classList.add("token-changed");
    button.innerHTML = `
      <span class="token-icon">${token.icon}</span>
      <span class="token-name">${token.label}</span>
      <span class="token-count">x${available}</span>
    `;
    const isUnavailable = !isMyTurn() || available <= 0 || game.tokensUsed >= 2 || (game.pendingShot && token.id !== "pierce") || game.pendingWitchTile !== null;
    button.classList.toggle("is-disabled", isUnavailable);
    button.setAttribute("aria-disabled", String(isUnavailable));
    if (selectedToken === token.id) button.classList.add("selected");
    bindHoldInfo(button, () => getTokenInspectInfo(token));
    button.addEventListener("click", () => {
      if (consumeHeldClick(button) || isUnavailable) return;
      if (game.pendingShot && token.id === "pierce") {
        sendAction({ type: "armorPierce" });
        return;
      }
      selectedCardIndex = null;
      selectedToken = selectedToken === token.id ? null : token.id;
      explainToken(token.id);
      render();
    });
    tokensEl.appendChild(button);
  });
  previousTokenCounts = nextTokenCounts;
}

function renderTokenView() {
  if (showingTokens) {
    deckExpanded = false;
    handEl.classList.remove("deck-expanded", "deck-dragging");
    handEl.closest(".hand-panel")?.classList.remove("deck-expanded", "deck-dragging");
  }
  handEl.classList.toggle("hidden", showingTokens);
  tokensEl.classList.toggle("hidden", !showingTokens || tokensEl.children.length === 0);
  emptyTokenLabel.classList.toggle("show", showingTokens && tokensEl.children.length === 0);
  if (handSectionTitle) handSectionTitle.textContent = showingTokens ? "Token Pouch" : "Your Hand";
  const pouchTitle = tokenPanelBtn.querySelector(".pouch-title");
  if (pouchTitle) pouchTitle.textContent = showingTokens ? "Cards" : "Tokens";
  tokenPanelBtn.classList.toggle("is-open", showingTokens);
  tokenPanelBtn.setAttribute("aria-pressed", String(showingTokens));
  tokenPanelBtn.setAttribute("aria-label", showingTokens ? "Close token pouch" : "Open token pouch");
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
  if (game.pendingWitchTile !== null) {
    sendAction({ type: "stunTile", tileIndex: index });
    return;
  }
  if (game.pendingShot) {
    sendAction({ type: "shoot", tileIndex: index });
    return;
  }
  if (selectedToken) {
    sendAction({ type: "useToken", tokenType: selectedToken, tileIndex: index });
    return;
  }
  if (selectedCardIndex !== null) {
    sendAction({ type: "placeCard", handIndex: selectedCardIndex, tileIndex: index });
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
document.getElementById("resetBtn").addEventListener("click", () => {
  if (snapshot) sendAction({ type: "restart" });
});
document.getElementById("endTurnBtn").addEventListener("click", () => sendAction({ type: "endTurn" }));
document.getElementById("cancelBtn").addEventListener("click", () => sendAction({ type: "cancel" }));
bindHorizontalWheel(tokensEl);
window.addEventListener("pointermove", updateCardDragFromPointer, { passive: false });
window.addEventListener("pointerup", endCardDragFromPointer);
window.addEventListener("pointercancel", (event) => endCardDragFromPointer(event, true));
readyBtn.addEventListener("click", () => sendAction({ type: "ready" }, false));
waitingCopyInvite.addEventListener("click", copyInvite);
tokenPanelBtn.addEventListener("click", () => {
  showingTokens = !showingTokens;
  deckExpanded = false;
  selectedCardIndex = null;
  selectedToken = null;
  render();
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
