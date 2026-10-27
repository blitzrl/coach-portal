import { openModal } from '../services/ui.js?v=50';
import { getDB } from '../services/storage.js';

export function renderResultsView(DB, session) {
  const myTeam = DB.teams.find(t => t.id === session.teamId);
  if (!myTeam) return `<div class="card">Equipo no encontrado.</div>`;

  const matches = DB.matches
    .filter(m => (m.teamAId === session.teamId || m.teamBId === session.teamId) && m.status === 'finished')
    .sort((a, b) => b.matchday - a.matchday);

  return `
    <div class="card">
      <div class="card-header"><div class="card-title">RESULTADOS DE LA TEMPORADA</div></div>
      <div class="table-wrap">
        <table class="ztable">
          <thead>
            <tr>
              <th>JORNADA</th>
              <th>RIVAL</th>
              <th class="num">MARCADOR</th>
              <th class="num">RESULTADO</th>
              <th class="num">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map(m => {
              const isHome = m.teamAId === session.teamId;
              const rivalId = isHome ? m.teamBId : m.teamAId;
              const rival = DB.teams.find(t => t.id === rivalId) || { name: 'Desconocido' };
              
              const myWins = (m.games || []).filter(g => (isHome ? g.scoreA > g.scoreB : g.scoreB > g.scoreA)).length;
              const rivalWins = (m.games || []).filter(g => (isHome ? g.scoreB > g.scoreA : g.scoreA > g.scoreB)).length;
              
              const isWin = myWins > rivalWins;
              const color = isWin ? 'var(--success)' : 'var(--danger)';
              const text = isWin ? 'VICTORIA' : 'DERROTA';

              return `
                <tr style="cursor:pointer;" data-match-summary-id="${m.id}">
                  <td>J${m.matchday}</td>
                  <td><b>${rival.name}</b></td>
                  <td class="num" style="font-family:var(--font-display); font-size:16px;">${myWins} - ${rivalWins}</td>
                  <td class="num"><span class="badge" style="color:${color}; border-color:${color}">${text}</span></td>
                  <td class="num" style="color:var(--accent); font-size:11px; font-weight:600;">VER DETALLE →</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">No hay partidos terminados aún.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function bindResultsEvents(DB, session) {
  document.querySelectorAll('[data-match-summary-id]').forEach(row => {
    row.addEventListener('click', () => {
      const matchId = row.dataset.matchSummaryId;
      const m = DB.matches.find(x => x.id === matchId);
      if (!m) return;
      
      const A = DB.teams.find(t => t.id === m.teamAId) || { name: '?', logo: '' };
      const B = DB.teams.find(t => t.id === m.teamBId) || { name: '?', logo: '' };
      const games = m.games || [];

      if (games.length === 0) return alert('Sin partidas reportadas.');

      let totalA = 0, totalB = 0;
      games.forEach(g => {
        if(g.scoreA > g.scoreB) totalA++; else if(g.scoreB > g.scoreA) totalB++;
      });

      let gamesHTML = games.map((g, i) => {
        const playersA = (g.players || []).filter(p => p.teamId === A.id);
        const playersB = (g.players || []).filter(p => p.teamId === B.id);
        
        const renderTable = (players) => `
          <table class="ztable" style="font-size:11px; margin-top:10px;">
            <thead><tr><th>JUGADOR</th><th class="num">G</th><th class="num">A</th><th class="num">S</th><th class="num">T</th></tr></thead>
            <tbody>
              ${players.map(p => {
                const pl = DB.players.find(x => x.id === p.playerId);
                return `<tr><td>${pl ? pl.name : '?'}</td><td class="num">${p.goals||0}</td><td class="num">${p.assists||0}</td><td class="num">${p.saves||0}</td><td class="num">${p.shots||0}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        `;

        return `
          <div class="card" style="margin-bottom:12px; background:var(--bg-graphite);">
            <div style="font-size:14px; font-weight:600; color:var(--silver-light); text-align:center; margin-bottom:10px;">PARTIDA ${i+1} · ${g.scoreA} - ${g.scoreB}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div><div style="text-align:center; font-size:12px; color:var(--accent);">${A.name}</div>${renderTable(playersA)}</div>
              <div><div style="text-align:center; font-size:12px; color:var(--accent);">${B.name}</div>${renderTable(playersB)}</div>
            </div>
          </div>
        `;
      }).join('');

      openModal({
        id: 'match-summary-' + m.id,
        title: 'RESUMEN DEL PARTIDO',
        wide: true,
        body: `
          <div style="text-align:center; margin-bottom:20px;">
            <h2 style="font-family:var(--font-display); font-size:28px; color:var(--silver-light); margin:0;">${A.name} ${totalA} - ${totalB} ${B.name}</h2>
          </div>
          ${gamesHTML}
        `,
        footer: `<button class="btn btn-ghost" data-close>CERRAR</button>`
      });
    });
  });
}