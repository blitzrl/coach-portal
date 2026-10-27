import { createCoachRequest, cancelCoachRequest } from '../services/supabase.js?v=58';
import { openLoanWizard } from './loanWizard.js?v=58';
import { openSigningWizard } from './signingWizard.js?v=58';
import { showPlayerProfile } from './playerProfile.js?v=58';
import { toast } from '../services/ui.js?v=58';
import { calculatePlayerPrice } from '../services/economy.js?v=58';
import { getNationFlag, getRankColor, getRankLabelResponsive } from '../data/nations.js?v=58';

let _activeTab = 'players';
let _searchQuery = '';
let _filterTeam = 'all';
let _filterRank = 'all';

function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US'); }

export function renderMarketView(DB, session) {
  const marketSettings = DB.config.marketSettings || { open: true };
  const isOpen = marketSettings.open;

  const allTeams = DB.teams.filter(t => t.id !== session.teamId);
  const allRanks = [...new Set(DB.players.map(p => p.rank).filter(Boolean))].sort();

  const myOffers = DB.requests.filter(r => r.from_coach_id === session.coachId && r.status === 'pending');

  return `
    <div class="card" style="margin-bottom:20px; border-left:4px solid ${isOpen ? 'var(--success)' : 'var(--danger)'}">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <div style="font-size:16px; font-weight:600; color:var(--silver-light)">ESTADO DEL MERCADO</div>
          <div style="font-size:12px; color:var(--muted)">${isOpen ? 'Puedes realizar fichajes y negociaciones.' : 'El administrador ha cerrado el mercado.'}</div>
        </div>
        <span class="badge ${isOpen ? 'badge-win' : 'badge-live'}" style="font-size:14px; padding:6px 12px;">
          ${isOpen ? '🟢 ABIERTO' : '🔴 CERRADO'}
        </span>
      </div>
    </div>

    <div class="stats-tabs" style="margin-bottom:18px">
      <button class="stats-tab ${_activeTab === 'players' ? 'active' : ''}" data-mkt-tab="players">👤 Jugadores</button>
      <button class="stats-tab ${_activeTab === 'free_agents' ? 'active' : ''}" data-mkt-tab="free_agents">📋 Agentes Libres</button>
      <button class="stats-tab ${_activeTab === 'staff' ? 'active' : ''}" data-mkt-tab="staff">🧑‍💼 Staff Técnico</button>
      <button class="stats-tab ${_activeTab === 'my_offers' ? 'active' : ''}" data-mkt-tab="my_offers">📩 Mis Ofertas (${myOffers.length})</button>
    </div>

    ${_activeTab !== 'my_offers' ? `
    <div class="card" style="margin-bottom:18px; padding:12px;">
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div class="field" style="flex:2; min-width:200px; margin:0;">
          <input class="input" type="text" id="mkt-search" placeholder="🔍 Buscar por nombre..." value="${_searchQuery}">
        </div>
        <div class="field" style="flex:1; min-width:150px; margin:0;">
          <select class="select" id="mkt-filter-team">
            <option value="all">Todos los equipos</option>
            ${allTeams.map(t => `<option value="${t.id}" ${_filterTeam === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="flex:1; min-width:150px; margin:0;">
          <select class="select" id="mkt-filter-rank">
            <option value="all">Todos los rangos</option>
            ${allRanks.map(r => `<option value="${r}" ${_filterRank === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    ` : ''}

    <div id="marketContent">
      ${_activeTab === 'players' ? renderPlayers(DB, session, isOpen) : ''}
      ${_activeTab === 'free_agents' ? renderFreeAgents(DB, session, isOpen) : ''}
      ${_activeTab === 'staff' ? renderStaff(DB, session, isOpen) : ''}
      ${_activeTab === 'my_offers' ? renderMyOffers(myOffers, DB) : ''}
    </div>
  `;
}

function applyFilters(players, DB) {
  return players.filter(p => {
    if (_searchQuery && !p.name.toLowerCase().includes(_searchQuery.toLowerCase())) return false;
    if (_filterTeam !== 'all') {
      const team = DB.teams.find(t => (t.roster || []).some(r => r.playerId === p.id));
      if (_filterTeam === 'free_agents' && team) return false;
      if (_filterTeam !== 'free_agents' && (!team || team.id !== _filterTeam)) return false;
    }
    if (_filterRank !== 'all' && p.rank !== _filterRank) return false;
    return true;
  });
}

function renderPlayers(DB, session, isOpen) {
  let availablePlayers = DB.players.filter(p => {
    const team = DB.teams.find(t => (t.roster || []).some(r => r.playerId === p.id));
    return team && team.id !== session.teamId;
  });

  availablePlayers = applyFilters(availablePlayers, DB);

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">MERCADO DE JUGADORES</div></div>
      <div class="table-wrap">
        <table class="ztable market-table">
          <thead>
            <tr>
              <th class="col-name">JUGADOR</th>
              <th class="col-rank">RANGO</th>
              <th class="col-team">EQUIPO ACTUAL</th>
              <th class="num col-value">VALOR</th>
              <th class="num col-action">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${availablePlayers.map(p => {
              const team = DB.teams.find(t => (t.roster || []).some(r => r.playerId === p.id));
              const priceData = calculatePlayerPrice(p, { pig: p.pig || 0 }, DB.config.economy);
              // 🔥 FIX: Usando getNationFlag correctamente
              const flag = p.nationalityCode ? getNationFlag(p.nationalityCode) : '';
              const rankColor = getRankColor(p.rank, p.rankLevel);
              const rankLine = getRankLabelResponsive(p.rank, p.rankLevel, p.rankDivision);

              return `
                <tr>
                  <td class="col-name" style="cursor:pointer;" data-player-profile="${p.id}">
                    <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                      ${p.profilePicture ? `<img src="${p.profilePicture}" class="player-cell-avatar" style="width:20px;height:20px;">` : `<div class="player-cell-avatar player-cell-avatar-empty" style="width:20px;height:20px;font-size:8px;">${p.name.slice(0,2).toUpperCase()}</div>`}
                      <span style="font-weight:600; color:var(--silver-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</span>
                      ${flag ? `<span style="font-size:14px;">${flag}</span>` : ''}
                    </div>
                  </td>
                  <td class="col-rank"><span style="color:${rankColor}; font-size:11px; font-weight:600;">${rankLine}</span></td>
                  <td class="col-team" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px;">${team.name}</td>
                  <td class="num col-value" style="color:var(--gold); font-size:11px;">$${formatMoney(priceData.price)}</td>
                  <td class="num col-action">
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                      <button class="btn btn-sm btn-primary" ${!isOpen ? 'disabled' : ''} data-offer="${p.id}" style="padding:4px 6px; font-size:9px; width:100%;">OFERTAR</button>
                      <button class="btn btn-sm" ${!isOpen ? 'disabled' : ''} data-prestamo="${p.id}" style="padding:4px 6px; font-size:9px; width:100%;">PRÉSTAMO</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No hay jugadores disponibles</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFreeAgents(DB, session, isOpen) {
  let freeAgents = DB.players.filter(p => !DB.teams.some(t => (t.roster || []).some(r => r.playerId === p.id)));
  freeAgents = freeAgents.filter(p => {
    if (_searchQuery && !p.name.toLowerCase().includes(_searchQuery.toLowerCase())) return false;
    if (_filterRank !== 'all' && p.rank !== _filterRank) return false;
    return true;
  });

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">AGENTES LIBRES</div></div>
      <div class="table-wrap">
        <table class="ztable market-table">
          <thead>
            <tr>
              <th class="col-name">JUGADOR</th>
              <th class="col-rank">RANGO</th>
              <th class="num col-value">VALOR DE MERCADO</th>
              <th class="num col-action">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${freeAgents.map(p => {
              const priceData = calculatePlayerPrice(p, { pig: p.pig || 0 }, DB.config.economy);
              // 🔥 FIX: Usando getNationFlag correctamente
              const flag = p.nationalityCode ? getNationFlag(p.nationalityCode) : '';
              const rankColor = getRankColor(p.rank, p.rankLevel);
              const rankLine = getRankLabelResponsive(p.rank, p.rankLevel, p.rankDivision);

              return `
                <tr>
                  <td class="col-name" style="cursor:pointer;" data-player-profile="${p.id}">
                    <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                      ${p.profilePicture ? `<img src="${p.profilePicture}" class="player-cell-avatar" style="width:20px;height:20px;">` : `<div class="player-cell-avatar player-cell-avatar-empty" style="width:20px;height:20px;font-size:8px;">${p.name.slice(0,2).toUpperCase()}</div>`}
                      <span style="font-weight:600; color:var(--silver-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</span>
                      ${flag ? `<span style="font-size:14px;">${flag}</span>` : ''}
                    </div>
                  </td>
                  <td class="col-rank"><span style="color:${rankColor}; font-size:11px; font-weight:600;">${rankLine}</span></td>
                  <td class="num col-value" style="color:var(--gold); font-size:11px;">$${formatMoney(priceData.price)}</td>
                  <td class="num col-action">
                    <button class="btn btn-sm btn-primary" ${!isOpen ? 'disabled' : ''} data-sign-free="${p.id}" style="padding:4px 6px; font-size:9px; width:100%;">FICHAR</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No hay agentes libres disponibles</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderStaff(DB, session, isOpen) {
  let availableStaff = DB.coaches.filter(c => c.teamId !== session.teamId);
  if (_searchQuery) availableStaff = availableStaff.filter(c => c.name.toLowerCase().includes(_searchQuery.toLowerCase()));

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">MERCADO DE STAFF</div></div>
      <div class="table-wrap">
        <table class="ztable market-table">
          <thead>
            <tr>
              <th class="col-name">STAFF</th>
              <th class="col-team">EQUIPO ACTUAL</th>
              <th class="col-rank">ROL</th>
              <th class="num col-action">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${availableStaff.map(c => {
              const team = DB.teams.find(t => t.id === c.teamId);
              return `
                <tr>
                  <td class="col-name">
                    <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                      ${c.profilePicture ? `<img src="${c.profilePicture}" class="player-cell-avatar" style="width:20px;height:20px;">` : `<div class="player-cell-avatar player-cell-avatar-empty" style="width:20px;height:20px;font-size:8px;">${c.name.slice(0,2).toUpperCase()}</div>`}
                      <span style="font-weight:600; color:var(--silver-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</span>
                    </div>
                  </td>
                  <td class="col-team" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px;">${team ? team.name : '<span style="color:var(--gold)">Agente Libre</span>'}</td>
                  <td class="col-rank" style="font-size:11px;">${c.roleType === 'coach' ? 'Head Coach' : 'Asistente'}</td>
                  <td class="num col-action">
                    <button class="btn btn-sm ${team ? '' : 'btn-primary'}" ${!isOpen ? 'disabled' : ''} data-staff="${c.id}" style="padding:4px 6px; font-size:9px; width:100%;">
                      ${team ? 'OFRECER' : 'CONTRATAR'}
                    </button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No hay staff disponible</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMyOffers(offers, DB) {
  if (offers.length === 0) return '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">No tienes ofertas pendientes.</div>';

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">MIS OFERTAS PENDIENTES</div></div>
      <div class="table-wrap">
        <table class="ztable market-table">
          <thead>
            <tr>
              <th class="col-name">JUGADOR</th>
              <th class="col-team">DESTINO</th>
              <th class="num col-value">PRECIO</th>
              <th class="num col-action">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${offers.map(req => {
              const payload = req.payload || {};
              const toTeam = DB.teams.find(t => t.id === req.to_team_id);
              return `
                <tr>
                  <td class="col-name"><span style="font-weight:600; color:var(--silver-light); font-size:11px;">${payload.playerName || 'Jugador'}</span></td>
                  <td class="col-team" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px;">${toTeam ? toTeam.name : 'Agente Libre'}</td>
                  <td class="num col-value" style="color:var(--gold); font-size:11px;">$${formatMoney(payload.uniquePrice)}</td>
                  <td class="num col-action">
                    <button class="btn btn-sm btn-danger" data-cancel-offer="${req.id}" style="padding:4px 6px; font-size:9px; width:100%;">CANCELAR</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function bindMarketEvents(DB, session) {
  document.querySelectorAll('[data-player-profile]').forEach(el => {
    el.addEventListener('click', () => {
      const pid = el.dataset.playerProfile;
      const player = DB.players.find(p => p.id === pid);
      if (player) showPlayerProfile(player, DB);
    });
  });

  document.querySelectorAll('[data-mkt-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.mktTab;
      document.querySelectorAll('[data-mkt-tab]').forEach(b => b.classList.toggle('active', b === btn));
      renderAndBind(DB, session);
    });
  });

  const searchInput = document.getElementById('mkt-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value;
      renderAndBind(DB, session);
    });
  }

  const filterTeam = document.getElementById('mkt-filter-team');
  if (filterTeam) filterTeam.addEventListener('change', (e) => { _filterTeam = e.target.value; renderAndBind(DB, session); });
  
  const filterRank = document.getElementById('mkt-filter-rank');
  if (filterRank) filterRank.addEventListener('change', (e) => { _filterRank = e.target.value; renderAndBind(DB, session); });

  bindActionButtons(DB, session);
}

function renderAndBind(DB, session) {
  const isOpen = (DB.config.marketSettings || { open: true }).open;
  const contentDiv = document.getElementById('marketContent');
  const myOffers = DB.requests.filter(r => r.from_coach_id === session.coachId && r.status === 'pending');

  if (_activeTab === 'players') contentDiv.innerHTML = renderPlayers(DB, session, isOpen);
  if (_activeTab === 'free_agents') contentDiv.innerHTML = renderFreeAgents(DB, session, isOpen);
  if (_activeTab === 'staff') contentDiv.innerHTML = renderStaff(DB, session, isOpen);
  if (_activeTab === 'my_offers') contentDiv.innerHTML = renderMyOffers(myOffers, DB);
  
  document.querySelectorAll('[data-player-profile]').forEach(el => {
    el.addEventListener('click', () => {
      const pid = el.dataset.playerProfile;
      const player = DB.players.find(p => p.id === pid);
      if (player) showPlayerProfile(player, DB);
    });
  });
  bindActionButtons(DB, session);
}

function bindActionButtons(DB, session) {
  document.querySelectorAll('[data-offer]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openSigningWizard(DB, session, btn.dataset.offer, false); });
  });

  document.querySelectorAll('[data-prestamo]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openLoanWizard(DB, session, btn.dataset.prestamo); });
  });

  document.querySelectorAll('[data-sign-free]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const playerId = btn.dataset.signFree;
      const player = DB.players.find(p => p.id === playerId);
      if (!confirm(`¿Enviar solicitud de fichaje al Admin por ${player.name}?`)) return;
      
      try {
        btn.disabled = true; btn.textContent = '...';
        const priceData = calculatePlayerPrice(player, { pig: player.pig || 0 }, DB.config.economy);
        
        await createCoachRequest(session.token, 'transfer', null, { 
            playerId, 
            playerName: player.name, 
            targetTeamId: session.teamId, 
            price: priceData.price 
        });
        toast('✅ Solicitud de fichaje enviada al Admin', 'success');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'FICHAR';
      }
    });
  });

  document.querySelectorAll('[data-staff]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Enviar solicitud para contratar a este miembro del staff?')) return;
      try {
        btn.disabled = true;
        await createCoachRequest(session.token, 'staff_transfer', null, { coachId: btn.dataset.staff });
        toast('✅ Solicitud enviada', 'success');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-cancel-offer]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Seguro que quieres cancelar esta oferta?')) return;
      try {
        btn.disabled = true; btn.textContent = '...';
        await cancelCoachRequest(session.token, btn.dataset.cancelOffer);
        toast('Oferta cancelada', 'success');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'CANCELAR';
      }
    });
  });
}