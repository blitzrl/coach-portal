// ============================================================
// PLAYOFFS SERVICE — Solo lectura (visualizador)
// ============================================================
import { getDB } from './storage.js';

// ============================================================
// OBTENER BRACKET DE UNA DIVISIÓN
// ============================================================
export function getPlayoff(divisionId){
  const db = getDB();
  if (!db) return null;
  const found = db.playoffs.find(p => p.divisionId === divisionId);
  if (!found) return null;
  if (!found.bracket) return null;
  if (!found.bracket.rounds) {
    const migrated = migrateBracket(found.bracket);
    if (migrated) found.bracket = migrated;
  }
  return found;
}

// ============================================================
// MIGRACIÓN DE BRACKETS ANTIGUOS (formato playIn/semis/final)
// ============================================================
function migrateBracket(oldBracket){
  const rounds = [];
  let idx = 0;
  if (Array.isArray(oldBracket.playIn) && oldBracket.playIn.length){
    rounds.push({
      id: 'playIn',
      name: 'PLAY-IN',
      matches: oldBracket.playIn.map(m => ({
        ...m,
        games: m.games || [],
        winnerTargets: m.winnerTargets || [],
        format: m.format || 'BO5'
      }))
    });
  }
  if (Array.isArray(oldBracket.semis) && oldBracket.semis.length){
    rounds.push({
      id: 'r' + idx,
      name: 'SEMIFINALES',
      matches: oldBracket.semis.map(m => ({
        ...m,
        games: m.games || [],
        winnerTargets: m.winnerTargets || [],
        format: m.format || 'BO5'
      }))
    });
    idx++;
  }
  if (oldBracket.final){
    rounds.push({
      id: 'r' + idx,
      name: 'FINAL',
      matches: [{
        ...oldBracket.final,
        games: oldBracket.final.games || [],
        winnerTargets: [],
        format: oldBracket.final.format || 'BO7'
      }]
    });
  }
  return { rounds, championId: oldBracket.championId || null };
}

// ============================================================
// HELPERS DE FORMATO
// ============================================================
export function getFormatForRound(roundId, division){
  if (!division || !division.config) return 'BO5';
  if (roundId === 'playIn') return division.config.playInFormat || 'BO5';
  const pl = getPlayoff(division.id);
  if (!pl || !pl.bracket || !pl.bracket.rounds) return 'BO5';
  const rounds = pl.bracket.rounds;
  if (rounds[rounds.length - 1]?.id === roundId) return division.config.finalFormat || 'BO7';
  if (rounds[rounds.length - 2]?.id === roundId) return division.config.semiFormat || 'BO5';
  return division.config.playInFormat || 'BO5';
}

export function winsNeeded(format){
  const f = format || 'BO5';
  const n = parseInt(f.replace('BO', ''), 10);
  if (isNaN(n) || n < 1) return 2;
  return Math.ceil(n / 2);
}