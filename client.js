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
  potion: "Use on a stunned tile to clear it, or use your Witch to stun another non-Jester tile.",
  parry: "Place on one of your cards to block the next shot that would destroy it."
};

const CARD_DETAILS = {
  1: "A low court card. Place it on an empty tile or cover lower-value cards when allowed.",
  2: "A low court card. It can be upgraded by Bard into a straight shooter.",
  3: "Shield cannot be covered, swept, or shot unless Armor Pierce is involved.",
  4: "Archer is a diagonal shooter. Use Ammo Crate on it to shoot along diagonal lines.",
  5: "Crossbow is a straight shooter. Use Ammo Crate on it to shoot along rows and columns.",
  6: "Witch stuns the tile she is placed on, then forces you to choose one different non-Jester tile to stun.",
  7: "A strong court card for covering lower cards and building toward four in a row.",
  8: "A strong court card for covering lower cards and controlling the grid.",
  9: "A strong court card for covering lower cards and blocking opponent lines.",
  10: "Banner is a high court card. It is hard to cover and can anchor a line.",
  11: "Champion is a high court card. It pressures the board and resists most cover attempts.",
  12: "Giant is a high court card. Only very high cards can cover it.",
  13: "King is one of the strongest cards and can only be covered by the Jester.",
  14: "Jester locks the tile. A locked tile cannot be covered."
};

// Add your custom PNG paths here. Leave empty to use the CSS fallback artwork.
const UI_ASSETS = {
  menuReference: "",
  characterReference: "/assets/ui/luna-jax-character-reference.png",
  logoBanner: "",
  titleBacking: "",
  girlJester: "",
  boyJester: "",
  heroMascots: "/assets/ui/generated/home-jesters-layer.png",
  playerAvatar: "",
  profileFrame: "/assets/ui/generated/profile-frame.png",
  menuCardFrame: "/assets/ui/generated/menu-card-frame.png",
  playEmblem: "/assets/ui/generated/play-emblem.png",
  soloEmblem: "/assets/ui/generated/solo-emblem.png",
  rankedEmblem: "/assets/ui/generated/ranked-emblem.png",
  roundButtonFrame: "/assets/ui/generated/round-button-frame.png",
  playCard: "",
  decksCard: "",
  rankedCard: "",
  bottomButtonFrame: "",
  newsIcon: "",
  rewardsIcon: "",
  coinIcon: "",
  gemIcon: "",
  cardBackRed: "",
  cardBackBlue: "",
  cornerOrnament: ""
};

class GameAudioEngine {
  constructor() {
    this.enabled = localStorage.getItem("jg-sound-enabled") !== "false";
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
  }

  tone(frequency, duration = 0.1, delay = 0, options = {}) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain || 0.07, start + Math.min(0.018, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play(cue) {
    if (!this.enabled) return;
    const cues = {
      tap: () => this.tone(420, 0.045, 0, { gain: 0.035, type: "triangle", to: 360 }),
      select: () => {
        this.tone(330, 0.08, 0, { gain: 0.05, type: "triangle", to: 430 });
        this.tone(660, 0.09, 0.045, { gain: 0.035, type: "sine", to: 720 });
      },
      deckOpen: () => [220, 294, 392].forEach((note, index) => this.tone(note, 0.11, index * 0.045, { gain: 0.04, type: "triangle", to: note * 1.08 })),
      deckClose: () => [392, 294, 220].forEach((note, index) => this.tone(note, 0.1, index * 0.04, { gain: 0.032, type: "triangle", to: note * 0.9 })),
      reveal: () => [262, 392, 523].forEach((note, index) => this.tone(note, 0.18, index * 0.065, { gain: 0.05, type: "sine", to: note * 1.04 })),
      place: () => {
        this.tone(132, 0.16, 0, { gain: 0.09, type: "triangle", to: 92 });
        this.tone(528, 0.12, 0.08, { gain: 0.04, type: "sine", to: 610 });
      },
      token: () => [780, 1040].forEach((note, index) => this.tone(note, 0.09, index * 0.055, { gain: 0.035, type: "sine", to: note * 1.08 })),
      shot: () => {
        this.tone(980, 0.32, 0, { gain: 0.07, type: "sawtooth", to: 170 });
        this.tone(110, 0.16, 0.24, { gain: 0.08, type: "triangle", to: 68 });
      },
      stun: () => [196, 185, 147].forEach((note, index) => this.tone(note, 0.28, index * 0.075, { gain: 0.05, type: "sine", to: note * 0.72 })),
      sweep: () => {
        this.tone(180, 0.42, 0, { gain: 0.06, type: "sawtooth", to: 760 });
        this.tone(96, 0.18, 0.32, { gain: 0.075, type: "triangle", to: 68 });
      },
      turn: () => [294, 440, 587].forEach((note, index) => this.tone(note, 0.24, index * 0.095, { gain: 0.048, type: "triangle", to: note * 1.04 })),
      join: () => [392, 494, 659].forEach((note, index) => this.tone(note, 0.16, index * 0.07, { gain: 0.045, type: "sine", to: note * 1.03 })),
      win: () => [262, 330, 392, 523].forEach((note, index) => this.tone(note, 0.42, index * 0.12, { gain: 0.055, type: "triangle", to: note * 1.05 })),
      error: () => [180, 140].forEach((note, index) => this.tone(note, 0.14, index * 0.09, { gain: 0.045, type: "square", to: note * 0.82 }))
    };
    cues[cue]?.();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("jg-sound-enabled", String(this.enabled));
    if (this.enabled) {
      this.unlock();
      this.play("select");
    }
    return this.enabled;
  }
}

const gameAudio = new GameAudioEngine();

let socket = null;
let autoJoinAttempted = false;
let usingHttpFallback = false;
let pollTimer = null;
let pollingActive = false;
let pollInFlight = false;
let consecutiveNetworkFailures = 0;
let lastServerContactAt = 0;
let lastAcceptedRevision = 0;
let menuRequestInFlight = false;
let networkActionInFlight = false;
let roomHeartbeatTimer = null;
let reconnectTimer = null;
let rejoinInFlight = false;
let queuedRejoinCallbacks = [];
let requestId = 1;
const pendingReplies = new Map();
const clientId = getClientId();
const ACTIVE_ROOM_KEY = "jg-active-room-v1";
const screens = {
  menu: document.getElementById("menuScreen"),
  online: document.getElementById("onlineScreen"),
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
const menuToast = document.getElementById("menuToast");
const onlineBackBtn = document.getElementById("onlineBackBtn");
const onlineJoinRevealBtn = document.getElementById("onlineJoinRevealBtn");
const onlineJoinForm = document.getElementById("onlineJoinForm");
const profileRank = document.getElementById("profileRank");
const profileLevelBadge = document.getElementById("profileLevelBadge");
const profileXpTrack = document.getElementById("profileXpTrack");
const profileXpBar = document.getElementById("profileXpBar");
const profileXpCopy = document.getElementById("profileXpCopy");
const profileCoins = document.getElementById("profileCoins");
const profileGems = document.getElementById("profileGems");
const pageTransition = document.getElementById("pageTransition");

const PLAYER_PROFILE_KEY = "jg-player-profile-v2";
const PROFILE_AWARDS_KEY = "jg-profile-awards-v1";
const DEFAULT_PLAYER_PROFILE = Object.freeze({
  name: "Jester",
  rank: "Unranked",
  level: 0,
  xp: 0,
  xpMax: 100,
  coins: 0,
  gems: 0
});
const playerProfile = loadPlayerProfile();

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
let previousTurnSignature = "";
let announcedWinner = null;
let previousPlayerTwoConnected = false;
let previousShowingTokens = false;
let introTimer = null;
let botTurnTimer = null;
let deckMotionTimer = null;
let inspectReturnTimer = null;
let pendingBoardCutscene = null;
let boardCutsceneQueue = Promise.resolve();
let boardCutsceneActive = false;
let boardCutsceneMessage = "";
let notificationRegistrationInFlight = false;
let lastNotificationRegistrationKey = "";
let roomNotificationPermissionPromise = null;
let rulesReturnScreen = "menu";
let screenTransitionActive = false;

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

const BOARD_ANIMATION_SLOWDOWN = 2.05;

function getClientId() {
  const existing = localStorage.getItem("jg-client-id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("jg-client-id", id);
  return id;
}

function savedRoomSession() {
  try {
    const session = JSON.parse(localStorage.getItem(ACTIVE_ROOM_KEY) || "null");
    if (!session || session.clientId !== clientId) return null;
    if (!session.code || Date.now() - Number(session.updatedAt || 0) > 1000 * 60 * 60 * 24) return null;
    return session;
  } catch {
    return null;
  }
}

function savedSeatForCode(code) {
  const session = savedRoomSession();
  const normalizedCode = String(code || "").trim().toUpperCase();
  return session?.code === normalizedCode && Number.isInteger(session.seat) ? session.seat : null;
}

function rememberRoomSession(code, seat) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode || seat !== 0 && seat !== 1) return;
  localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({
    code: normalizedCode,
    seat,
    clientId,
    name: playerNameInput.value.trim() || "Jester",
    updatedAt: Date.now()
  }));
}

function forgetRoomSession() {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
  lastNotificationRegistrationKey = "";
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("jg-theme", theme);
}

function loadPlayerProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || "null");
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PLAYER_PROFILE };
    return { ...DEFAULT_PLAYER_PROFILE, ...saved };
  } catch {
    return { ...DEFAULT_PLAYER_PROFILE };
  }
}

function normalizeProfileNumber(value, fallback, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : fallback;
}

function savePlayerProfile() {
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(playerProfile));
}

