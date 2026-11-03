import { getRankColor } from '../../data/nations.js?v=63';

export function renderAnalysisView(DB, session) {
  const myTeam = DB.teams.find(t => t.id === session.activeTeamId);
  if (!myTeam) return `<div class="card">Equipo no encontrado.</div>`;

  const statsMap = {};
  (myTeam.roster || []).forEach(r => {
    statsMap[r.playerId] = { games: 0, goals: 0, assists: 0, saves: 0, wins: 0, losses: 0, winStreak: 0, lossStreak: 0 };
  });

  DB.matches.filter(m => m.status === 'finished').forEach(m => {
    const isHome = m.teamAId === session.activeTeamId;
    const isAway = m.teamBId === session.activeTeamId;
    if (!isHome && !isAway) return;

    (m.games || []).forEach(g => {
      const winnerId = g.scoreA > g.scoreB ? m.teamAId : m.teamBId;
      const myTeamWon = winnerId === session.activeTeamId;

      (g.players || []).forEach(p => {
        if (statsMap[p.playerId]) {
          const s = statsMap[p.playerId];
          s.games++;
          s.goals += p.goals || 0;
          s.assists += p.assists || 0;
          s.saves += p.saves || 0;
          
          if (myTeamWon) {
            s.wins++; s.winStreak++; s.lossStreak = 0;
          } else {
            s.losses++; s.lossStreak++; s.winStreak = 0;
          }
        }
      });
    });
  });

  const allStats = Object.keys(statsMap).map(pid => {
    const s = statsMap[pid];
    const p = DB.players.find(x => x.id === pid) || {};
    const pig = (s.goals * 2) + (s.assists * 1.5) + (s.saves * 1) + ((s.games > 0 ? (s.goals / s.games) : 0) * 5);
    return { ...s, id: pid, player: p, pig };
  }).filter(s => s.games > 0).sort((a, b) => b.pig - a.pig);

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">SALA DE ANÁLISIS (RENDIMIENTO)</div>
        <button class="btn btn-sm" style="border-color:var(--accent); color:var(--accent);" onclick="alert('Coach IA en construcción...')">🤖 ANALIZAR CON COACH IA</button>
      </div>
      <div class="table-wrap">
        <table class="ztable">
          <thead>
            <tr>
              <th>JUGADOR</th>
              <th class="num">PJ</th>
              <th class="num">GOLES</th>
              <th class="num">ASIST.</th>
              <th class="num">SALVADAS</th>
              <th class="num">PIG EST.</th>
              <th class="num">RACHA</th>
            </tr>
          </thead>
          <tbody>
            ${allStats.map(s => {
              const rankColor = getRankColor(s.player.rank, s.player.rankLevel);
              
              let streakLabel = 'Neutra';
              let streakColor = 'var(--muted)';
              if (s.winStreak >= 3) { streakLabel = '🔥 Buena'; streakColor = 'var(--success)'; }
              else if (s.lossStreak >= 3) { streakLabel = '📉 Mala'; streakColor = 'var(--danger)'; }

              return `
                <tr>
                  <td><span class="player-name-cell" style="font-weight:600; color:${rankColor}">${s.player.name || '?'}</span></td>
                  <td class="num">${s.games}</td>
                  <td class="num">${s.goals}</td>
                  <td class="num">${s.assists}</td>
                  <td class="num">${s.saves}</td>
                  <td class="num" style="color:var(--gold); font-weight:600">${s.pig.toFixed(1)}</td>
                  <td class="num" style="color:${streakColor}">${streakLabel}</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">Aún no hay datos de rendimiento para tus jugadores.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
