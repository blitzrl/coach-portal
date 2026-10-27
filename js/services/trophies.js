// ============================================================
// TROPHIES — Solo lectura (visualizador)
// ============================================================
import { getDB } from './storage.js';

export const TROPHY_TYPES = [
  { id: 'league',     label: 'Campeón Liga' },
  { id: 'playoffs',   label: 'Campeón Playoffs' },
  { id: 'promotion',  label: 'Ascenso' },
  { id: 'relegation', label: 'Descenso' }
];

// ============================================================
// LECTURA
// ============================================================
export function getTrophyConfig(divisionId, type){
  const db = getDB();
  return db.trophies?.[divisionId]?.[type] || { name: '', image: '' };
}

// ============================================================
// RENDER DE UN TROFEO
// ============================================================
export function renderTrophySlot(tr, options = {}){
  const year = tr.date ? new Date(tr.date).getFullYear() : '';
  let tooltip = tr.name || 'Trofeo';
  if (tr.wonWith) tooltip = `${tr.name} · ${tr.wonWith}`;
  else if (tr.divisionName && tr.teamName) tooltip = `${tr.name} · ${tr.divisionName} - ${tr.teamName}`;
  else if (tr.teamName) tooltip = `${tr.name} · ${tr.teamName}`;

  return `
    <div class="vitrina-slot" title="${esc(tooltip)}" data-trophy-id="${tr.id || ''}">
      ${tr.image ? `<img src="${tr.image}" alt="">` : '<span class="vitrina-icon">🏆</span>'}
      <div class="vitrina-name">${esc(tr.name)}</div>
      ${year ? `<div class="vitrina-year">${year}</div>` : ''}
    </div>
  `;
}

// ============================================================
// RENDER DE LA VITRINA COMPLETA
// ============================================================
export function renderVitrina(trophies, { compact = false, emptyMessage = 'Sin trofeos todavía' } = {}){
  const list = trophies || [];
  const items = compact ? list.slice(0, 4) : list;
  return `
    <div class="vitrina-wrap">
      <div class="vitrina-title">🏆 VITRINA · ${list.length} TROFEOS</div>
      <div class="vitrina-grid ${compact ? 'vitrina-compact' : ''}">
        ${items.length === 0
          ? `<div class="vitrina-empty">${esc(emptyMessage)}</div>`
          : items.map(tr => renderTrophySlot(tr)).join('')}
        ${compact && list.length > 4 ? `<div class="vitrina-more">+${list.length - 4}</div>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// LISTA PLANA DE TROFEOS CONFIGURADOS
// ============================================================
export function listExistingTrophies(){
  const db = getDB();
  const out = [];
  const trophies = db.trophies || {};
  Object.entries(trophies).forEach(([divId, types]) => {
    const div = db.divisions.find(d => d.id === divId);
    const divName = div?.name || 'División';
    const tier = div?.tier || '';
    Object.entries(types || {}).forEach(([type, cfg]) => {
      if (!cfg || (!cfg.name && !cfg.image)) return;
      const typeMeta = TROPHY_TYPES.find(t => t.id === type);
      out.push({
        key: `${divId}::${type}`,
        divisionId: divId,
        divisionName: divName,
        tier,
        type,
        typeLabel: typeMeta?.label || type,
        name: cfg.name || typeMeta?.label || type,
        image: cfg.image || '',
        label: `${tier ? tier + 'ª · ' : ''}${divName} — ${cfg.name || typeMeta?.label || type}`
      });
    });
  });
  return out;
}

// ============================================================
// UTIL
// ============================================================
function esc(str){
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}