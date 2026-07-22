(function exposeJestersGridBot(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.JestersGridBot = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBotModule() {
  "use strict";

  const DEFAULT_WIN_LINES = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
    [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
    [0, 5, 10, 15], [3, 6, 9, 12]
  ];
  const LINE_VALUES = [0, 120, 620, 3900, 180000];

  function createBotStrategy(rules) {
    const winLines = rules.winLines || DEFAULT_WIN_LINES;
    const topCard = rules.topCard;
    const effectiveValue = rules.effectiveValue;
    const isShooter = rules.isShooter;
    const canStunTile = rules.canStunTile;
    const canPlaceCard = rules.canPlaceCard;
    const getShotTargets = rules.getShotTargets;
    const getHighCardShotTargets = rules.getHighCardShotTargets;

    function cloneGame(game) {
      return {
        ...game,
        board: game.board.map((tile) => ({
          ...tile,
          stack: tile.stack.map((card) => ({ ...card })),
          tokens: tile.tokens.map((token) => ({ ...token }))
        })),
        players: game.players.map((player) => ({
          ...player,
          hand: [...player.hand],
          deck: [...(player.deck || [])],
          tokens: { ...player.tokens }
        })),
        pendingShot: game.pendingShot ? { ...game.pendingShot, targets: [...game.pendingShot.targets] } : null,
        placedTokensThisTurn: [...(game.placedTokensThisTurn || [])]
      };
    }

    function ownerAt(game, index) {
      return topCard(game.board[index])?.owner || 0;
    }

    function enemyOf(ownerId) {
      return ownerId === 1 ? 2 : 1;
    }

    function occupiedCount(game) {
      return game.board.reduce((total, tile) => total + (topCard(tile) ? 1 : 0), 0);
    }

    function linePressure(game, tileIndex, ownerId) {
      let score = 0;
      winLines.forEach((line) => {
        if (!line.includes(tileIndex)) return;
        const owned = line.filter((index) => ownerAt(game, index) === ownerId).length;
        const enemy = line.filter((index) => ownerAt(game, index) && ownerAt(game, index) !== ownerId).length;
        if (enemy === 0) score += LINE_VALUES[owned] / 7;
        if (owned === 3) score += 620;
        else if (owned === 2) score += 190;
      });
      return score;
    }

    function threatTiles(game, ownerId) {
      const threats = new Set();
      winLines.forEach((line) => {
        const owned = line.filter((index) => ownerAt(game, index) === ownerId).length;
        if (owned !== 3) return;
        line.forEach((index) => {
          if (ownerAt(game, index) !== ownerId) threats.add(index);
        });
      });
      return threats;
    }

    function canAnyCardTakeTile(game, tileIndex) {
      for (let value = 1; value <= 14; value += 1) {
        if (canPlaceCard(game, tileIndex, value)) return true;
      }
      return false;
    }

    function immediateWinningReplies(game, ownerId) {
      let replies = 0;
      threatTiles(game, ownerId).forEach((index) => {
        if (canAnyCardTakeTile(game, index)) replies += 1;
      });
      return replies;
    }

    function ownsWinningLine(game, ownerId) {
      return winLines.some((line) => line.every((index) => ownerAt(game, index) === ownerId));
    }

    function tileDurability(card, tile) {
      if (!card) return 0;
      if (card.value === 14 || tile.locked) return 720;
      if (card.value === 3) return 520;
      if (card.value >= 10) return 220 + card.value * 12;
      if (card.protected) return 250;
      return card.value * 16;
    }

    function evaluateBoard(game, ownerId) {
      const enemyId = enemyOf(ownerId);
      let score = 0;

      winLines.forEach((line) => {
        let own = 0;
        let enemy = 0;
        line.forEach((index) => {
          const owner = ownerAt(game, index);
          if (owner === ownerId) own += 1;
          else if (owner === enemyId) enemy += 1;
        });
        if (enemy === 0) score += LINE_VALUES[own];
        else if (own === 0) score -= LINE_VALUES[enemy] * 1.14;
        else score += own * own * 48 - enemy * enemy * 54;
      });

      game.board.forEach((tile, index) => {
        const card = topCard(tile);
        if (!card) return;
        const sign = card.owner === ownerId ? 1 : -1;
        const positional = winLines.filter((line) => line.includes(index)).length * 38;
        score += sign * (120 + positional + tileDurability(card, tile));
        if (tile.stack.length > 1) {
          const revealed = tile.stack[tile.stack.length - 2];
          score += (revealed.owner === ownerId ? 1 : -1) * 72;
        }
        if (tile.stunTurns > 0) {
          // A frozen tile cannot be covered or shot, so it protects its current owner.
          score += sign * 145;
        }
      });

      score -= immediateWinningReplies(game, enemyId) * 9200;
      score += immediateWinningReplies(game, ownerId) * 3100;
      return score;
    }

    function scoreStunTarget(game, index, ownerId, sourceTileIndex = null) {
      if (!canStunTile(game, index, sourceTileIndex)) return -Infinity;
      const enemyId = enemyOf(ownerId);
      const tile = game.board[index];
      const card = topCard(tile);
      const enemyThreats = threatTiles(game, enemyId);
      const ownThreats = threatTiles(game, ownerId);
      let score = winLines.filter((line) => line.includes(index)).length * 28;

      if (!card) {
        if (enemyThreats.has(index)) score += 5200;
        if (ownThreats.has(index)) score -= 2600;
        if ([5, 6, 9, 10].includes(index)) score += 150;
        return score + 160;
      }

      if (card.owner === ownerId) {
        score += 360 + linePressure(game, index, ownerId);
        if (card.value <= 2) score += 420;
        if (isShooter(card, tile)) score += 180;
        if (card.value >= 10 || card.value === 3) score -= 260;
        return score;
      }

      // Freezing an occupied enemy tile protects it from covers and shots.
      score -= 1150 + card.value * 42 + linePressure(game, index, enemyId);
      if (isShooter(card, tile)) score += 240;
      return score;
    }

    function chooseWitchTarget(game, sourceTileIndex = game.pendingWitchTile) {
      const ownerId = game.players[game.current].id;
      let best = null;
      let bestScore = -Infinity;
      game.board.forEach((_tile, index) => {
        const score = scoreStunTarget(game, index, ownerId, sourceTileIndex);
        if (score > bestScore || (score === bestScore && (best === null || index < best))) {
          bestScore = score;
          best = index;
        }
      });
      return best === null ? null : { tileIndex: best, score: bestScore };
    }

    function scoreShotTarget(game, index, shooterOwner) {
      const tile = game.board[index];
      const card = topCard(tile);
      if (!card || card.owner === shooterOwner) return -Infinity;
      const enemyThreat = threatTiles(game, card.owner).has(index);
      const underneath = tile.stack[tile.stack.length - 2] || null;
      let score = 260 + card.value * 105 + linePressure(game, index, card.owner);
      if (enemyThreat) score += 3400;
      if (underneath?.owner === shooterOwner) score += 2400;
      else if (underneath?.owner === card.owner) score -= 220;
      if (tile.tokens.length) score += tile.tokens.length * 150;
      if (card.protected) score = Math.max(260, score * 0.28);
      return score;
    }

    function bestScoredTarget(game, targets, shooterOwner) {
      let best = null;
      let bestScore = -Infinity;
      targets.forEach((index) => {
        const score = scoreShotTarget(game, index, shooterOwner);
        if (score > bestScore || (score === bestScore && (best === null || index < best))) {
          best = index;
          bestScore = score;
        }
      });
      return best === null ? null : { tileIndex: best, score: bestScore };
    }

    function chooseShotPlanForShooter(game, fromIndex, regularTargets = null) {
      const tile = game.board[fromIndex];
      const shooter = topCard(tile);
      if (!shooter || !isShooter(shooter, tile)) return null;
      const value = effectiveValue(shooter, tile);
      const regular = regularTargets || getShotTargets(game, fromIndex, value, shooter);
      const bestRegular = bestScoredTarget(game, regular, shooter.owner);
      const player = game.players[game.current];
      const canPierce = !shooter.pierce && player.tokens.pierce > 0 && game.tokensUsed < 2;

      if (canPierce) {
        const highTargets = getHighCardShotTargets(game, fromIndex, value, shooter);
        const bestHigh = bestScoredTarget(game, highTargets, shooter.owner);
        if (bestHigh) {
          const conservedScore = bestHigh.score - 720;
          if (bestHigh.score >= 1050 && (!bestRegular || conservedScore > bestRegular.score + 180)) {
            return { ...bestHigh, usePierce: true };
          }
        }
      }

      return bestRegular ? { ...bestRegular, usePierce: false } : null;
    }

    function chooseShotPlan(game) {
      if (!game.pendingShot) return null;
      return chooseShotPlanForShooter(game, game.pendingShot.fromIndex, game.pendingShot.targets || []);
    }

    function simulateShot(game, plan, fromIndex) {
      if (!plan) return;
      const shooter = topCard(game.board[fromIndex]);
      if (plan.usePierce && shooter) shooter.pierce = true;
      const tile = game.board[plan.tileIndex];
      const target = topCard(tile);
      if (!target) return;
      if (target.protected) {
        target.protected = false;
        const parryIndex = tile.tokens.findIndex((token) => token.type === "parry" && token.owner === target.owner);
        if (parryIndex >= 0) tile.tokens.splice(parryIndex, 1);
        return;
      }
      tile.stack.pop();
      tile.tokens = [];
      if (!topCard(tile)) tile.locked = false;
    }

    function emptyTileLike() {
      return { stack: [], tokens: [], stunnedBy: null, stunTurns: 0, locked: false };
    }

    function bestMoveInternal(game, sweepDepth) {
      const player = game.players[game.current];
      let best = null;
      player.hand.forEach((_value, handIndex) => {
        game.board.forEach((_tile, tileIndex) => {
          const score = scoreCardMove(game, handIndex, tileIndex, sweepDepth);
          if (!Number.isFinite(score)) return;
          const value = player.hand[handIndex];
          const bestValue = best ? player.hand[best.handIndex] : Infinity;
          if (score > (best?.score ?? -Infinity) ||
              (score === best?.score && (value < bestValue || (value === bestValue && tileIndex < best.tileIndex)))) {
            best = { handIndex, tileIndex, score };
          }
        });
      });
      return best;
    }

    function scoreCardMove(game, handIndex, tileIndex, sweepDepth = 2) {
      const player = game.players[game.current];
      const ownerId = player.id;
      const enemyId = enemyOf(ownerId);
      const value = player.hand[handIndex];
      if (!canPlaceCard(game, tileIndex, value)) return -Infinity;

      const beforeTile = game.board[tileIndex];
      const covered = topCard(beforeTile);
      const sweep = !!covered && covered.value === value;
      const enemyThreats = threatTiles(game, enemyId);
      const ownThreats = threatTiles(game, ownerId);
      const earlyBoard = occupiedCount(game);
      const simulated = cloneGame(game);
      simulated.players[simulated.current].hand.splice(handIndex, 1);

      if (sweep) {
        if (sweepDepth <= 0) return -Infinity;
        const sweptTile = simulated.board[tileIndex];
        const sweptTop = topCard(sweptTile);
        const sweepValue = sweptTile.stack.reduce((total, card) => total + card.value * 44, 0) + sweptTile.tokens.length * 180;
        simulated.board[tileIndex] = emptyTileLike();
        const follow = bestMoveInternal(simulated, sweepDepth - 1);
        if (!follow) return -Infinity;
        let score = follow.score;
        score += sweptTop?.owner === enemyId ? 920 + sweepValue : -2800 - sweepValue;
        if (enemyThreats.has(tileIndex)) score += 5200;
        return score;
      }

      const tile = simulated.board[tileIndex];
      const card = { owner: ownerId, value, stunned: false, protected: false, pierce: false };
      tile.stack.push(card);
      if (value === 14) tile.locked = true;

      let tactical = 0;
      if (enemyThreats.has(tileIndex)) tactical += 10600;
      if (ownThreats.has(tileIndex)) tactical += 4200;

      if (covered?.owner === enemyId) {
        tactical += 480 + covered.value * 54 + linePressure(game, tileIndex, enemyId);
        tactical -= Math.max(0, value - covered.value) * 22;
      } else if (covered?.owner === ownerId) {
        tactical -= 540 + value * 20;
      } else {
        tactical += (15 - value) * 26;
      }

      tactical += winLines.filter((line) => line.includes(tileIndex)).length * 72;

      if (value === 14 && !enemyThreats.has(tileIndex) && !ownThreats.has(tileIndex)) {
        if (!covered) {
          if (earlyBoard <= 2) tactical -= 3600;
          else if (earlyBoard <= 5) tactical -= 2100;
          else if (earlyBoard <= 8) tactical -= 850;
        } else if (covered.owner === enemyId && covered.value < 10) {
          if (earlyBoard <= 2) tactical -= 3600 - covered.value * 100;
          else if (earlyBoard <= 5) tactical -= 1800 - covered.value * 70;
        }
      }
      if (value >= 10 && value <= 13 && !covered && earlyBoard <= 4) tactical -= 460;
      if (value === 3) tactical += 640 + linePressure(simulated, tileIndex, ownerId) * 0.5;

      if (value === 6) {
        tile.stunnedBy = ownerId;
        tile.stunTurns = 2;
        card.stunned = true;
        const stun = chooseWitchTarget(simulated, tileIndex);
        if (stun) {
          const target = simulated.board[stun.tileIndex];
          target.stunnedBy = ownerId;
          target.stunTurns = 2;
          const targetCard = topCard(target);
          if (targetCard) targetCard.stunned = true;
          if (stun.score >= 900) tactical += Math.min(6200, stun.score * 0.82);
          else tactical -= 2400 + Math.max(0, 900 - stun.score);
        } else {
          tactical -= 5200;
        }
      }

      if (value === 4 || value === 5) {
        const shot = chooseShotPlanForShooter(simulated, tileIndex);
        if (shot) {
          tactical += shot.score * 0.72 - (shot.usePierce ? 460 : 0);
          simulateShot(simulated, shot, tileIndex);
        } else {
          tactical -= 90;
        }
      }

      let score = evaluateBoard(simulated, ownerId) + tactical;
      if (ownsWinningLine(simulated, ownerId)) score += 500000;
      if (ownsWinningLine(simulated, enemyId)) score -= 500000;
      return score;
    }

    function chooseCardMove(game) {
      return bestMoveInternal(game, 2);
    }

    function exposedToEnemyShot(game, targetIndex, ownerId) {
      const enemyId = enemyOf(ownerId);
      const enemy = game.players[enemyId - 1];
      let exposed = false;
      game.board.forEach((tile, index) => {
        if (exposed) return;
        const shooter = topCard(tile);
        if (!shooter || shooter.owner !== enemyId || !isShooter(shooter, tile) || tile.stunTurns > 0 || shooter.stunned) return;
        const value = effectiveValue(shooter, tile);
        if ((enemy.tokens.ammo || 0) > 0 && getShotTargets(game, index, value, shooter).includes(targetIndex)) exposed = true;
        if (!exposed && (enemy.tokens.pierce || 0) > 0) {
          const pierced = { ...shooter, pierce: true };
          if (getShotTargets(game, index, value, pierced).includes(targetIndex)) exposed = true;
        }
      });
      return exposed;
    }

    function hypotheticalTokenShot(game, tileIndex, type) {
      const simulated = cloneGame(game);
      const ownerId = simulated.players[simulated.current].id;
      simulated.board[tileIndex].tokens.push({ owner: ownerId, type, id: -1, removable: true });
      simulated.tokensUsed += 1;
      return chooseShotPlanForShooter(simulated, tileIndex);
    }

    function chooseSupportAction(game) {
      const player = game.players[game.current];
      const ownerId = player.id;
      const enemyId = enemyOf(ownerId);
      const slotsLeft = 2 - game.tokensUsed;
      if (slotsLeft <= 0) return null;
      const candidates = [];

      game.board.forEach((tile, index) => {
        const card = topCard(tile);
        if (!card || card.owner !== ownerId) return;
        const stunned = tile.stunTurns > 0 || card.stunned;

        if (card.value === 6 && (player.tokens.potion || 0) > 0) {
          const stun = chooseWitchTarget(game, index);
          if (!stunned && stun && stun.score >= 1050) {
            candidates.push({ type: "potion", tileIndex: index, score: stun.score - 420, reason: "awaken-witch" });
          } else if (stunned && slotsLeft >= 2 && player.tokens.potion >= 2 && stun && stun.score >= 3800) {
            candidates.push({ type: "potion", tileIndex: index, score: stun.score - 1550, reason: "clear-witch-for-reactivation" });
          }
        }

        if (!stunned && (player.tokens.ammo || 0) > 0 && isShooter(card, tile) &&
            !tile.tokens.some((token) => token.owner === ownerId && token.type === "ammo")) {
          const shot = hypotheticalTokenShot(game, index, "ammo");
          if (shot && shot.score >= 720) {
            candidates.push({ type: "ammo", tileIndex: index, score: shot.score - 330, reason: "tactical-shot" });
          }
        }

        if (!stunned && (player.tokens.bard || 0) > 0 && [1, 2].includes(card.value) &&
            !tile.tokens.some((token) => token.owner === ownerId && token.type === "bard")) {
          const shot = hypotheticalTokenShot(game, index, "bard");
          if (shot && shot.score >= 820) {
            candidates.push({ type: "bard", tileIndex: index, score: shot.score - 430, reason: "bard-shot-combo" });
          }
        }

        if ((player.tokens.parry || 0) > 0 && !stunned && !card.protected && card.value !== 14 &&
            !tile.tokens.some((token) => token.owner === ownerId && token.type === "parry")) {
          const exposed = exposedToEnemyShot(game, index, ownerId);
          const critical = linePressure(game, index, ownerId);
          const enemyHasPierce = (game.players[enemyId - 1].tokens.pierce || 0) > 0;
          const needsPierce = card.value === 3 || card.value >= 10;
          if ((!needsPierce || enemyHasPierce) && (exposed || critical >= 700)) {
            const score = (exposed ? 980 : 0) + critical + card.value * 38 - 480;
            if (score >= 760) candidates.push({ type: "parry", tileIndex: index, score, reason: "protect-anchor" });
          }
        }
      });

      candidates.sort((left, right) => right.score - left.score || left.tileIndex - right.tileIndex || left.type.localeCompare(right.type));
      return candidates[0] || null;
    }

    return {
      chooseCardMove,
      chooseShotPlan,
      chooseWitchTarget,
      chooseSupportAction,
      evaluateBoard,
      scoreCardMove,
      scoreStunTarget,
      threatTiles
    };
  }

  return { createBotStrategy };
});