function renderPlayerProfile() {
  const xpMax = normalizeProfileNumber(playerProfile.xpMax, DEFAULT_PLAYER_PROFILE.xpMax, 1);
  const xp = Math.min(normalizeProfileNumber(playerProfile.xp, DEFAULT_PLAYER_PROFILE.xp), xpMax);
  const progress = Math.max(0, Math.min(100, xp / xpMax * 100));
  const formatNumber = new Intl.NumberFormat();

  profileRank.textContent = String(playerProfile.rank || DEFAULT_PLAYER_PROFILE.rank);
  profileLevelBadge.textContent = String(normalizeProfileNumber(playerProfile.level, DEFAULT_PLAYER_PROFILE.level));
  profileXpBar.style.width = `${progress}%`;
  profileXpTrack.setAttribute("aria-valuemax", String(xpMax));
  profileXpTrack.setAttribute("aria-valuenow", String(xp));
  profileXpCopy.textContent = `${formatNumber.format(xp)} / ${formatNumber.format(xpMax)} XP`;
  profileCoins.textContent = formatNumber.format(normalizeProfileNumber(playerProfile.coins, DEFAULT_PLAYER_PROFILE.coins));
  profileGems.textContent = formatNumber.format(normalizeProfileNumber(playerProfile.gems, DEFAULT_PLAYER_PROFILE.gems));
}

function rankForLevel(level) {
  if (level >= 20) return "Royal Trickster";
  if (level >= 10) return "Court Jester";
  if (level >= 5) return "Trickster";
  if (level >= 1) return "Jester Initiate";
  return "Unranked";
}

function addPlayerProgress({ xp = 0, coins = 0, gems = 0 } = {}) {
  let level = normalizeProfileNumber(playerProfile.level, 0);
  let currentXp = normalizeProfileNumber(playerProfile.xp, 0);
  let xpMax = normalizeProfileNumber(playerProfile.xpMax, 100, 1);
  currentXp += normalizeProfileNumber(xp, 0);

  while (currentXp >= xpMax) {
    currentXp -= xpMax;
    level += 1;
    xpMax = 100 + level * 25;
  }

  updatePlayerProfile({
    level,
    rank: rankForLevel(level),
    xp: currentXp,
    xpMax,
    coins: normalizeProfileNumber(playerProfile.coins, 0) + normalizeProfileNumber(coins, 0),
    gems: normalizeProfileNumber(playerProfile.gems, 0) + normalizeProfileNumber(gems, 0)
  });
  return { level, xp: currentXp, xpMax, coins, gems };
}

function loadAwardedMatches() {
  try {
    const entries = JSON.parse(localStorage.getItem(PROFILE_AWARDS_KEY) || "[]");
    return Array.isArray(entries) ? entries.filter((entry) => typeof entry === "string").slice(-40) : [];
  } catch {
    return [];
  }
}

function awardCompletedMatch(game) {
  const seat = mySeat();
  if (!game?.gameOver || !game.winner || seat !== 0 && seat !== 1) return null;
  const matchIdentity = `${snapshot?.room?.code || "solo"}:${snapshot?.room?.startedAt || snapshot?.room?.joinedAt || "match"}`;
  const awardKey = `${matchIdentity}:${game.winner}`;
  const awardedMatches = loadAwardedMatches();
  if (awardedMatches.includes(awardKey)) return null;

  const won = game.winner === seat + 1;
  const reward = won
    ? { xp: 60, coins: 25, gems: 1 }
    : { xp: 30, coins: 10, gems: 0 };
  addPlayerProgress(reward);
  awardedMatches.push(awardKey);
  localStorage.setItem(PROFILE_AWARDS_KEY, JSON.stringify(awardedMatches.slice(-40)));
  return { ...reward, won };
}

function updatePlayerProfile(updates = {}) {
  const allowed = ["rank", "level", "xp", "xpMax", "coins", "gems"];
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) playerProfile[key] = updates[key];
  });
  if (Object.prototype.hasOwnProperty.call(updates, "name")) {
    const name = String(updates.name || "").trim().slice(0, 18) || DEFAULT_PLAYER_PROFILE.name;
    playerProfile.name = name;
    playerNameInput.value = name;
    localStorage.setItem("jg-name", name);
  }
  savePlayerProfile();
  renderPlayerProfile();
  return { ...playerProfile };
}

applyTheme(localStorage.getItem("jg-theme") || "dark");
playerNameInput.value = localStorage.getItem("jg-name") || playerProfile.name || DEFAULT_PLAYER_PROFILE.name;
playerProfile.name = playerNameInput.value;
renderPlayerProfile();

const roomFromUrl = new URLSearchParams(window.location.search).get("room");
if (roomFromUrl) roomCodeInput.value = roomFromUrl.toUpperCase();
else if (savedRoomSession()?.code) roomCodeInput.value = savedRoomSession().code;

function activateScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  const nextScreen = screens[name];
  nextScreen?.classList.add("active");
  if (nextScreen) nextScreen.scrollTop = 0;
  settingsMenu.classList.remove("open");
}

function showScreen(name, options = {}) {
  const nextScreen = screens[name];
  if (!nextScreen || nextScreen.classList.contains("active")) return Promise.resolve(false);
  if (screenTransitionActive) return Promise.resolve(false);

  const trigger = options.trigger || null;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const buttonDelay = reduceMotion ? 0 : (Number.isFinite(options.delay) ? Math.max(0, options.delay) : (trigger ? 480 : 0));
  if (trigger) bounceMenuTarget(trigger);
  screenTransitionActive = true;
  document.body.classList.add("navigation-locked");

  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (reduceMotion || !pageTransition) {
        activateScreen(name);
        options.onActivate?.();
        screenTransitionActive = false;
        document.body.classList.remove("navigation-locked");
        resolve(true);
        return;
      }

      pageTransition.classList.add("show");
      pageTransition.setAttribute("aria-hidden", "false");
      window.setTimeout(() => {
        activateScreen(name);
        options.onActivate?.();
        nextScreen.classList.add("screen-entering");
        window.requestAnimationFrame(() => pageTransition.classList.remove("show"));
        window.setTimeout(() => {
          nextScreen.classList.remove("screen-entering");
          pageTransition.setAttribute("aria-hidden", "true");
          screenTransitionActive = false;
          document.body.classList.remove("navigation-locked");
          resolve(true);
        }, 430);
      }, 260);
    }, buttonDelay);
  });
}

function setMenuStatus(text) {
  if (menuStatus) menuStatus.textContent = text;
}

function setMenuRequestBusy(busy, message = "") {
  menuRequestInFlight = busy;
  ["createRoomBtn", "joinRoomBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = busy;
  });
  if (message) setMenuStatus(message);
}

function setOnlineJoinOpen(open) {
  onlineJoinForm?.classList.toggle("open", open);
  onlineJoinForm?.setAttribute("aria-hidden", String(!open));
  onlineJoinRevealBtn?.setAttribute("aria-expanded", String(open));
  if (open) {
    setMenuStatus("Enter the room code, then tap Join.");
    window.setTimeout(() => roomCodeInput?.focus(), 260);
  } else {
    setMenuStatus("Choose how you want to enter the court.");
  }
}

function assetValue(key) {
  return String(UI_ASSETS[key] || "").trim();
}

function ensureAssetBackgroundLayer(element) {
  let layer = Array.from(element.children).find((child) => child.classList?.contains("asset-bg"));
  if (!layer) {
    layer = document.createElement("span");
    layer.className = "asset-bg";
    layer.setAttribute("aria-hidden", "true");
    element.prepend(layer);
  }
  return layer;
}

function applyHomeUiAssets(root = document) {
  root.querySelectorAll("[data-asset-bg]").forEach((element) => {
    const path = assetValue(element.dataset.assetBg);
    if (!path) {
      element.classList.remove("png-backed");
      const layer = Array.from(element.children).find((child) => child.classList?.contains("asset-bg"));
      if (layer) layer.remove();
      return;
    }
    const layer = ensureAssetBackgroundLayer(element);
    layer.style.backgroundImage = `url("${path}")`;
    element.classList.add("png-backed");
  });

  root.querySelectorAll("[data-asset-img]").forEach((slot) => {
    const path = assetValue(slot.dataset.assetImg);
    const image = slot.querySelector("img.asset-img");
    if (!image) return;
    if (!path) {
      image.removeAttribute("src");
      slot.classList.remove("png-backed");
      return;
    }
    image.src = path;
    slot.classList.add("png-backed");
  });
}

function showMenuToast(text) {
  if (!menuToast) return;
  window.clearTimeout(showMenuToast.timer);
  menuToast.textContent = text;
  menuToast.classList.add("show");
  showMenuToast.timer = window.setTimeout(() => menuToast.classList.remove("show"), 1700);
}

function bounceMenuTarget(target) {
  if (!target?.classList) return;
  target.classList.add("tap-bounce");
  target.classList.remove("bump");
  void target.offsetWidth;
  target.classList.add("bump");
}

function handleMenuAction(action, target = null) {
  console.log(`Jester's Grid menu action: ${action}`);
  const messages = {
    ranked: "Ranked mode is coming soon.",
    shop: "Shop is coming soon.",
    collection: "Collection is coming soon.",
    quests: "Quests are coming soon.",
    settings: "Settings are coming soon.",
    profile: "Profile details are coming soon.",
    exit: "Use your browser controls to leave the app.",
    news: "News scroll is coming soon.",
    rewards: "Rewards chest is coming soon.",
    coins: "Coin shop is coming soon.",
    gems: "Gem shop is coming soon."
  };

  if (action === "play" || action === "online") {
    setOnlineJoinOpen(false);
    showScreen("online", { trigger: target });
    return;
  }

  if (action === "solo" || action === "decks") {
    createBotRoom(target);
    return;
  }

  bounceMenuTarget(target);
  window.setTimeout(() => showMenuToast(messages[action] || `${action} coming soon.`), 220);
}

function setLocalMessage(text) {
  localMessage = text;
  render();
}

function activeRoomCode() {
  const urlRoom = new URLSearchParams(window.location.search).get("room") || "";
  return (snapshot?.room?.code || roomCodeInput.value || urlRoom || savedRoomSession()?.code || "").trim().toUpperCase();
}

