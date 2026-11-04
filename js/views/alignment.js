import { toast } from '../services/ui.js?v=65';
import { updateLineup, loadPortalDB } from '../services/supabase.js?v=65';
import { openSigningWizard } from './signingWizard.js?v=65';
import { getNationFlag, getRankColor, getRankLabelResponsive } from '../data/nations.js?v=65';

let _tempRoster = []; 

export function renderAlignmentView(DB, session) {
  const team = DB.teams.find(t => t.id === session.activeTeamId);
  if (!team) return `<div class="card">No se encontró tu equipo.</div>`;

  _tempRoster = (team.roster || []).map(r => ({ ...r }));

  // 🔥 FIX: Leer la configuración real del Gestor
  const limits = DB.config.rosterRules || { starters: 3, substitutes: 1, max: 4 };
  const maxAux = Math.max(0, limits.max - limits.starters - limits.substitutes);

  const players = _tempRoster.map(r => {
    const p = DB.players.find(x => x.id === r.playerId) || {};
    return { ...p, role: r.role };
  });

  const titulares = players.filter(p => p.role === 'TITULAR' || p.role === 'CAPITÁN');
  const suplentes = players.filter(p => p.role === 'SUPLENTE');
  const auxiliares = players.filter(p => p.role === 'AUXILIAR');

  return `
    <div style="text-align:right; margin-bottom:10px;">
      <button class="btn btn-primary" id="btnSaveLineup" disabled style="opacity:0.5">GUARDAR ALINEACIÓN</button>
    </div>
    <div class="grid grid-3" id="lineupZones">
      <div class="card" data-dropzone="TITULAR">
        <div class="card-header" style="border-bottom:2px solid var(--success)">
          <div class="card-title" style="color:var(--success)">TITULARES (${titulares.length}/${limits.starters})</div>
        </div>
        <div class="lineup-list" id="list-TITULAR">
          ${titulares.map(p => renderPlayerCard(p, DB, session)).join('')}
        </div>
      </div>

      <div class="card" data-dropzone="SUPLENTE">
        <div class="card-header" style="border-bottom:2px solid var(--gold)">
          <div class="card-title" style="color:var(--gold)">SUPLENTES (${suplentes.length}/${limits.substitutes})</div>
        </div>
        <div class="lineup-list" id="list-SUPLENTE">
          ${suplentes.map(p => renderPlayerCard(p, DB, session)).join('')}
        </div>
      </div>

      <div class="card" data-dropzone="AUXILIAR">
        <div class="card-header" style="border-bottom:2px solid var(--accent)">
          <div class="card-title" style="color:var(--accent)">AUXILIARES (${auxiliares.length}/${maxAux})</div>
        </div>
        <div class="lineup-list" id="list-AUXILIAR">
          ${auxiliares.map(p => renderPlayerCard(p, DB, session)).join('')}
        </div>
      </div>
    </div>

    <style>
      .lineup-list { min-height: 150px; display: flex; flex-direction: column; gap: 8px; padding-top: 10px; }
      .player-drag-card { background: var(--bg-elev); border: 1px solid var(--border-soft); border-radius: 8px; padding: 10px; cursor: grab; display: flex; align-items: center; gap: 10px; transition: 0.2s; position: relative; }
      .player-drag-card:active { cursor: grabbing; }
      .player-drag-card.dragging { opacity: 0.4; border-color: var(--accent); }
      .dropzone-hover { background: rgba(111, 168, 255, 0.05); outline: 2px dashed var(--accent); outline-offset: -2px; }
      .btn-firmar { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 10px; padding: 4px 8px; background: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer; z-index: 2; }
      .player-meta { font-size: 10px; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    </style>
  `;
}

