import { openModal } from '../services/ui.js?v=64';

export function renderResultsView(DB, session) {
  const myTeam = DB.teams.find(t => t.id === session.activeTeamId);
  if (!myTeam) return `<div class="card">Equipo no encontrado.</div>`;

  const matches = DB.matches
    .filter(m => (m.teamAId === session.activeTeamId || m.teamBId === session.activeTeamId) && m.status === 'finished')
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
              const isHome = m.teamAId === session.activeTeamId;
              const rivalId = isHome ? m.teamBId : m.teamAId;
              const rival = DB.teams.find(t => t.id === rivalId) || { name: 'Desconocido' };
              
              const myWins = m.games.filter(g => (isHome ? g.scoreA > g.scoreB : g.scoreB > g.scoreA)).length;
              const rivalWins = m.games.filter(g => (isHome ? g.scoreB > g.scoreA : g.scoreA > g.scoreB)).length;
              
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
      
      // 🔥 LLAMAMOS A LA FUNCIÓN INTERNA DEL MODAL
      openMatchSummaryModal(m, DB);
    });
  });
}

// ============================================================
// MODAL DE RESUMEN DE PARTIDO (Integrado aquí para evitar errores)
// ============================================================
function openMatchSummaryModal(match, DB) {
  const A = DB.teams.find(t => t.id === match.teamAId) || { name: '?', logo: '' };
  const B = DB.teams.find(t => t.id === match.teamBId) || { name: '?', logo: '' };
  const games = match.games || [];

  if (games.length === 0) {
    return openModal({
      id: 'match-summary-' + match.id,
      title: 'SIN PARTIDAS',
      body: '<div style="padding:20px;text-align:center;color:var(--muted)">Este partido no tiene partidas reportadas.</div>',
      footer: '<button class="btn btn-ghost" data-close>CERRAR</button>'
    });
  }

  let totalA = 0, totalB = 0;
  games.forEach(g => {
    if (g.scoreA > g.scoreB) totalA++;
    else if (g.scoreB > g.scoreA) totalB++;
  });

  const format = match.format || 'BO3';
  const title = `RESUMEN · JORNADA ${match.matchday}`;

  openModal({
    id: 'match-summary-' + match.id,
    title: escapeHtml(title),
    wide: true,
    body: `
      <div class="match-summary">
        <!-- Hero -->
        <div class="ms-hero">
          <div class="ms-team ms-team-a">
            ${A.logo ? `<img src="${A.logo}" class="ms-team-logo">` : `<div class="ms-team-logo ms-team-logo-empty">◆</div>`}
            <div class="ms-team-name">${escapeHtml(A.name)}</div>
          </div>
          <div class="ms-score">
            <div class="ms-score-line">
              <span class="ms-score-value">${totalA}</span>
              <span class="ms-score-sep">–</span>
              <span class="ms-score-value">${totalB}</span>
            </div>
            <div class="ms-score-meta">SERIE ${escapeHtml(format)} · ${games.length} PARTIDA${games.length !== 1 ? 'S' : ''}</div>
          </div>
          <div class="ms-team ms-team-b">
            ${B.logo ? `<img src="${B.logo}" class="ms-team-logo">` : `<div class="ms-team-logo ms-team-logo-empty">◆</div>`}
            <div class="ms-team-name">${escapeHtml(B.name)}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="ms-tabs" id="msTabs">
          ${games.map((g, i) => `
            <button class="ms-tab ${i === 0 ? 'active' : ''}" data-ms-tab="${i}">
              PARTIDO ${i + 1} · ${g.scoreA}-${g.scoreB}
            </button>
          `).join('')}
          <button class="ms-tab ms-tab-total" data-ms-tab="total">Σ SUMA TOTAL</button>
        </div>

        <!-- Body -->
        <div class="ms-body" id="msBody"></div>
      </div>
    `,
    footer: `<button class="btn btn-ghost" data-close>CERRAR</button>`,
    onMount: root => {
      const tabsEl = root.querySelector('#msTabs');
      const bodyEl = root.querySelector('#msBody');

      function renderTab(tabId) {
        if (tabId === 'total') {
          bodyEl.innerHTML = renderTotalStats(games, A, B, DB);
        } else {
          const idx = +tabId;
          const g = games[idx];
          if (!g) return;
          bodyEl.innerHTML = renderGameStats(g, idx, A, B, DB);
        }
      }

      tabsEl.addEventListener('click', e => {
        const t = e.target.closest('[data-ms-tab]');
        if (!t) return;
        tabsEl.querySelectorAll('.ms-tab').forEach(x => x.classList.toggle('active', x === t));
        renderTab(t.dataset.msTab);
      });

      renderTab('0');
    }
  });
}