function receiveServerSnapshot(nextSnapshot, renderNow = true) {
  if (!nextSnapshot || isOfflineQuickplay()) return false;
  const nextCode = String(nextSnapshot.room?.code || "");
  const currentCode = String(snapshot?.room?.code || "");
  const nextRevision = Number(nextSnapshot.room?.revision || 0);
  const currentRevision = currentCode === nextCode ? Number(snapshot?.room?.revision || lastAcceptedRevision || 0) : 0;
  if (nextCode && nextCode === currentCode && nextRevision && currentRevision && nextRevision <= currentRevision) {
    lastServerContactAt = Date.now();
    consecutiveNetworkFailures = 0;
    return false;
  }
  const previousSnapshot = snapshot;
  snapshot = nextSnapshot;
  if (nextCode !== currentCode) lastAcceptedRevision = 0;
  lastAcceptedRevision = Math.max(lastAcceptedRevision, nextRevision);
  lastServerContactAt = Date.now();
  consecutiveNetworkFailures = 0;
  if (snapshot.room?.code && (snapshot.you?.seat === 0 || snapshot.you?.seat === 1)) {
    rememberRoomSession(snapshot.room.code, snapshot.you.seat);
    roomCodeInput.value = snapshot.room.code;
    maybeRegisterRoomNotification();
  }
  pendingBoardCutscene = { previous: previousSnapshot, next: nextSnapshot };
  if (snapshot.room?.code) {
    startRoomHeartbeat();
    if (usingHttpFallback) startPolling();
  }
  if (renderNow) render();
  return true;
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
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
  const liveSocket = socket;

  socket.addEventListener("open", () => {
    if (socket !== liveSocket) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    setMenuStatus("Connected.");
    if (snapshot?.room?.code) {
      rejoinActiveRoom({ silent: true });
    } else if ((roomFromUrl || savedRoomSession()?.code) && !autoJoinAttempted) {
      autoJoinAttempted = true;
      rejoinActiveRoom({ silent: true, callback: (ok) => {
        if (ok) showScreen("game");
        else if (roomFromUrl) joinRoom();
      } });
    }
    startRoomHeartbeat();
    render();
  });

  socket.addEventListener("message", (event) => {
    if (socket !== liveSocket) return;
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
        const hasSnapshot = receiveServerSnapshot(message.result?.snapshot, false);
        callback(message.result);
        if (hasSnapshot) render();
      }
      return;
    }

    if (message.type === "state") {
      if (isOfflineQuickplay()) return;
      receiveServerSnapshot(message.snapshot, false);
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
    if (socket !== liveSocket) return;
    if (isOfflineQuickplay()) return;
    if (!snapshot) {
      startHttpFallback();
      return;
    }
    setMenuStatus("Disconnected. Reconnecting...");
    if (snapshot) render();
    socket = null;
    if (!reconnectTimer) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectRealtime();
      }, 1200);
    }
  });

  socket.addEventListener("error", () => {
    if (socket !== liveSocket) return;
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
    ? { clientId, code: activeRoomCode(), seat: mySeat(), action: payload }
    : { ...(payload || {}), clientId };
  requestId += 1;
  pendingReplies.set(id, callback || (() => {}));
  try {
    socket.send(JSON.stringify({ id, event, payload: outboundPayload }));
  } catch {
    pendingReplies.delete(id);
    sendHttpEvent(event, payload, callback);
    return;
  }

  window.setTimeout(() => {
    if (!pendingReplies.has(id)) return;
    pendingReplies.delete(id);
    try {
      socket?.close();
    } catch {
      socket = null;
    }
    socket = null;
    startHttpFallback();
    sendHttpEvent(event, payload, callback);
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

function startRoomHeartbeat() {
  if (roomHeartbeatTimer || isOfflineQuickplay()) return;
  roomHeartbeatTimer = window.setInterval(() => {
    if (isOfflineQuickplay() || !activeRoomCode()) {
      stopRoomHeartbeat();
      return;
    }
    rejoinActiveRoom({ silent: true });
  }, 5000);
}

function stopRoomHeartbeat() {
  if (!roomHeartbeatTimer) return;
  window.clearInterval(roomHeartbeatTimer);
  roomHeartbeatTimer = null;
}

function shouldRecoverRoomError(message) {
  return /join a room|room not found|spectators cannot move|server did not answer|could not reach/i.test(String(message || ""));
}

function rejoinActiveRoom(options = {}) {
  if (typeof options === "function") options = { callback: options };
  if (isOfflineQuickplay()) {
    options.callback?.(false);
    return;
  }
  const code = activeRoomCode();
  if (!code) {
    options.callback?.(false);
    return;
  }
  if (rejoinInFlight) {
    if (options.callback) queuedRejoinCallbacks.push(options.callback);
    return;
  }
  rejoinInFlight = true;
  const name = playerNameInput.value.trim() || "Jester";
  const seat = mySeat();
  const finishRejoin = (ok, result) => {
    rejoinInFlight = false;
    const callbacks = queuedRejoinCallbacks;
    queuedRejoinCallbacks = [];
    options.callback?.(ok, result);
    callbacks.forEach((callback) => callback(ok, result));
  };
  sendEvent("joinRoom", { code, name, rank: playerProfile.rank, seat, heartbeat: !!options.silent }, (result) => {
    if (!result?.ok) {
      if (!options.silent) setMenuStatus(result?.message || "Could not rejoin room.");
      finishRejoin(false, result);
      return;
    }
    if (result.snapshot) receiveServerSnapshot(result.snapshot, false);
    if (result.snapshot?.room?.code && (result.snapshot.you?.seat === 0 || result.snapshot.you?.seat === 1)) {
      rememberRoomSession(result.snapshot.room.code, result.snapshot.you.seat);
    }
    setMenuStatus("Connected.");
    startRoomHeartbeat();
    finishRejoin(true, result);
    render();
  });
}

function startHttpFallback() {
  if (usingHttpFallback) return;
  usingHttpFallback = true;
  setMenuStatus("Connected.");
  if ((roomFromUrl || savedRoomSession()?.code) && !snapshot && !autoJoinAttempted) {
    autoJoinAttempted = true;
    rejoinActiveRoom({ silent: true, callback: (ok) => {
      if (ok) showScreen("game");
      else if (roomFromUrl) joinRoom();
    } });
  }
  startPolling();
  startRoomHeartbeat();
  if (activeRoomCode()) rejoinActiveRoom({ silent: true });
  render();
}

function startPolling() {
  if (pollingActive) return;
  pollingActive = true;
  const tick = async () => {
    pollTimer = null;
    await pollState();
    if (!pollingActive || !usingHttpFallback || isOfflineQuickplay() || !activeRoomCode()) {
      pollingActive = false;
      return;
    }
    const delay = document.hidden ? 2400 : Math.min(2400, 780 + consecutiveNetworkFailures * 360);
    pollTimer = window.setTimeout(tick, delay);
  };
  pollTimer = window.setTimeout(tick, 80);
}

function stopPolling() {
  pollingActive = false;
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
}

async function pollState() {
  if (isOfflineQuickplay()) return;
  if (!usingHttpFallback || !activeRoomCode()) return;
  if (pollInFlight) return;
  pollInFlight = true;
  const seat = mySeat();
  const params = new URLSearchParams({ code: activeRoomCode(), clientId, seat: String(seat ?? "") });
  try {
    const response = await fetch(`/api/state?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();
    if (result.ok && result.snapshot) {
      receiveServerSnapshot(result.snapshot);
    } else if (shouldRecoverRoomError(result.message)) {
      rejoinActiveRoom({ silent: true });
    }
  } catch {
    consecutiveNetworkFailures += 1;
    setMenuStatus("Reconnecting...");
  } finally {
    pollInFlight = false;
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
    ? { clientId, code: activeRoomCode(), seat: mySeat(), action: payload }
    : { ...payload, clientId };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const result = await response.json();
    const hasSnapshot = receiveServerSnapshot(result.snapshot, false);
    callback?.(result);
    if (hasSnapshot) render();
  } catch {
    callback?.({ ok: false, message: "The court is reconnecting. Please try again." });
  } finally {
    window.clearTimeout(timeout);
  }
}

function currentGame() {
  return snapshot?.game || null;
}

function mySeat() {
  return snapshot?.you?.seat ?? savedSeatForCode(activeRoomCode());
}

function isPlayer() {
  return mySeat() === 0 || mySeat() === 1;
}

function isMyTurn() {
  const game = currentGame();
  return isPlayer() && game.current === mySeat() && !game.gameOver && !boardCutsceneActive;
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

function canStunTile(game, tileIndex, sourceTileIndex = null) {
  const tile = game.board[tileIndex];
  if (!tile) return false;
  if (tileIndex === sourceTileIndex) return false;
  const card = topCard(tile);
  if (card?.value === 14) return false;
  if (tile.stunTurns > 0 || card?.stunned) return false;
  return true;
}

function getCardHint(value) {
  if (value === 3) return "Cannot cover.";
  if (value === 4) return "Shoots diagonal.";
  if (value === 5) return "Shoots straight.";
  if (value === 6) return "Stuns 2 tiles.";
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

function getTileInspectInfo(index) {
  const game = currentGame();
  const tile = game?.board?.[index];
  if (!tile) return null;

  const card = topCard(tile);
  const tokenLines = tile.tokens.length
    ? tile.tokens.map((token) => {
      const meta = TOKEN_TYPES.find((item) => item.id === token.type);
      const ownerId = Number(token.owner);
      const ownerName = Number.isInteger(ownerId) ? (game.players?.[ownerId - 1]?.name || `Player ${ownerId}`) : "Unknown owner";
      const tokenName = meta?.label || "Token";
      const detail = TOKEN_DETAILS[token.type] || "A token is attached to this tile.";
      return `${tokenName} (${ownerName}): ${detail}`;
    }).join("\n")
    : "No tokens on this tile.";

  if (!card) {
    return {
      title: `Tile ${index + 1}`,
      meta: "Empty Tile",
      body: `No card is occupying this tile.\n\nTokens:\n${tokenLines}`
    };
  }

  const ownerId = Number(card.owner);
  const ownerName = Number.isInteger(ownerId) ? (game.players?.[ownerId - 1]?.name || `Player ${ownerId}`) : "Unknown owner";
  const value = effectiveValue(card, tile);
  const statuses = [];
  if (card.value === 14 || tile.locked) statuses.push("Locked by Jester");
  if (tile.stunTurns > 0 || card.stunned) statuses.push(`Stunned${tile.stunTurns > 0 ? ` for ${tile.stunTurns} turn${tile.stunTurns === 1 ? "" : "s"}` : ""}`);
  if (card.protected) statuses.push("Protected by Parry");
  if (card.pierce) statuses.push("Armor Pierce armed");

  return {
    title: CARD_NAMES[card.value] || "Card",
    meta: `Tile ${index + 1} - Card ${card.value}`,
    body: [
      `Owner: ${ownerName}`,
      `Power: ${value}${value !== card.value ? ` (base ${card.value})` : ""}`,
      `Stack: ${tile.stack.length} card${tile.stack.length === 1 ? "" : "s"}`,
      `Status: ${statuses.length ? statuses.join(", ") : "Normal"}`,
      "",
      CARD_DETAILS[card.value] || getCardHint(card.value),
      "",
      `Tokens:\n${tokenLines}`
    ].join("\n")
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

function bindTileInspect(tileEl, index) {
  let holdTimer = null;
  let startX = 0;
  let startY = 0;

  const clearHold = () => {
    window.clearTimeout(holdTimer);
    holdTimer = null;
    tileEl.classList.remove("is-holding");
  };

  tileEl.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (boardCutsceneActive || inspectOverlay.classList.contains("show")) return;
    startX = event.clientX;
    startY = event.clientY;
    tileEl.classList.add("is-holding");
    holdTimer = window.setTimeout(() => {
      tileEl.dataset.suppressClick = "true";
      tileEl.classList.remove("is-holding");
      setInspectOrigin(tileEl, Math.min(window.innerWidth * 0.86, 350));
      openInspect(getTileInspectInfo(index));
    }, 520);
    try {
      tileEl.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic pointer events cannot be captured.
    }
  });

  tileEl.addEventListener("pointermove", (event) => {
    if (!holdTimer) return;
    if (Math.abs(event.clientX - startX) > 12 || Math.abs(event.clientY - startY) > 12) clearHold();
  });

  tileEl.addEventListener("pointerup", (event) => {
    clearHold();
    try {
      tileEl.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures from browser-generated cleanup.
    }
  });
  tileEl.addEventListener("pointercancel", clearHold);
  tileEl.addEventListener("pointerleave", clearHold);
  tileEl.addEventListener("contextmenu", (event) => event.preventDefault());
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
  gameAudio.play("tap");
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
  window.clearTimeout(inspectReturnTimer);
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
  gameAudio.play("reveal");
  render();
}

function closeInspectedCardAnimated() {
  if (inspectedCardIndex === null) return false;
  window.clearTimeout(inspectReturnTimer);
  const index = inspectedCardIndex;
  const card = handEl.querySelector(`[data-hand-index="${index}"].inspected`);
  suppressPieceClickUntil = Date.now() + 360;
  if (!card) {
    inspectedCardIndex = null;
    deckExpanded = true;
    selectedCardIndex = null;
    heldCardIndex = null;
    render();
    return true;
  }
  card.classList.add("returning");
  inspectReturnTimer = window.setTimeout(() => {
    inspectedCardIndex = null;
    deckExpanded = true;
    selectedCardIndex = null;
    heldCardIndex = null;
    setLocalMessage("Deck opened. Pick your next card.");
  }, 260);
  return true;
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
  gameAudio.play("reveal");
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

function syncDeckExpansionClasses() {
  handEl.classList.toggle("deck-expanded", deckExpanded);
  handEl.classList.toggle("deck-holding", heldCardIndex !== null && !draggedCard);
  handEl.closest(".hand-panel")?.classList.toggle("deck-expanded", deckExpanded);
}

function setLocalMessageInline(text) {
  localMessage = text;
  if (messageEl) messageEl.textContent = text;
}

function settleDeckMotion() {
  window.clearTimeout(deckMotionTimer);
  deckMotionTimer = window.setTimeout(() => {
    deckMotionTimer = null;
    if (snapshot && inspectedCardIndex === null && !draggedCard) render();
  }, 460);
}

function openDeckAnimated(message = "Deck opened. Tap a card to select it, hold to inspect it, or drag it.") {
  if (!isMyTurn()) {
    setLocalMessage("Waiting for your turn.");
    return false;
  }
  deckExpanded = true;
  clearHandFocus();
  syncDeckExpansionClasses();
  gameAudio.play("deckOpen");
  setLocalMessageInline(message);
  settleDeckMotion();
  return true;
}

function tuckDeckAnimated() {
  deckExpanded = false;
  selectedCardIndex = null;
  gameAudio.play("deckClose");
  heldCardIndex = null;
  syncDeckExpansionClasses();
  handEl.querySelectorAll(".selected, .held-card").forEach((card) => card.classList.remove("selected", "held-card"));
  renderBoard();
  settleDeckMotion();
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

function boardDelay(ms) {
  return Math.round(ms * BOARD_ANIMATION_SLOWDOWN);
}

function waitForCutscene(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, boardDelay(ms)));
}

function boardTimeout(callback, ms) {
  return window.setTimeout(callback, boardDelay(ms));
}

function setBoardCutsceneActive(active, message = "") {
  boardCutsceneActive = active;
  boardCutsceneMessage = message;
  gameShell.classList.toggle("board-cutscene-active", active);
  if (messageEl && currentGame()) {
    renderStatus();
  }
}

function setBoardCutsceneMessage(message) {
  boardCutsceneMessage = message;
  if (messageEl) messageEl.textContent = message || localMessage || currentGame()?.lastMessage || "Make your move.";
}

function tileCenter(index) {
  const tile = boardEl.querySelector(`[data-tile-index="${index}"]`);
  if (!tile) return null;
  const rect = tile.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect, tile };
}

function boardCardHtml(card) {
  return `
    <div class="power-badge">${card?.value ?? ""}</div>
    <div class="suit-badge">JG</div>
    <div class="card-art"></div>
    <div class="card-name">${CARD_NAMES[card?.value] || "Card"}</div>
  `;
}

function boardTokenStripHtml(tokens = []) {
  if (!tokens.length) return "";
  return `
    <div class="token-strip">
      ${tokens.map((token) => `<span class="mini-token">${TOKEN_TYPES.find((item) => item.id === token.type)?.icon || "?"}</span>`).join("")}
    </div>
  `;
}

function cardTravelStart(owner) {
  const isMine = owner - 1 === mySeat();
  const source = isMine ? handEl : document.querySelector(".opponent-panel");
  const rect = source?.getBoundingClientRect();
  if (rect) {
    return {
      x: rect.left + rect.width / 2,
      y: isMine ? rect.top + rect.height * 0.5 : rect.bottom - 8,
      rotation: isMine ? 7 : -7
    };
  }
  return {
    x: window.innerWidth / 2,
    y: isMine ? window.innerHeight - 84 : 84,
    rotation: isMine ? 7 : -7
  };
}

async function playPlacementVfx(event) {
  const target = tileCenter(event.tile);
  if (!target || !event.card) return;

  const finalCard = target.tile.querySelector(".card");
  const player = currentGame()?.players?.[event.card.owner - 1];
  const playerName = player?.name || `Player ${event.card.owner}`;
  setBoardCutsceneMessage(`${playerName} places ${event.card.value} - ${CARD_NAMES[event.card.value]}.`);
  gameAudio.play("place");

  if (event.card.owner - 1 === mySeat()) {
    pulseTile(event.tile, "placement-impact", 420);
    await waitForCutscene(250);
    return;
  }

  finalCard?.classList.add("cutscene-card-pending");
  const start = cardTravelStart(event.card.owner);
  const ghost = document.createElement("div");
  ghost.className = `card cutscene-placement-card p${event.card.owner}-card card-v${event.card.value}`;
  ghost.style.left = `${start.x}px`;
  ghost.style.top = `${start.y}px`;
  ghost.style.width = `${Math.max(44, target.rect.width * 0.78)}px`;
  ghost.style.height = `${Math.max(52, target.rect.height * 0.84)}px`;
  ghost.style.setProperty("--travel-rot", `${start.rotation}deg`);
  ghost.innerHTML = boardCardHtml(event.card);
  document.body.appendChild(ghost);

  await waitForCutscene(40);
  ghost.classList.add("in-flight");
  ghost.style.left = `${target.x}px`;
  ghost.style.top = `${target.y}px`;
  ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(1)";
  await waitForCutscene(560);
  pulseTile(event.tile, "placement-impact", 480);
  finalCard?.classList.remove("cutscene-card-pending");
  finalCard?.classList.add("cutscene-card-reveal");
  ghost.classList.add("landed");
  boardTimeout(() => {
    ghost.remove();
    finalCard?.classList.remove("cutscene-card-reveal");
  }, 260);
  await waitForCutscene(220);
}

function pulseTile(index, className, duration = 520) {
  const center = tileCenter(index);
  if (!center) return;
  center.tile.classList.remove(className);
  void center.tile.offsetWidth;
  center.tile.classList.add(className);
  boardTimeout(() => center.tile.classList.remove(className), duration);
}

function pieceReturnTarget(owner, kind) {
  const isMine = owner - 1 === mySeat();
  const source = kind === "token" && isMine ? tokenPanelBtn : (isMine ? handEl : document.querySelector(".opponent-panel"));
  const rect = source?.getBoundingClientRect();
  if (rect) {
    return {
      x: rect.left + rect.width / 2,
      y: kind === "token" && isMine ? rect.top + rect.height / 2 : rect.top + rect.height * 0.42
    };
  }
  return {
    x: window.innerWidth / 2,
    y: isMine ? window.innerHeight - 80 : 88
  };
}

function spawnRemovedCardEcho(index, card) {
  const center = tileCenter(index);
  if (!center || !card) return null;
  const echo = document.createElement("div");
  echo.className = `card cutscene-removed-card p${card.owner}-card card-v${card.value}`;
  echo.style.left = `${center.x}px`;
  echo.style.top = `${center.y}px`;
  echo.style.width = `${Math.max(44, center.rect.width * 0.78)}px`;
  echo.style.height = `${Math.max(52, center.rect.height * 0.84)}px`;
  echo.innerHTML = boardCardHtml(card);
  document.body.appendChild(echo);
  boardTimeout(() => echo.classList.add("hit"), 420);
  boardTimeout(() => echo.remove(), 1120);
  return echo;
}

function retainShotTarget(event) {
  if (!event?.removedCard || event.parried || event.retainedTarget?.isConnected) return event?.retainedTarget || null;
  const center = tileCenter(event.to);
  if (!center) return null;
  const retained = document.createElement("div");
  retained.className = `card cutscene-retained-card p${event.removedCard.owner}-card card-v${event.removedCard.value}`;
  retained.style.left = `${center.x}px`;
  retained.style.top = `${center.y}px`;
  retained.style.width = `${Math.max(44, center.rect.width * 0.78)}px`;
  retained.style.height = `${Math.max(52, center.rect.height * 0.84)}px`;
  retained.innerHTML = `${boardCardHtml(event.removedCard)}${boardTokenStripHtml(event.returnedTokens)}`;
  document.body.appendChild(retained);
  event.retainedTarget = retained;
  return retained;
}

function prepareBoardCutsceneVisuals(events) {
  events.forEach((event) => {
    if (event.type === "shot") retainShotTarget(event);
  });
}

function clearBoardCutsceneVisuals(events) {
  events.forEach((event) => {
    event.retainedTarget?.remove();
    event.retainedTarget = null;
  });
}

function spawnReturningCardEcho(index, card, order = 0) {
  const center = tileCenter(index);
  if (!center || !card) return;
  const target = pieceReturnTarget(card.owner, "card");
  const echo = document.createElement("div");
  echo.className = `card cutscene-return-card p${card.owner}-card card-v${card.value}`;
  echo.style.left = `${center.x}px`;
  echo.style.top = `${center.y}px`;
  echo.style.width = `${Math.max(42, center.rect.width * 0.72)}px`;
  echo.style.height = `${Math.max(50, center.rect.height * 0.78)}px`;
  echo.innerHTML = boardCardHtml(card);
  document.body.appendChild(echo);
  boardTimeout(() => {
    echo.classList.add("returning");
    echo.style.left = `${target.x}px`;
    echo.style.top = `${target.y}px`;
  }, 110 + order * 90);
  boardTimeout(() => echo.remove(), 1120 + order * 90);
}

function spawnReturningTokenEcho(index, token, order = 0) {
  const center = tileCenter(index);
  if (!center || !token) return;
  const target = pieceReturnTarget(token.owner, "token");
  const meta = TOKEN_TYPES.find((item) => item.id === token.type);
  const echo = document.createElement("div");
  echo.className = `cutscene-return-token token-${token.type}`;
  echo.textContent = meta?.icon || "?";
  echo.style.left = `${center.x}px`;
  echo.style.top = `${center.y}px`;
  document.body.appendChild(echo);
  boardTimeout(() => {
    echo.classList.add("returning");
    echo.style.left = `${target.x}px`;
    echo.style.top = `${target.y}px`;
  }, 150 + order * 80);
  boardTimeout(() => echo.remove(), 1060 + order * 80);
}

async function playReturnsVfx(tileIndex, cards = [], tokens = []) {
  cards.forEach((card, order) => spawnReturningCardEcho(tileIndex, card, order));
  tokens.forEach((token, order) => spawnReturningTokenEcho(tileIndex, token, cards.length + order));
  if (cards.length || tokens.length) {
    await waitForCutscene(980 + (cards.length + tokens.length) * 90);
  }
}

function fireShotVfx(fromIndex, toIndex) {
  const from = tileCenter(fromIndex);
  const to = tileCenter(toIndex);
  if (!from || !to) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const shot = document.createElement("div");
  shot.className = "shot-vfx";
  shot.style.left = `${from.x}px`;
  shot.style.top = `${from.y}px`;
  shot.style.width = `${distance}px`;
  shot.style.transform = `rotate(${angle}deg)`;
  document.body.appendChild(shot);
  boardTimeout(() => shot.remove(), 840);
}

function stunTileVfx(index) {
  const center = tileCenter(index);
  if (!center) return;
  pulseTile(index, "witch-stun-vfx", 760);
  const rune = document.createElement("div");
  rune.className = "stun-rune-vfx";
  rune.style.left = `${center.x}px`;
  rune.style.top = `${center.y}px`;
  document.body.appendChild(rune);
  boardTimeout(() => rune.remove(), 940);
}

function stunClearVfx(index) {
  const center = tileCenter(index);
  if (!center) return;
  pulseTile(index, "stun-cleared-vfx", 720);
}

function tokenKey(token) {
  return String(token?.id ?? `${token?.owner}-${token?.type}`);
}

async function playTokenAddVfx(event) {
  const target = tileCenter(event.tile);
  if (!target || !event.token) return;
  const meta = TOKEN_TYPES.find((item) => item.id === event.token.type);
  const start = pieceReturnTarget(event.token.owner, "token");
  const token = document.createElement("div");
  token.className = `cutscene-token-vfx token-${event.token.type}`;
  token.textContent = meta?.icon || "?";
  token.style.left = `${start.x}px`;
  token.style.top = `${start.y}px`;
  document.body.appendChild(token);
  setBoardCutsceneMessage(`${meta?.label || "Token"} moves onto the board.`);
  gameAudio.play("token");
  await waitForCutscene(60);
  token.classList.add("in-flight");
  token.style.left = `${target.x}px`;
  token.style.top = `${target.y}px`;
  await waitForCutscene(520);
  pulseTile(event.tile, "placement-impact", 560);
  token.classList.add("landed");
  boardTimeout(() => token.remove(), 320);
  await waitForCutscene(260);
}

async function playSweepVfx(event) {
  const target = tileCenter(event.tile);
  if (!target || !event.card) return;
  const player = currentGame()?.players?.[event.card.owner - 1];
  const playerName = player?.name || `Player ${event.card.owner}`;
  setBoardCutsceneMessage(`${playerName} sweeps ${CARD_NAMES[event.card.value]} across the tile.`);
  gameAudio.play("sweep");

  const start = cardTravelStart(event.card.owner);
  const ghost = document.createElement("div");
  ghost.className = `card cutscene-placement-card p${event.card.owner}-card card-v${event.card.value}`;
  ghost.style.left = `${start.x}px`;
  ghost.style.top = `${start.y}px`;
  ghost.style.width = `${Math.max(44, target.rect.width * 0.78)}px`;
  ghost.style.height = `${Math.max(52, target.rect.height * 0.84)}px`;
  ghost.style.setProperty("--travel-rot", `${start.rotation}deg`);
  ghost.innerHTML = boardCardHtml(event.card);
  document.body.appendChild(ghost);

  await waitForCutscene(70);
  ghost.classList.add("in-flight");
  ghost.style.left = `${target.x}px`;
  ghost.style.top = `${target.y}px`;
  ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(1)";
  await waitForCutscene(700);
  pulseTile(event.tile, "sweep-impact", 860);
  ghost.classList.add("landed");
  boardTimeout(() => ghost.remove(), 280);
  await waitForCutscene(260);
  setBoardCutsceneMessage("Swept cards and tokens return to their owners.");
  await playReturnsVfx(event.tile, event.returnedCards || [], event.returnedTokens || []);
}

async function playShotVfx(event) {
  setBoardCutsceneMessage(event.parried ? "Parry catches the shot." : "A shot cuts across the grid.");
  gameAudio.play("shot");
  pulseTile(event.from, "shooter-cutscene", 720);
  await waitForCutscene(280);
  fireShotVfx(event.from, event.to);
  await waitForCutscene(760);
  pulseTile(event.to, "shot-impact", 760);
  if (event.parried) {
    pulseTile(event.to, "parry-cutscene", 760);
    await waitForCutscene(620);
    return;
  }
  const retainedTarget = event.retainedTarget?.isConnected ? event.retainedTarget : null;
  const removedEcho = retainedTarget || (event.removedCard ? spawnRemovedCardEcho(event.to, event.removedCard) : null);
  removedEcho?.classList.add("hit");
  await waitForCutscene(300);

  if (!retainedTarget) {
    await playReturnsVfx(event.to, event.removedCard ? [event.removedCard] : [], event.returnedTokens || []);
    return;
  }

  retainedTarget.querySelector(".token-strip")?.remove();
  retainedTarget.classList.remove("hit");
  const returnTarget = pieceReturnTarget(event.removedCard.owner, "card");
  retainedTarget.classList.add("returning");
  retainedTarget.style.left = `${returnTarget.x}px`;
  retainedTarget.style.top = `${returnTarget.y}px`;
  (event.returnedTokens || []).forEach((token, order) => spawnReturningTokenEcho(event.to, token, order));
  await waitForCutscene(980 + (event.returnedTokens || []).length * 90);
  retainedTarget.remove();
  event.retainedTarget = null;
}

function topKeyFromGame(game, index) {
  const tile = game?.board?.[index];
  const card = tile ? topCard(tile) : null;
  return card ? `${card.owner}:${card.value}:${card.stunned}:${card.protected}:${tile.stack.length}` : "empty";
}

function stunLevelFromGame(game, index) {
  const tile = game?.board?.[index];
  const card = tile ? topCard(tile) : null;
  return tile ? Math.max(tile.stunTurns || 0, card?.stunned ? 1 : 0) : 0;
}

function isLikelyShotLine(fromIndex, toIndex, value) {
  const fromRow = Math.floor(fromIndex / 4);
  const fromCol = fromIndex % 4;
  const toRow = Math.floor(toIndex / 4);
  const toCol = toIndex % 4;
  const rowDelta = Math.abs(toRow - fromRow);
  const colDelta = Math.abs(toCol - fromCol);
  if (value === 4) return rowDelta === colDelta && rowDelta > 0;
  if (value === 5) return (rowDelta === 0 && colDelta > 0) || (colDelta === 0 && rowDelta > 0);
  return false;
}

function detectBoardCutscenes(previousSnapshot, nextSnapshot) {
  const previousGame = previousSnapshot?.game;
  const nextGame = nextSnapshot?.game;
  if (!previousGame || !nextGame || nextSnapshot?.room?.phase !== "playing") return [];
  const events = [];
  const placements = [];
  const tokenAdditions = [];
  const sweepTiles = new Set();

  for (let index = 0; index < 16; index += 1) {
    const before = previousGame.board[index];
    const after = nextGame.board[index];
    if (!before || !after) continue;
    if (after.stack.length === before.stack.length + 1) {
      const placed = topCard(after);
      if (placed) {
        const event = { type: "place-card", tile: index, card: { ...placed } };
        placements.push(event);
        events.push(event);
      }
    }

    const beforeTokenKeys = new Set(before.tokens.map(tokenKey));
    after.tokens.forEach((token) => {
      if (!beforeTokenKeys.has(tokenKey(token))) {
        tokenAdditions.push({ type: "token-add", tile: index, token: { ...token } });
      }
    });
  }

  if (!previousGame.pendingShot && /sweep/i.test(nextGame.lastMessage || "")) {
    for (let index = 0; index < 16; index += 1) {
      const before = previousGame.board[index];
      const after = nextGame.board[index];
      if (!before || !after || before.stack.length === 0 || after.stack.length !== 0) continue;
      const sweptTop = topCard(before);
      if (!sweptTop) continue;
      const owner = previousGame.players?.[previousGame.current]?.id || previousGame.current + 1;
      const event = {
        type: "sweep",
        tile: index,
        card: { owner, value: sweptTop.value },
        returnedCards: [...before.stack.map((card) => ({ ...card })), { owner, value: sweptTop.value }],
        returnedTokens: before.tokens.map((token) => ({ ...token }))
      };
      sweepTiles.add(index);
      events.push(event);
    }
  }

  tokenAdditions.forEach((event) => events.push(event));

  if (!previousGame.pendingShot && nextGame.pendingShot?.fromIndex !== undefined) {
    events.push({ type: "shooter-ready", from: nextGame.pendingShot.fromIndex });
  }

  if (previousGame.pendingShot && !nextGame.pendingShot) {
    const shot = previousGame.pendingShot;
    const targetIndex = (shot.targets || []).find((index) => {
      const before = previousGame.board[index];
      const after = nextGame.board[index];
      return before && after && before.stack.length > after.stack.length;
    }) ?? (shot.targets || []).find((index) => topKeyFromGame(previousGame, index) !== topKeyFromGame(nextGame, index));
    if (Number.isInteger(targetIndex) && /shot landed|parry|shot was dodged/i.test(nextGame.lastMessage || "")) {
      const before = previousGame.board[targetIndex];
      const after = nextGame.board[targetIndex];
      const removedCard = before && after && before.stack.length > after.stack.length ? topCard(before) : null;
      const returnedTokens = removedCard ? before.tokens.map((token) => ({ ...token })) : [];
      events.push({
        type: "shot",
        from: shot.fromIndex,
        to: targetIndex,
        removedCard,
        returnedTokens,
        parried: /parry|dodged/i.test(nextGame.lastMessage || "")
      });
    }
  }

  if (!previousGame.pendingShot) {
    const removedTargets = [];
    const scriptedShots = new Set();
    for (let index = 0; index < 16; index += 1) {
      const before = previousGame.board[index];
      const after = nextGame.board[index];
      if (sweepTiles.has(index)) continue;
      if (before && after && before.stack.length > after.stack.length) {
        removedTargets.push({
          index,
          removedCard: topCard(before),
          returnedTokens: before.tokens.map((token) => ({ ...token }))
        });
      }
    }
    placements.forEach((placement) => {
      if (![4, 5].includes(placement.card.value)) return;
      const target = removedTargets.find((item) => isLikelyShotLine(placement.tile, item.index, placement.card.value));
      if (target) {
        const shotKey = `${placement.tile}-${target.index}`;
        if (scriptedShots.has(shotKey)) return;
        scriptedShots.add(shotKey);
        events.push({ type: "shooter-ready", from: placement.tile });
        events.push({
          type: "shot",
          from: placement.tile,
          to: target.index,
          removedCard: target.removedCard,
          returnedTokens: target.returnedTokens
        });
      }
    });
    tokenAdditions.forEach((tokenEvent) => {
      const tile = nextGame.board[tokenEvent.tile];
      const card = topCard(tile);
      if (!card || !isShooter(card, tile)) return;
      const value = effectiveValue(card, tile);
      const target = removedTargets.find((item) => isLikelyShotLine(tokenEvent.tile, item.index, value));
      if (!target) return;
      const shotKey = `${tokenEvent.tile}-${target.index}`;
      if (scriptedShots.has(shotKey)) return;
      scriptedShots.add(shotKey);
      events.push({ type: "shooter-ready", from: tokenEvent.tile });
      events.push({
        type: "shot",
        from: tokenEvent.tile,
        to: target.index,
        removedCard: target.removedCard,
        returnedTokens: target.returnedTokens
      });
    });
  }

  for (let index = 0; index < 16; index += 1) {
    if (stunLevelFromGame(previousGame, index) <= 0 && stunLevelFromGame(nextGame, index) > 0) {
      events.push({ type: "witch-stun", tile: index });
    } else if (stunLevelFromGame(previousGame, index) > 0 && stunLevelFromGame(nextGame, index) <= 0) {
      events.push({ type: "stun-clear", tile: index });
    }
  }

  return events;
}

async function playBoardCutscenes(events) {
  setBoardCutsceneActive(true, "Watching the play resolve...");
  try {
    for (const event of events) {
      if (event.type === "place-card") {
        await playPlacementVfx(event);
      }
      if (event.type === "sweep") {
        await playSweepVfx(event);
      }
      if (event.type === "token-add") {
        await playTokenAddVfx(event);
      }
      if (event.type === "shooter-ready") {
        setBoardCutsceneMessage("A shooter readies its line.");
        pulseTile(event.from, "shooter-cutscene", 720);
        await waitForCutscene(520);
      }
      if (event.type === "shot") {
        await playShotVfx(event);
      }
      if (event.type === "witch-stun") {
        setBoardCutsceneMessage("Witchcraft binds a tile.");
        gameAudio.play("stun");
        stunTileVfx(event.tile);
        await waitForCutscene(760);
      }
      if (event.type === "stun-clear") {
        setBoardCutsceneMessage("Curious Potion breaks the stun.");
        stunClearVfx(event.tile);
        await waitForCutscene(640);
      }
    }
  } finally {
    clearBoardCutsceneVisuals(events);
    setBoardCutsceneActive(false);
  }
}

function flushBoardCutscenes() {
  if (!pendingBoardCutscene || pendingBoardCutscene.next !== snapshot) return;
  const events = detectBoardCutscenes(pendingBoardCutscene.previous, pendingBoardCutscene.next);
  pendingBoardCutscene = null;
  if (!events.length) return;
  prepareBoardCutsceneVisuals(events);
  boardCutsceneQueue = boardCutsceneQueue
    .then(() => playBoardCutscenes(events))
    .catch(() => {});
}

function turnSignature() {
  const game = currentGame();
  if (!game || game.gameOver) return "";
  return `${snapshot?.room?.code || "local"}:${game.current}`;
}

function showTurnIntroAfterBoardSettles(kind, signature) {
  boardCutsceneQueue = boardCutsceneQueue
    .then(() => {
      if (signature && turnSignature() !== signature) return;
      showTurnIntro(kind);
    })
    .catch(() => {});
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
  if (game.pendingWitchTile !== null) return canStunTile(game, index, game.pendingWitchTile);
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
    ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(.58)";
    ghost.style.opacity = "0";
  });
  boardTimeout(() => ghost.remove(), 360);
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
    ghost.style.transform = "translate(-50%, -50%) rotate(0deg) scale(.58)";
    ghost.style.opacity = "0";
  });
  boardTimeout(() => ghost.remove(), 380);
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
  const dx = event.clientX - dragCandidate.startX;
  const dy = event.clientY - dragCandidate.startY;
  const distance = Math.hypot(dx, dy);
  if (!dragCandidate.dragging && distance > 10) {
    window.clearTimeout(dragCandidate.holdTimer);
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
      try {
        card.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released capture after the hold.
      }
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
  boardTimeout(() => ghost.remove(), 300);
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
  const dx = event.clientX - tokenDragCandidate.startX;
  const dy = event.clientY - tokenDragCandidate.startY;
  const distance = Math.hypot(dx, dy);
  if (!tokenDragCandidate.dragging && distance > 9) {
    window.clearTimeout(tokenDragCandidate.holdTimer);
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
      try {
        button.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released capture after the hold.
      }
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
  game.players[0].rank = playerProfile.rank || "Unranked";
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
      player.rank = player.rank || playerProfile.rank || "Unranked";
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
    snapshot.room.startedAt = Date.now();
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
    if (game.board.some((_tile, index) => canStunTile(game, index, tileIndex))) {
      game.pendingWitchTile = tileIndex;
      setMessage(game, "Witch placed. Her tile is stunned. Tap a non-Jester tile for the second stun.");
    } else {
      setMessage(game, "Witch placed. No other non-Jester tile can be stunned.");
    }
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
  if (game.pendingWitchTile !== null) return fail("Choose a tile for the Witch stun first.");
  game.pendingShot = null;
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
    return fail("Choose a tile for the Witch stun first.");
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
    const previousSnapshot = structuredClone(snapshot);
    runBotTurn({ mode: "quickplay", phase: "playing", botSeat: 1, game: currentGame() });
    refreshLocalPlayerStats();
    localMessage = "";
    clearHandFocus();
    pendingBoardCutscene = { previous: previousSnapshot, next: snapshot };
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
    previousTurnSignature = "";
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
    previousTurnSignature = "";
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
    previousTurnSignature = "";
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
  const nextTurnSignature = turnSignature();
  flushBoardCutscenes();
  if (phaseChanged) {
    showTurnIntroAfterBoardSettles("match", nextTurnSignature);
  } else if (nextTurnSignature && previousTurnSignature && nextTurnSignature !== previousTurnSignature) {
    showTurnIntroAfterBoardSettles("turn", nextTurnSignature);
  }
  previousTurnSignature = nextTurnSignature;
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
  if (playerTwoJustJoined) gameAudio.play("join");

  waitingRoomCode.textContent = snapshot.room.code;
  document.getElementById("waitingNameOne").textContent = playerOne.name || "Player 1";
  document.getElementById("waitingNameTwo").textContent = playerTwo.connected ? (playerTwo.name || "Player 2") : "Awaiting Player";
  document.getElementById("waitingRankOne").textContent = playerOne.rank || "Unranked";
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
  if (seat === 0 && playerTwoJustJoined) showPlayerJoinedNotification(playerTwo.name, snapshot.room.code);

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
  document.getElementById("seatLabel").textContent = boardCutsceneActive ? "Resolving" : (isOfflineQuickplay() ? (isMyTurn() ? "Your Turn" : "Bot Turn") : (seat === null ? "Spectator" : `Player ${seat + 1}`));
  const onlineStatus = document.getElementById("onlineStatus");
  const contactIsStale = lastServerContactAt && Date.now() - lastServerContactAt > 16_000;
  const connectionState = isOfflineQuickplay()
    ? { label: "Local", state: "local" }
    : consecutiveNetworkFailures > 1 || contactIsStale
      ? { label: "Reconnecting", state: "reconnecting" }
      : socketOpen()
        ? { label: "Live", state: "live" }
        : usingHttpFallback
          ? { label: "Synced", state: "live" }
          : { label: "Offline", state: "offline" };
  onlineStatus.textContent = connectionState.label;
  onlineStatus.dataset.state = connectionState.state;
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

  turnLabel.textContent = boardCutsceneActive ? "Resolving" : (game.gameOver ? "Game Over" : `${current.name || `Player ${game.current + 1}`} Turn`);
  tokenLimit.textContent = `${game.tokensUsed}/2`;
  cancelBtn.textContent = game.pendingShot ? "Skip" : "Cancel";
  messageEl.textContent = boardCutsceneMessage || localMessage || game.lastMessage || "Make your move.";
  document.getElementById("endTurnBtn").disabled = !isMyTurn() || !game.cardPlacedThisTurn || game.pendingWitchTile !== null;
  cancelBtn.disabled = !isMyTurn() || game.pendingWitchTile !== null;
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
      card.className = `card p${top.owner}-card card-v${top.value}`;
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

    bindTileInspect(tileEl, index);
    tileEl.addEventListener("click", (event) => {
      if (consumeHeldClick(tileEl)) {
        event.stopPropagation();
        return;
      }
      onTileClick(index);
    });
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
    card.className = `hand-card p${player.id}-card card-v${value}`;
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
        openDeckAnimated();
        return;
      }
      if (inspectedCardIndex === index) {
        closeInspectedCardAnimated();
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
    button.classList.add(`token-${token.id}`);
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

function showTurnIntro(kind = "match") {
  const game = currentGame();
  if (!game || !turnIntroOverlay || !turnIntroText || !turnIntroKicker) return;
  const seat = mySeat();
  let text = "The duel begins.";
  let kicker = "Match Begins";
  let tone = "neutral";

  if (kind === "turn") {
    const player = game.players?.[game.current];
    const currentName = player?.name || `Player ${game.current + 1}`;
    if (seat === game.current) {
      text = "Your turn.";
      kicker = "Your Turn";
      tone = "your";
    } else if (seat === 0 || seat === 1) {
      text = `${currentName}'s turn.`;
      kicker = "Opponent Turn";
      tone = "opponent";
    } else {
      text = `${currentName}'s turn.`;
      kicker = "Turn Change";
    }
  } else if (seat === game.current) {
    text = "You go first.";
    kicker = "First Move";
    tone = "your";
  } else if (seat === 0 || seat === 1) {
    text = "You go second.";
    kicker = "Second Move";
    tone = "opponent";
  } else {
    text = `Player ${game.current + 1} goes first.`;
    kicker = "Spectating";
  }

  window.clearTimeout(introTimer);
  turnIntroKicker.textContent = kicker;
  turnIntroText.textContent = text;
  turnIntroOverlay.dataset.tone = tone;
  gameAudio.play("turn");
  gameShell.classList.add("intro-blur");
  turnIntroOverlay.classList.add("show");
  turnIntroOverlay.setAttribute("aria-hidden", "false");
  introTimer = window.setTimeout(() => {
    turnIntroOverlay.classList.remove("show");
    turnIntroOverlay.setAttribute("aria-hidden", "true");
    gameShell.classList.remove("intro-blur");
  }, kind === "turn" ? 2100 : 2400);
}

function renderWin() {
  const game = currentGame();
  if (game.gameOver && game.winner) {
    const player = game.players[game.winner - 1];
    winTitle.textContent = `${player.name || `Player ${game.winner}`} Wins!`;
    winText.textContent = "Four in a row.";
    winModal.classList.add("show");
    const winnerKey = `${snapshot?.room?.code || "local"}:${game.winner}`;
    if (announcedWinner !== winnerKey) {
      announcedWinner = winnerKey;
      const reward = awardCompletedMatch(game);
      if (reward) {
        winText.textContent = `${reward.won ? "Victory" : "Match complete"}: +${reward.xp} XP, +${reward.coins} coins${reward.gems ? `, +${reward.gems} gem` : ""}.`;
      }
      gameAudio.play("win");
      if (navigator.vibrate) navigator.vibrate([35, 45, 75]);
    }
  } else {
    winModal.classList.remove("show");
    announcedWinner = null;
  }
}

function explainToken(id) {
  const lines = {
    bard: "Bard: tap one of your 1s or 2s to enhance it into a shooter.",
    ammo: "Ammo Crate: tap one of your 4s, 5s, or Bard-enhanced cards to shoot.",
    pierce: "Armor Pierce: use during a shot if you want to destroy a card 10-13.",
    potion: "Curious Potion: tap a stunned tile, or your Witch to stun another non-Jester tile.",
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
    if (inspectedCardIndex !== null) closeInspectedCardAnimated();
    inspectedTokenId = null;
    if (inspectedCardIndex === null) render();
    return;
  }
  if (game.pendingWitchTile !== null) {
    if (!canStunTile(game, index, game.pendingWitchTile)) {
      const card = topCard(game.board[index]);
      setLocalMessage(card?.value === 14 ? "The Jester cannot be stunned." : "That tile cannot be stunned.");
      return;
    }
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
  if (inspectedCardIndex !== null) {
    closeInspectedCardAnimated();
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
    setLocalMessage("Pick a card, or tap outside the board to tuck the deck.");
    return;
  }
  sendAction({ type: "removeToken", tileIndex: index }, false);
}

function setNetworkActionBusy(busy) {
  networkActionInFlight = busy;
  gameShell.classList.toggle("network-busy", busy);
}

function sendAction(action, clearSelection = true, recoveryAttempt = 0) {
  if (!action.actionId) action = { ...action, actionId: crypto.randomUUID() };
  if (boardCutsceneActive && action.type !== "restart") {
    setLocalMessageInline("Let the play resolve first.");
    return;
  }
  if (isOfflineQuickplay()) {
    const previousSnapshot = structuredClone(snapshot);
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
    pendingBoardCutscene = { previous: previousSnapshot, next: snapshot };
    render();
    if (action.type === "endTurn" && result.ok) scheduleOfflineBotTurn();
    return;
  }

  if (recoveryAttempt === 0) {
    if (networkActionInFlight) {
      setLocalMessageInline("Finishing the current play...");
      return;
    }
    setNetworkActionBusy(true);
  }

  sendEvent("gameAction", action, (result) => {
    if (!result?.ok) {
      if (recoveryAttempt < 2 && shouldRecoverRoomError(result?.message)) {
        setLocalMessage("Reconnecting to the room...");
        rejoinActiveRoom({
          silent: true,
          callback: () => {
            window.setTimeout(() => sendAction(action, clearSelection, recoveryAttempt + 1), recoveryAttempt === 0 ? 160 : 520);
          }
        });
        return;
      }
      setNetworkActionBusy(false);
      gameAudio.play("error");
      setLocalMessage(result?.message || "That move is not available.");
      return;
    }
    setNetworkActionBusy(false);
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
    render();
  });
}

function refreshActiveConnection() {
  if (isOfflineQuickplay()) return;
  if (!socketOpen() && !usingHttpFallback) connectRealtime();
  if (activeRoomCode()) rejoinActiveRoom({ silent: true });
}

function createRoom(target = null) {
  if (menuRequestInFlight) return;
  const actionStartedAt = Date.now();
  bounceMenuTarget(target);
  const name = playerNameInput.value.trim() || "Jester";
  localStorage.setItem("jg-name", name);
  primeRoomNotificationPermission();
  if (isOfflineQuickplay()) {
    window.clearTimeout(botTurnTimer);
    snapshot = null;
  }
  setMenuRequestBusy(true, "Opening a private court...");
  sendEvent("createRoom", { name, rank: playerProfile.rank }, (result) => {
    setMenuRequestBusy(false);
    if (!result?.ok) {
      gameAudio.play("error");
      setMenuStatus(result?.message || "Could not create room.");
      return;
    }
    rememberRoomSession(result.code, result.seat ?? result.snapshot?.you?.seat ?? 0);
    roomCodeInput.value = result.code;
    window.history.replaceState(null, "", `?room=${result.code}`);
    startRoomHeartbeat();
    maybeRegisterRoomNotification(true);
    const remainingDelay = Math.max(0, 480 - (Date.now() - actionStartedAt));
    showScreen("game", { delay: remainingDelay });
  });
}

function createBotRoom(target = null) {
  showScreen("game", {
    trigger: target,
    onActivate: () => {
      const name = playerNameInput.value.trim() || "Jester";
      localStorage.setItem("jg-name", name);
      window.clearTimeout(botTurnTimer);
      if (snapshot?.room?.code && !isOfflineQuickplay()) {
        sendEvent("leaveRoom", { code: snapshot.room.code, seat: mySeat() }, () => {});
      }
      stopPolling();
      stopRoomHeartbeat();
      forgetRoomSession();
      const startedAt = Date.now();
      snapshot = {
        room: {
          code: "",
          mode: "quickplay",
          offline: true,
          phase: "playing",
          ready: [true, true],
          joinedAt: startedAt,
          startedAt
        },
        you: { seat: 0 },
        game: createLocalGame(name)
      };
      renderRoomCode = "";
      previousRoomPhase = "";
      previousTurnSignature = "";
      previousPlayerTwoConnected = true;
      previousShowingTokens = false;
      localMessage = "";
      roomCodeInput.value = "";
      autoJoinAttempted = true;
      window.history.replaceState(null, "", window.location.pathname);
      render();
    }
  });
}

function joinRoom(target = null) {
  if (menuRequestInFlight) return;
  const actionStartedAt = Date.now();
  bounceMenuTarget(target);
  const name = playerNameInput.value.trim() || "Jester";
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) {
    gameAudio.play("error");
    setMenuStatus("Enter a room code.");
    return;
  }
  localStorage.setItem("jg-name", name);
  if (isOfflineQuickplay()) {
    window.clearTimeout(botTurnTimer);
    snapshot = null;
  }
  setMenuRequestBusy(true, "Finding the room...");
  sendEvent("joinRoom", { code, name, rank: playerProfile.rank }, (result) => {
    setMenuRequestBusy(false);
    if (!result?.ok) {
      gameAudio.play("error");
      setMenuStatus(result?.message || "Could not join room.");
      return;
    }
    rememberRoomSession(result.code || code, result.seat ?? result.snapshot?.you?.seat ?? 1);
    window.history.replaceState(null, "", `?room=${code}`);
    startRoomHeartbeat();
    const remainingDelay = Math.max(0, 480 - (Date.now() - actionStartedAt));
    showScreen("game", { delay: remainingDelay });
  });
}

function leaveRoom(target = null) {
  const code = snapshot?.room?.code;
  const seat = mySeat();
  window.clearTimeout(botTurnTimer);
  if (code && !isOfflineQuickplay()) {
    sendEvent("leaveRoom", { code, seat }, () => {});
  }
  stopPolling();
  stopRoomHeartbeat();
  forgetRoomSession();
  snapshot = null;
  renderRoomCode = "";
  previousRoomPhase = "";
  previousTurnSignature = "";
  localMessage = "";
  roomCodeInput.value = "";
  autoJoinAttempted = true;
  window.history.replaceState(null, "", window.location.pathname);
  showScreen("menu", { trigger: target });
}

function pushNotificationsSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function primeRoomNotificationPermission() {
  if (!pushNotificationsSupported() || Notification.permission !== "default") return null;
  roomNotificationPermissionPromise = Notification.requestPermission().catch(() => "default");
  return roomNotificationPermissionPromise;
}

async function maybeRegisterRoomNotification(forcePrompt = false) {
  const code = activeRoomCode();
  const seat = mySeat();
  if (!code || seat !== 0 || isOfflineQuickplay() || !pushNotificationsSupported()) return;
  if (notificationRegistrationInFlight) return;
  const registrationKey = `${code}:${seat}`;
  if (!forcePrompt && lastNotificationRegistrationKey === registrationKey) return;
  if (Notification.permission === "denied") return;
  if (!forcePrompt && Notification.permission !== "granted") return;

  notificationRegistrationInFlight = true;
  try {
    let permission = roomNotificationPermissionPromise
      ? await roomNotificationPermissionPromise
      : Notification.permission;
    if (permission === "default" && forcePrompt) permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const keyResponse = await fetch("/api/push-public-key", { cache: "no-store" });
    const keyResult = await keyResponse.json();
    if (!keyResult.ok || !keyResult.publicKey) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey)
      });
    }

    const response = await fetch("/api/register-room-notification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, clientId, seat, subscription: subscription.toJSON() })
    });
    const result = await response.json();
    if (result.ok) {
      lastNotificationRegistrationKey = registrationKey;
      if (forcePrompt) setMenuStatus("Room alerts enabled.");
    }
  } catch {
    if (forcePrompt) setMenuStatus("Room created. Alerts may need browser notification permission.");
  } finally {
    notificationRegistrationInFlight = false;
  }
}

