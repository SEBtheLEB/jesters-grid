const assert = require("assert");
const { createBotStrategy } = require("../bot-strategy");

const WIN_LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12]
];

function emptyTile() {
  return { stack: [], tokens: [], stunnedBy: null, stunTurns: 0, locked: false };
}

function topCard(tile) {
  return tile.stack[tile.stack.length - 1] || null;
}

function effectiveValue(card, tile) {
  const hasBard = tile.tokens.some((token) => token.owner === card.owner && token.type === "bard");
  if (hasBard && card.value === 1) return 4;
  if (hasBard && card.value === 2) return 5;
  return card.value;
}

function isShooter(card, tile) {
  return [4, 5].includes(effectiveValue(card, tile));
}

function canStunTile(game, tileIndex, sourceTileIndex = null) {
  const tile = game.board[tileIndex];
  const card = topCard(tile);
  return !!tile && tileIndex !== sourceTileIndex && card?.value !== 14 && tile.stunTurns <= 0 && !card?.stunned;
}

function canPlaceCard(game, tileIndex, value) {
  const tile = game.board[tileIndex];
  const card = topCard(tile);
  if (tile.locked || tile.stunTurns > 0 || card?.stunned) return false;
  if (!card) return true;
  if (card.value === 14 || card.value === 3) return false;
  return value >= card.value;
}

function canShootCard(target, shooter) {
  if (target.value === 14) return false;
  if (target.value === 3 || target.value >= 10) return !!shooter.pierce;
  return true;
}

