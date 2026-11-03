import { renderAlignmentView, bindAlignmentEvents } from './alignment.js?v=64';
import { renderResultsView, bindResultsEvents } from './results.js?v=64';
import { renderAnalysisView } from './analysis.js?v=64';
import { renderContractsView, bindContractsEvents } from './contracts.js?v=64';
import { renderStandingsView } from './standings.js?v=64';

let _activeTeamTab = 'alignment';

export function renderDashboardView(DB, session) {
  const team = DB.teams.find(t => t.id === session.activeTeamId);
  if (!team) return `<div class="card">No se encontró tu equipo. Selecciona otro en la cabecera.</div>`;

  let myPos = '—';
  try {
    const activeSeason = DB.seasons?.find(s => s.active) || DB.seasons?.[0];
    const division = DB.divisions?.find(d => d.id === team.divisionId);
    
    if (activeSeason && division) {
      const teamsInDiv = DB.teams.filter(t => t.divisionId === division.id);
      const matches = DB.matches.filter(m => m.divisionId === division.id && m.status === 'finished');
      const ptsMap = {};
      teamsInDiv.forEach(t => ptsMap[t.id] = 0);
      
      matches.forEach(m => {
        let aWins = 0, bWins = 0;
        (m.games || []).forEach(g => {
          if(g.scoreA > g.scoreB) aWins++; else bWins++;
        });
        if(aWins > bWins) ptsMap[m.teamAId] = (ptsMap[m.teamAId]||0) + 1;
        else if(bWins > aWins) ptsMap[m.teamBId] = (ptsMap[m.teamBId]||0) + 1;
      });
      
      const sorted = teamsInDiv.sort((a, b) => (ptsMap[b.id]||0) - (ptsMap[a.id]||0));
      myPos = sorted.findIndex(t => t.id === team.id) + 1;
    }
  } catch (e) {
    console.warn("Error calculando posición:", e);
  }

  return `
    <div class="card" style="margin-bottom:20px; border-left:4px solid var(--accent)">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px">
        <div style="display:flex; align-items:center; gap:20px;">
          <div class="team-logo-box-xl" style="width:80px; height:80px;">
            ${team.logo ? `<img src="${team.logo}" style="width:100%;height:100%;object-fit:contain">` : '<span style="font-size:30px">🛡</span>'}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="font-family:var(--font-display); font-size:24px; color:var(--silver-light); margin:0;">${team.name}</h2>
              <span class="badge" style="background:var(--bg-graphite); border:1px solid var(--border); color:var(--gold); font-size:14px; padding:4px 10px;">#${myPos} Puesto</span>
            </div>
            <div style="font-size:14px; color:var(--success); font-weight:600; margin-top:4px;">Saldo: $${Number(team.money || 0).toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="stats-tabs" style="margin-bottom:20px; background:var(--bg-panel)">
      <button class="stats-tab ${_activeTeamTab === 'alignment' ? 'active' : ''}" data-team-tab="alignment">Alineación</button>
      <button class="stats-tab ${_activeTeamTab === 'results' ? 'active' : ''}" data-team-tab="results">Resultados</button>
      <button class="stats-tab ${_activeTeamTab === 'analysis' ? 'active' : ''}" data-team-tab="analysis">Sala de Análisis</button>
      <button class="stats-tab ${_activeTeamTab === 'contracts' ? 'active' : ''}" data-team-tab="contracts">Contratos</button>
      <button class="stats-tab ${_activeTeamTab === 'standings' ? 'active' : ''}" data-team-tab="standings">Tabla General</button>
    </div>

    <div id="teamSubView">
      ${renderSubView(DB, session)}
    </div>
  `;
}

function renderSubView(DB, session) {
  if (_activeTeamTab === 'alignment') return renderAlignmentView(DB, session);
  if (_activeTeamTab === 'results') return renderResultsView(DB, session);
  if (_activeTeamTab === 'analysis') return renderAnalysisView(DB, session);
  if (_activeTeamTab === 'contracts') return renderContractsView(DB, session);
  if (_activeTeamTab === 'standings') return renderStandingsView(DB, session);
  return '';
}

export function bindDashboardEvents(DB, session) {
  document.querySelectorAll('[data-team-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTeamTab = btn.dataset.teamTab;
      document.querySelectorAll('[data-team-tab]').forEach(b => b.classList.toggle('active', b === btn));
      const subView = document.getElementById('teamSubView');
      subView.innerHTML = renderSubView(DB, session);
      bindSubViewEvents(DB, session);
    });
  });

  bindSubViewEvents(DB, session);
}

function bindSubViewEvents(DB, session) {
  if (_activeTeamTab === 'alignment') bindAlignmentEvents(DB, session);
  if (_activeTeamTab === 'results') bindResultsEvents(DB, session);
  if (_activeTeamTab === 'contracts') bindContractsEvents(DB, session);
}