// ============================================================
// RENDER DE UNA PARTIDA INDIVIDUAL
// ============================================================
function renderGameStats(g, idx, A, B, DB) {
  const playersA = (g.players || []).filter(p => p.teamId === A.id);
  const playersB = (g.players || []).filter(p => p.teamId === B.id);
  const winnerIsA = g.scoreA > g.scoreB;

  return `
    <div class="ms-body-title">
      PARTIDO ${idx + 1} · <span style="color:${winnerIsA ? 'var(--success)' : 'var(--danger)'}">${g.scoreA}-${g.scoreB}</span>
    </div>
    <div class="ms-grid">
      ${renderTeamBlock(A, playersA, g.scoreA, winnerIsA, DB)}
      ${renderTeamBlock(B, playersB, g.scoreB, !winnerIsA, DB)}
    </div>
  `;
}

function renderTeamBlock(team, players, score, isWinner, DB) {
  return `
    <div class="ms-team-block ${isWinner ? 'winner' : 'loser'}">
      <div class="ms-team-block-head">
        <span class="ms-team-block-score">${score}</span>
        <span class="ms-team-block-name">${escapeHtml(team.name)}</span>
        ${isWinner ? '<span class="ms-team-block-check">✓</span>' : ''}
      </div>
      <table class="ms-table">
        <thead>
          <tr>
            <th>JUGADOR</th>
            <th class="num">G</th>
            <th class="num">A</th>
            <th class="num">S</th>
            <th class="num">T</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => {
            const player = DB.players.find(x => x.id === p.playerId);
            const name = player?.name || '?';
            return `<tr>
              <td class="ms-td-name">${escapeHtml(name)}</td>
              <td class="num">${p.goals || 0}</td>
              <td class="num">${p.assists || 0}</td>
              <td class="num">${p.saves || 0}</td>
              <td class="num">${p.shots || 0}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);font-size:11px">Sin datos</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// RENDER DE LA SUMA TOTAL DE LA SERIE
// ============================================================
function renderTotalStats(games, A, B, DB) {
  const aggA = new Map();
  const aggB = new Map();
  let totalA = 0, totalB = 0;

  games.forEach(g => {
    if (g.scoreA > g.scoreB) totalA++;
    else if (g.scoreB > g.scoreA) totalB++;

    (g.players || []).forEach(p => {
      const isA = p.teamId === A.id;
      const map = isA ? aggA : aggB;
      const cur = map.get(p.playerId) || { goals: 0, assists: 0, saves: 0, shots: 0 };
      cur.goals   += p.goals   || 0;
      cur.assists += p.assists || 0;
      cur.saves   += p.saves   || 0;
      cur.shots   += p.shots   || 0;
      map.set(p.playerId, cur);
    });
  });

  function rowsFromMap(map) {
    if (map.size === 0) return [];
    return [...map.entries()].map(([pid, s]) => {
      const player = DB.players.find(x => x.id === pid);
      return { playerId: pid, name: player?.name || '?', ...s };
    });
  }

  const rowsA = rowsFromMap(aggA);
  const rowsB = rowsFromMap(aggB);

  return `
    <div class="ms-body-title">
      Σ SUMA TOTAL · ${games.length} PARTIDA${games.length !== 1 ? 'S' : ''}
    </div>
    <div class="ms-grid">
      ${renderTotalTeamBlock(A, rowsA, totalA, totalA > totalB)}
      ${renderTotalTeamBlock(B, rowsB, totalB, totalB > totalA)}
    </div>
  `;
}

function renderTotalTeamBlock(team, rows, score, isWinner) {
  return `
    <div class="ms-team-block ${isWinner ? 'winner' : 'loser'}">
      <div class="ms-team-block-head">
        <span class="ms-team-block-score">${score}</span>
        <span class="ms-team-block-name">${escapeHtml(team.name)}</span>
        ${isWinner ? '<span class="ms-team-block-check">✓</span>' : ''}
      </div>
      <table class="ms-table">
        <thead>
          <tr>
            <th>JUGADOR</th>
            <th class="num">G</th>
            <th class="num">A</th>
            <th class="num">S</th>
            <th class="num">T</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="ms-td-name">${escapeHtml(r.name)}</td>
              <td class="num">${r.goals}</td>
              <td class="num">${r.assists}</td>
              <td class="num">${r.saves}</td>
              <td class="num">${r.shots}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);font-size:11px">Sin datos</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