function getShotTargets(game, tileIndex, value, shooter) {
  if (![4, 5].includes(value)) return [];
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

function getHighCardShotTargets(game, tileIndex, value, shooter) {
  return getShotTargets(game, tileIndex, value, { ...shooter, pierce: true }).filter((index) => {
    const card = topCard(game.board[index]);
    return card && (card.value === 3 || (card.value >= 10 && card.value !== 14));
  });
}

const strategy = createBotStrategy({
  winLines: WIN_LINES,
  topCard,
  effectiveValue,
  isShooter,
  canStunTile,
  canPlaceCard,
  getShotTargets,
  getHighCardShotTargets
});

function player(id, hand = []) {
  return {
    id,
    hand: [...hand],
    deck: [],
    tokens: { bard: 2, ammo: 2, pierce: 2, potion: 2, parry: 1 }
  };
}

function gameWithHand(hand) {
  return {
    board: Array.from({ length: 16 }, emptyTile),
    players: [player(1), player(2, hand)],
    current: 1,
    tokensUsed: 0,
    pendingShot: null,
    pendingWitchTile: null,
    placedTokensThisTurn: []
  };
}

function setCard(game, index, owner, value, extra = {}) {
  game.board[index].stack.push({ owner, value, stunned: false, protected: false, pierce: false, ...extra });
  if (value === 14) game.board[index].locked = true;
  return game.board[index];
}

function chosenValue(game, move) {
  return game.players[game.current].hand[move.handIndex];
}

{
  const game = gameWithHand([14, 1, 2, 7, 8, 9]);
  const move = strategy.chooseCardMove(game);
  assert.notStrictEqual(chosenValue(game, move), 14, "Bot should conserve the opening Jester instead of auto-playing it.");
}

{
  const game = gameWithHand([1, 7, 14]);
  setCard(game, 0, 2, 2);
  setCard(game, 1, 2, 4);
  setCard(game, 2, 2, 8);
  const move = strategy.chooseCardMove(game);
  assert.strictEqual(move.tileIndex, 3, "Bot should complete an immediate four-card line.");
}

{
  const game = gameWithHand([1, 3, 7, 14]);
  setCard(game, 0, 1, 2);
  setCard(game, 1, 1, 5);
  setCard(game, 2, 1, 9);
  const move = strategy.chooseCardMove(game);
  assert.strictEqual(move.tileIndex, 3, "Bot should block the opponent's immediate win.");
  assert.ok([3, 14].includes(chosenValue(game, move)), "Bot should make the block permanent with Shield or Jester when possible.");
}

{
  const game = gameWithHand([6, 1, 7]);
  const move = strategy.chooseCardMove(game);
  assert.notStrictEqual(chosenValue(game, move), 6, "Bot should not spend Witch when no useful freeze exists.");
}

{
  const game = gameWithHand([]);
  setCard(game, 4, 1, 4);
  setCard(game, 5, 1, 14);
  setCard(game, 6, 1, 9);
  setCard(game, 10, 2, 6);
  game.pendingWitchTile = 10;
  const target = strategy.chooseWitchTarget(game);
  assert.strictEqual(target.tileIndex, 7, "Witch should freeze the open winning square.");
  assert.notStrictEqual(target.tileIndex, 5, "Witch must never target Jester.");
}

{
  const game = gameWithHand([]);
  setCard(game, 5, 2, 14);
  assert.strictEqual(strategy.chooseSupportAction(game), null, "Bot must not waste a token on Jester.");
}

{
  const game = gameWithHand([]);
  setCard(game, 0, 1, 4);
  setCard(game, 1, 1, 7);
  setCard(game, 2, 1, 11);
  setCard(game, 5, 2, 6);
  const action = strategy.chooseSupportAction(game);
  assert.deepStrictEqual(
    { type: action?.type, tileIndex: action?.tileIndex, reason: action?.reason },
    { type: "potion", tileIndex: 5, reason: "awaken-witch" },
    "Curious Potion should awaken Witch only when it creates a valuable freeze."
  );
}

{
  const game = gameWithHand([]);
  setCard(game, 0, 1, 4);
  setCard(game, 1, 1, 7);
  setCard(game, 2, 1, 11);
  const witchTile = setCard(game, 5, 2, 6, { stunned: true });
  witchTile.stunTurns = 1;
  witchTile.stunnedBy = 2;
  const action = strategy.chooseSupportAction(game);
  assert.strictEqual(action?.reason, "clear-witch-for-reactivation", "Bot should begin the two-Potion Witch combo only for a decisive target.");
}

{
  const game = gameWithHand([]);
  setCard(game, 5, 2, 4);
  setCard(game, 0, 1, 9);
  const action = strategy.chooseSupportAction(game);
  assert.strictEqual(action?.type, "ammo", "Bot should spend Ammo when a shooter has a valuable target.");
  assert.strictEqual(action?.tileIndex, 5);
}

{
  const game = gameWithHand([]);
  setCard(game, 5, 2, 1);
  setCard(game, 0, 1, 9);
  const action = strategy.chooseSupportAction(game);
  assert.strictEqual(action?.type, "bard", "Bot should recognize Bard-to-shooter combinations.");
  assert.strictEqual(action?.tileIndex, 5);
}

{
  const game = gameWithHand([]);
  setCard(game, 0, 2, 14);
  setCard(game, 1, 2, 9);
  setCard(game, 5, 1, 5);
  const action = strategy.chooseSupportAction(game);
  assert.strictEqual(action?.type, "parry", "Bot should protect a genuinely exposed card.");
  assert.strictEqual(action?.tileIndex, 1, "Parry should never be wasted on unshootable Jester.");
}

{
  const game = gameWithHand([]);
  setCard(game, 5, 2, 4);
  setCard(game, 0, 1, 2);
  setCard(game, 10, 1, 13);
  game.pendingShot = { fromIndex: 5, targets: [0], shooterOwner: 2, fromToken: false };
  const plan = strategy.chooseShotPlan(game);
  assert.strictEqual(plan?.usePierce, true, "Bot should spend Armor Pierce when the high target is materially better.");
  assert.strictEqual(plan?.tileIndex, 10);
}

{
  const game = gameWithHand([7, 1, 14]);
  setCard(game, 5, 1, 7);
  const move = strategy.chooseCardMove(game);
  assert.strictEqual(chosenValue(game, move), 7, "Bot should recognize a useful enemy sweep.");
  assert.strictEqual(move.tileIndex, 5, "Bot should sweep the matching enemy card before its follow-up placement.");
}

{
  const game = gameWithHand([1, 13]);
  const move = strategy.chooseCardMove(game);
  assert.strictEqual(chosenValue(game, move), 1, "Bot should develop a low card instead of exposing King on an empty opening board.");
}

{
  const game = gameWithHand([]);
  const frozen = setCard(game, 5, 2, 9, { stunned: true });
  frozen.stunTurns = 1;
  frozen.stunnedBy = 2;
  assert.strictEqual(strategy.chooseSupportAction(game), null, "Bot should not waste Curious Potion clearing an ordinary protected tile.");
}

{
  const game = gameWithHand([]);
  setCard(game, 0, 2, 6);
  setCard(game, 5, 1, 9);
  game.pendingWitchTile = 0;
  const target = strategy.chooseWitchTarget(game);
  assert.strictEqual(topCard(game.board[target.tileIndex]), null, "Witch should freeze useful open space instead of protecting an occupied enemy tile.");
}

console.log("Bot strategy smoke test passed (15 tactical scenarios).");