function renderPlayerCard(p, DB, session) {
  const hasContract = p.contractId || p.status === 'loaned';
  const flag = p.nationalityCode ? getNationFlag(p.nationalityCode) : '';
  const rankColor = getRankColor(p.rank, p.rankLevel);
  const rankLabel = getRankLabelResponsive(p.rank, p.rankLevel, p.rankDivision);
  
  return `
    <div class="player-drag-card" draggable="true" data-player-id="${p.id}">
      ${p.profilePicture ? `<img src="${p.profilePicture}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-graphite);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${(p.name||'?').slice(0,2).toUpperCase()}</div>`}
      <div style="flex:1;min-width:0; padding-right: ${!hasContract ? '60px' : '0'}">
        <div style="font-size:12.5px;color:var(--silver-light);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
        <div class="player-meta">
          ${flag ? `<span>${flag}</span>` : ''}
          <span style="color:${rankColor}; font-weight:600;">${rankLabel}</span>
          ${!hasContract ? `<span style="color:var(--danger); margin-left: 4px;">· Sin Contrato</span>` : ''}
        </div>
      </div>
      ${!hasContract ? `<button class="btn-firmar" data-firmar-contrato="${p.id}">FIRMAR</button>` : ''}
    </div>
  `;
}

export function bindAlignmentEvents(DB, session) {
  const btnSave = document.getElementById('btnSaveLineup');
  let hasChanges = false;

  // Leer los límites aquí también para usarlos en la validación del Drop
  const limits = DB.config.rosterRules || { starters: 3, substitutes: 1, max: 4 };

  function bindFirmarButtons() {
    document.querySelectorAll('[data-firmar-contrato]').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSigningWizard(DB, session, newBtn.dataset.firmarContrato, false);
      });
    });
  }

  bindFirmarButtons();

  function checkChanges() {
    if (hasChanges) {
      btnSave.disabled = false;
      btnSave.style.opacity = '1';
      btnSave.textContent = 'GUARDAR ALINEACIÓN';
    } else {
      btnSave.disabled = true;
      btnSave.style.opacity = '0.5';
    }
  }

  document.querySelectorAll('.player-drag-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.playerId);
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.dropzone-hover').forEach(z => z.classList.remove('dropzone-hover'));
    });
  });

  document.querySelectorAll('[data-dropzone]').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault(); 
      zone.classList.add('dropzone-hover');
    });
    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('dropzone-hover');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dropzone-hover');
      
      const playerId = e.dataTransfer.getData('text/plain');
      if (!playerId) return;

      const newRole = zone.dataset.dropzone;
      const playerIndex = _tempRoster.findIndex(r => r.playerId === playerId);
      if (playerIndex === -1) return;

      const currentRole = _tempRoster[playerIndex].role;
      if (currentRole === newRole) return; // Si ya está ahí, no hacer nada

      // 🔥 FIX MAESTRO: Validar límites antes de permitir el Drop
      const currentTitulares = _tempRoster.filter(r => r.role === 'TITULAR' || r.role === 'CAPITÁN');
      const currentSuplentes = _tempRoster.filter(r => r.role === 'SUPLENTE');
      const currentAuxiliares = _tempRoster.filter(r => r.role === 'AUXILIAR');
      const maxAux = Math.max(0, limits.max - limits.starters - limits.substitutes);

      if (newRole === 'TITULAR' && currentTitulares.length >= limits.starters) {
        return toast(`Límite de titulares alcanzado (${limits.starters})`, 'error');
      }
      if (newRole === 'SUPLENTE' && currentSuplentes.length >= limits.substitutes) {
        return toast(`Límite de suplentes alcanzado (${limits.substitutes})`, 'error');
      }
      if (newRole === 'AUXILIAR' && currentAuxiliares.length >= maxAux) {
        return toast(`Límite de auxiliares alcanzado (${maxAux})`, 'error');
      }

      // Si pasa la validación, actualizamos
      _tempRoster[playerIndex].role = newRole;
      hasChanges = true;
      checkChanges();

      const titulares = _tempRoster.filter(r => r.role === 'TITULAR' || r.role === 'CAPITÁN');
      const suplentes = _tempRoster.filter(r => r.role === 'SUPLENTE');
      const auxiliares = _tempRoster.filter(r => r.role === 'AUXILIAR');

      document.getElementById('list-TITULAR').innerHTML = titulares.map(r => renderPlayerCard(DB.players.find(p => p.id === r.playerId) || {name:'?'}, DB, session)).join('');
      document.getElementById('list-SUPLENTE').innerHTML = suplentes.map(r => renderPlayerCard(DB.players.find(p => p.id === r.playerId) || {name:'?'}, DB, session)).join('');
      document.getElementById('list-AUXILIAR').innerHTML = auxiliares.map(r => renderPlayerCard(DB.players.find(p => p.id === r.playerId) || {name:'?'}, DB, session)).join('');
      
      bindFirmarButtons();
    });
  });

  btnSave.addEventListener('click', async () => {
    try {
      btnSave.disabled = true;
      btnSave.textContent = 'GUARDANDO...';
      
      await updateLineup(session.token, session.activeTeamId, _tempRoster);
      
      // 🔥 FIX EXTRA: Actualizar la DB local para evitar que el Realtime "pise" la vista antes de que Supabase se actualice
      const team = DB.teams.find(t => t.id === session.activeTeamId);
      if (team) {
        team.roster = JSON.parse(JSON.stringify(_tempRoster));
      }
      
      toast('✅ Alineación guardada correctamente', 'success');
      btnSave.textContent = 'GUARDADO';
      hasChanges = false;
      
      if (window.refreshPortalView) window.refreshPortalView();

    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
      btnSave.disabled = false;
      btnSave.textContent = 'GUARDAR ALINEACIÓN';
    }
  });

  checkChanges();
}