async function showPlayerJoinedNotification(playerName, roomCode) {
  if (!document.hidden || !pushNotificationsSupported() || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification("Jester's Grid", {
      body: `${playerName || "Player 2"} is waiting in room ${roomCode}.`,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `jg-room-${roomCode}`,
      data: { url: `/?room=${roomCode}` }
    });
  } catch {
    try {
      new Notification("Jester's Grid", {
        body: `${playerName || "Player 2"} is waiting in room ${roomCode}.`,
        icon: "/icon.svg"
      });
    } catch {
      // Notification support can vary on mobile browsers.
    }
  }
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

window.UI_ASSETS = UI_ASSETS;
window.applyHomeUiAssets = applyHomeUiAssets;
window.handleMenuAction = handleMenuAction;
window.updateJesterProfile = updatePlayerProfile;
applyHomeUiAssets();
connectRealtime();

document.addEventListener("pointerdown", () => gameAudio.unlock(), { once: true, capture: true });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshActiveConnection();
});
window.addEventListener("focus", refreshActiveConnection);
window.addEventListener("online", refreshActiveConnection);
document.querySelectorAll("[data-menu-action]").forEach((button) => {
  button.addEventListener("click", (event) => {
    gameAudio.play("tap");
    const action = event.currentTarget.dataset.menuAction;
    if (action) handleMenuAction(action, event.currentTarget);
  });
});
playerNameInput.addEventListener("input", () => {
  const name = playerNameInput.value.trim().slice(0, 18);
  playerProfile.name = name || DEFAULT_PLAYER_PROFILE.name;
  localStorage.setItem("jg-name", playerProfile.name);
  savePlayerProfile();
});
document.getElementById("createRoomBtn").addEventListener("click", (event) => createRoom(event.currentTarget));
document.getElementById("joinRoomBtn").addEventListener("click", (event) => joinRoom(event.currentTarget));
onlineBackBtn.addEventListener("click", (event) => {
  setOnlineJoinOpen(false);
  showScreen("menu", { trigger: event.currentTarget });
});
onlineJoinRevealBtn.addEventListener("click", (event) => {
  bounceMenuTarget(event.currentTarget);
  window.setTimeout(() => setOnlineJoinOpen(true), 260);
});
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});
roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});
document.getElementById("rulesBtn").addEventListener("click", (event) => {
  rulesReturnScreen = screens.online.classList.contains("active") ? "online" : "menu";
  showScreen("rules", { trigger: event.currentTarget });
});
document.getElementById("backRules").addEventListener("click", (event) => showScreen(snapshot ? "game" : rulesReturnScreen, { trigger: event.currentTarget }));
document.getElementById("backToMenu").addEventListener("click", (event) => showScreen("menu", { trigger: event.currentTarget }));
waitingBackBtn.addEventListener("click", (event) => leaveRoom(event.currentTarget));
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
  event.stopPropagation();
  openDeckAnimated();
});
window.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (Date.now() < suppressPieceClickUntil) return;
  if (!deckExpanded && !showingTokens && inspectedCardIndex === null && inspectedTokenId === null && heldCardIndex === null && heldTokenId === null && selectedCardIndex === null && selectedToken === null) return;
  if (target.closest(".settings-menu, .settings-button, .modal, .inspect-overlay, .waiting-room")) return;
  if (inspectedCardIndex !== null) {
    closeInspectedCardAnimated();
    return;
  }
  if (inspectedTokenId !== null) {
    inspectedTokenId = null;
    heldTokenId = null;
    render();
    return;
  }
  if (target.closest(".hand-card, .token-button, .token-toggle")) return;
  if (target.closest(".board-frame")) return;
  if (deckExpanded) {
    tuckDeckAnimated();
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
  if (event.target instanceof Element) closeInspect();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInspect();
});
document.getElementById("themeGear").addEventListener("click", () => settingsMenu.classList.toggle("open"));
document.getElementById("settingsThemeBtn").addEventListener("click", () => {
  applyTheme(document.body.getAttribute("data-theme") === "light" ? "dark" : "light");
  settingsMenu.classList.remove("open");
});
const settingsSoundState = document.getElementById("settingsSoundState");
const updateSoundSettingLabel = () => {
  if (settingsSoundState) settingsSoundState.textContent = gameAudio.enabled ? "On" : "Off";
};
updateSoundSettingLabel();
document.getElementById("settingsSoundBtn").addEventListener("click", () => {
  gameAudio.toggle();
  updateSoundSettingLabel();
  settingsMenu.classList.remove("open");
  setLocalMessage(`Sound ${gameAudio.enabled ? "on" : "off"}.`);
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
document.getElementById("settingsTutorialBtn").addEventListener("click", (event) => {
  settingsMenu.classList.remove("open");
  showScreen("rules", { trigger: event.currentTarget });
});
document.getElementById("playAgainBtn").addEventListener("click", () => sendAction({ type: "restart" }));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
