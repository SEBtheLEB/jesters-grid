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

const boardEl = document.getElementById("board");
const handEl = document.getElementById("hand");
const tokensEl = document.getElementById("tokens");
const emptyTokenLabel = document.getElementById("emptyTokenLabel");
const messageEl = document.getElementById("message");
const turnLabel = document.getElementById("turnLabel");
const tokenLimit = document.getElementById("tokenLimit");
const cancelBtn = document.getElementById("cancelBtn");
const winModal = document.getElementById("winModal");
const winTitle = document.getElementById("winTitle");
const winText = document.getElementById("winText");
const settingsMenu = document.getElementById("settingsMenu");
const tokenPanelBtn = document.getElementById("tokenPanelBtn");
const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCodeInput");
const menuStatus = document.getElementById("menuStatus");

let snapshot = null;
let selectedCardIndex = null;
let selectedToken = null;
let showingTokens = false;
let localMessage = "";

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

function isTargetableTile(index) {
  const game = currentGame();
  return !!game?.pendingShot && game.pendingShot.targets.includes(index);
}

function render() {
  if (!snapshot) {
    boardEl.innerHTML = "";
    return;
  }

  renderStatus();
  renderBoard();
  renderHand();
  renderTokens();
  renderTokenView();
  renderWin();
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
  tokenLimit.textContent = `Tokens: ${game.tokensUsed}/2`;
  cancelBtn.textContent = game.pendingShot ? "Skip" : "Cancel";
  messageEl.textContent = localMessage || game.lastMessage || "Make your move.";
  document.getElementById("endTurnBtn").disabled = !isMyTurn();
  cancelBtn.disabled = !isMyTurn();
}

function renderBoard() {
  const game = currentGame();
  boardEl.innerHTML = "";
  game.board.forEach((tile, index) => {
    const tileEl = document.createElement("button");
    tileEl.className = "tile";
    const top = topCard(tile);

    if (tile.stunTurns > 0 || top?.stunned) tileEl.classList.add("stunned");
    if (game.lastPlacedTileIndex === index) tileEl.classList.add("last-placed");
    if (isSelectableTile(index)) tileEl.classList.add("selectable");
    if (isTargetableTile(index)) tileEl.classList.add("targetable");

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
      tile.tokens.forEach((token) => {
        const marker = document.createElement("span");
        marker.className = "mini-token";
        marker.textContent = TOKEN_TYPES.find((item) => item.id === token.type)?.icon || "?";
        strip.appendChild(marker);
      });
      card.appendChild(strip);
      tileEl.appendChild(card);
    }

    tileEl.addEventListener("click", () => onTileClick(index));
    boardEl.appendChild(tileEl);
  });
}

function renderHand() {
  const game = currentGame();
  const player = myPlayer();
  handEl.innerHTML = "";
  handEl.classList.toggle("needs-card-glow", isMyTurn() && !game.cardPlacedThisTurn && !game.extraCardPlacement && !game.pendingShot && game.pendingWitchTile === null);

  if (!player) {
    handEl.innerHTML = `<div class="token-view-label show">Spectating</div>`;
    return;
  }

  player.hand.forEach((value, index) => {
    const card = document.createElement("button");
    card.className = `hand-card p${player.id}-card`;
    if (selectedCardIndex === index) card.classList.add("selected");
    card.disabled = !isMyTurn() || !!game.pendingShot || game.pendingWitchTile !== null;
    card.innerHTML = `
      <div class="power-badge">${value}</div>
      <div class="suit-badge">JG</div>
      <div class="hand-art"></div>
      <div class="hand-name">${CARD_NAMES[value]}</div>
      <div class="hand-rules">${getCardHint(value)}</div>
    `;
    card.addEventListener("click", () => {
      if (card.disabled) return;
      selectedCardIndex = selectedCardIndex === index ? null : index;
      selectedToken = null;
      showingTokens = false;
      setLocalMessage(`Selected ${value} - ${CARD_NAMES[value]}. Tap a valid tile.`);
    });
    handEl.appendChild(card);
  });
}

function renderTokens() {
  const game = currentGame();
  const player = myPlayer();
  tokensEl.innerHTML = "";

  if (!player) return;

  TOKEN_TYPES.forEach((token) => {
    const button = document.createElement("button");
    const available = player.tokens[token.id] || 0;
    button.className = "token-button";
    button.innerHTML = `
      <span class="token-icon">${token.icon}</span>
      <span class="token-name">${token.label}</span>
      <span class="token-count">x${available}</span>
    `;
    button.disabled = !isMyTurn() || available <= 0 || game.tokensUsed >= 2 || (game.pendingShot && token.id !== "pierce") || game.pendingWitchTile !== null;
    if (selectedToken === token.id) button.classList.add("selected");
    button.addEventListener("click", () => {
      if (button.disabled) return;
      if (game.pendingShot && token.id === "pierce") {
        sendAction({ type: "armorPierce" });
        return;
      }
      selectedCardIndex = null;
      selectedToken = selectedToken === token.id ? null : token.id;
      showingTokens = false;
      explainToken(token.id);
      render();
    });
    tokensEl.appendChild(button);
  });
}

function renderTokenView() {
  tokensEl.classList.toggle("hidden", !showingTokens || tokensEl.children.length === 0);
  emptyTokenLabel.classList.toggle("show", showingTokens && tokensEl.children.length === 0);
  const pouchTitle = tokenPanelBtn.querySelector(".pouch-title");
  if (pouchTitle) pouchTitle.textContent = showingTokens ? "Close Pouch" : "Token Pouch";
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
tokenPanelBtn.addEventListener("click", () => {
  showingTokens = !showingTokens;
  selectedCardIndex = null;
  selectedToken = null;
  render();
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
