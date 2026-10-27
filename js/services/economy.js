// ============================================================
// ECONOMY SERVICE — Cálculo de valores de mercado (Viewer)
// ============================================================
import { getDB } from './storage.js';
import { ECONOMY_DEFAULTS } from '../data/database.js';
import { aggregatePlayerStats } from './statistics.js';

export function calculatePlayerPrice(player, stats, economy){
  const db = getDB();
  const eco = economy || db?.config?.economy || ECONOMY_DEFAULTS;

  if (!eco || !eco.enabled) {
    return { basePrice: 0, pig: stats?.pig || 0, pigAdjustment: 0, price: 0, rank: player.rank || 'Bronze', level: player.rankLevel || 1 };
  }

  const rank = player.rank || 'Bronze';
  const level = player.rankLevel || 1;
  
  // FIX: Usar marketValue si existe
  let basePrice = 0;
  if (player.marketValue !== undefined && player.marketValue !== null) {
    basePrice = player.marketValue;
  } else {
    const rankTable = eco.basePriceByRank?.[rank] || {};
    basePrice = rankTable[level] ?? rankTable[1] ?? 0;
  }

  const pig = stats?.pig ?? 0;
  const pigAdjustment = pig * (eco.pigMultiplier || 1000);

  const price = Math.max(0, basePrice + pigAdjustment);

  return {
    basePrice,
    pig: +pig.toFixed(2),
    pigAdjustment,
    price,
    rank,
    level
  };
}

export function getTeamSquadValue(teamId) {
  const db = getDB();
  const team = db.teams.find(t => t.id === teamId);
  if (!team) return 0;

  const allStats = aggregatePlayerStats({ teamId });
  
  let totalValue = 0;
  (team.roster || []).forEach(r => {
    const player = db.players.find(p => p.id === r.playerId);
    if (!player) return;
    const stats = allStats.find(s => s.id === r.playerId);
    const valueData = calculatePlayerPrice(player, stats, db.config.economy);
    totalValue += valueData.price;
  });

  return totalValue;
}

export function detectVictoryType(games, format, winnerId, teamAId, teamBId, economy) {
  const db = getDB();
  const eco = economy || db?.config?.economy || ECONOMY_DEFAULTS;
  if (!eco || !eco.enabled || !games || games.length === 0) return null;

  const winnerIsA = winnerId === teamAId;
  const thresholds = eco.bonuses.thresholds?.[format || 'BO3'] || eco.bonuses.thresholds['BO3'];
  
  let winnerGamesWon = 0;
  let loserGamesWon = 0;
  let shutouts = 0;
  let totalGoalDiff = 0;

  games.forEach(g => {
    const wScore = winnerIsA ? g.scoreA : g.scoreB;
    const lScore = winnerIsA ? g.scoreB : g.scoreA;
    
    if (wScore > lScore) {
      winnerGamesWon++;
      totalGoalDiff += (wScore - lScore);
      if (lScore === 0) shutouts++;
    } else {
      loserGamesWon++;
    }
  });

  if (winnerGamesWon === 0) return null;

  const avgGoalDiff = totalGoalDiff / winnerGamesWon;

  if (shutouts >= thresholds.humiliatingShutout || avgGoalDiff >= thresholds.humiliatingGoalDiff) {
    return { type: 'humiliating', label: eco.bonuses.winHumiliating.label, amount: eco.bonuses.winHumiliating.amount, emoji: '😂' };
  }
  
  if (loserGamesWon === 0) {
    return { type: 'simple', label: eco.bonuses.winSimple.label, amount: eco.bonuses.winSimple.amount, emoji: '✅' };
  }

  return { type: 'hard', label: eco.bonuses.winHard.label, amount: eco.bonuses.winHard.amount, emoji: '⚔️' };
}
