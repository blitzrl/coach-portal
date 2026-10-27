// ============================================================
// STORAGE — Solo lectura desde Supabase
// ============================================================
import { loadRemoteDB } from './supabase.js';
import { getDefaultWidgets, ECONOMY_DEFAULTS } from '../data/database.js';

let _db = null;
let _viewCache = null;
let _viewCacheForId = null;

// ============================================================
// CARGA
// ============================================================
export async function loadDB() {
  _db = await loadRemoteDB();
  if (!_db.widgets) _db.widgets = getDefaultWidgets();
  if (!_db.config) _db.config = {};
  if (!_db.config.theme) _db.config.theme = { active: null, presets: [] };
  if (!_db.config.economy) _db.config.economy = JSON.parse(JSON.stringify(ECONOMY_DEFAULTS)); // NUEVO
  if (!_db.economyLedger) _db.economyLedger = []; // NUEVO
  return _db;
}

export async function reloadDB() {
  _db = null;
  _viewCache = null;
  _viewCacheForId = null;
  return loadDB();
}

// ============================================================
// ACCESO
// ============================================================
export function getDB() {
  if (!_db) return null;

  if (_db.viewSeasonId) {
    if (_viewCacheForId === _db.viewSeasonId && _viewCache) return _viewCache;
    const arch = _db.archivedSeasons.find(s => s.id === _db.viewSeasonId);
    if (arch && arch.data && arch.data.snapshot) {
      _viewCache = migrateSnapshot(arch.data.snapshot, _db);
      _viewCacheForId = _db.viewSeasonId;
      return _viewCache;
    }
    _db.viewSeasonId = null;
    _viewCache = null;
    _viewCacheForId = null;
  }
  return _db;
}

export function getRawDB() { return _db; }

export function setViewSeasonId(id) {
  if (!_db) return;
  _db.viewSeasonId = id || null;
  _viewCache = null;
  _viewCacheForId = null;
}

export function isViewMode() {
  return !!(_db && _db.viewSeasonId);
}

// ============================================================
// MUTATE (BLOQUEADO — solo lectura)
// ============================================================
export function mutate() {
  throw new Error('📖 Este es un visualizador de solo lectura.');
}

export function persist() {}
export function exportJSON() {}
export function importJSON() {}
export function resetDB() {}

// ============================================================
// MIGRACIÓN DE SNAPSHOT (para seasons archivadas)
// ============================================================
function migrateSnapshot(snapshot, liveDB) {
  const s = JSON.parse(JSON.stringify(snapshot || {}));
  s.meta = s.meta || { version: 3 };
  s.seasons = s.seasons || [];
  s.divisions = s.divisions || [];
  s.teams = s.teams || [];
  s.players = s.players || [];
  s.matches = s.matches || [];
  s.playoffs = s.playoffs || [];
  s.news = s.news || [];
  s.awards = s.awards || [];
  s.history = s.history || [];
  s.trophyHistory = s.trophyHistory || [];
  s.trophies = s.trophies || {};
  s.economyLedger = s.economyLedger || []; // NUEVO
  s.transferBannerBg = s.transferBannerBg || '';
  s.config = s.config || liveDB.config || {};
  s.config.theme = liveDB.config?.theme || s.config.theme;
  s.config.economy = liveDB.config?.economy || ECONOMY_DEFAULTS; // NUEVO
  s.widgets = liveDB.widgets;
  s.archivedSeasons = liveDB.archivedSeasons;
  s.transferLog = liveDB.transferLog;
  s.transferQueue = [];
  s.viewSeasonId = null;
  return s;
}
