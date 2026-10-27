import { openModal } from '../services/ui.js?v=58';
import { getNationFlag, getRankColor, getRankLabelResponsive } from '../data/nations.js?v=58';
import { aggregatePlayerStats } from '../services/statistics.js?v=58';

export function showPlayerProfile(player, DB) {
  if (!player) return;
  
  const flag = player.nationalityCode ? getNationFlag(player.nationalityCode) : '';
  const rankColor = getRankColor(player.rank, player.rankLevel);
  const rankLine = getRankLabelResponsive(player.rank, player.rankLevel, player.rankDivision);
  
  const team = DB.teams.find(t => (t.roster || []).some(r => r.playerId === player.id));
  
  // Obtener stats
  let stats = { pig: 0, assists: 0, saves: 0, efficiencyOffense: 0, efficiencyDefense: 0 };
  try {
    const allStats = aggregatePlayerStats({});
    const pStats = allStats.find(s => s.id === player.id);
    if (pStats) stats = pStats;
  } catch (e) { console.warn('Error al cargar stats', e); }

  const finalPig = stats.pig || player.pig || 0;
  const finalValue = player.marketValue || (finalPig * 1000) || 0;

  openModal({
    id: 'player-profile-' + player.id,
    title: 'PERFIL DEL JUGADOR',
    wide: true,
    body: `
      <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px; flex-wrap:wrap;">
        <div style="width:80px; height:80px; border-radius:50%; background:var(--bg-graphite); border:2px solid var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
          ${player.profilePicture ? `<img src="${player.profilePicture}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:24px; font-weight:700;">${player.name.slice(0,2).toUpperCase()}</span>`}
        </div>
        <div>
          <h2 style="font-family:var(--font-display); font-size:24px; color:var(--silver-light); margin:0; display:flex; align-items:center; gap:8px;">
            ${player.name} ${flag ? `<span style="font-size:20px;">${flag}</span>` : ''}
          </h2>
          <div style="display:flex; gap:10px; margin-top:6px; flex-wrap:wrap;">
            <span class="badge" style="color:${rankColor}; border-color:${rankColor}44">${rankLine}</span>
            <span class="badge">${team ? team.name : 'Agente Libre'}</span>
            <span class="badge">${player.platform || '—'}</span>
          </div>
        </div>
      </div>
      
      <div class="kpi-strip" style="grid-template-columns: repeat(3, 1fr); margin-bottom:20px;">
        <div class="kpi"><div class="kpi-val" style="color:var(--gold);">${finalPig.toFixed(1)}</div><div class="kpi-lab">PIG ESTIMADO</div></div>
        <div class="kpi"><div class="kpi-val">$${finalValue.toLocaleString()}</div><div class="kpi-lab">VALOR MERCADO</div></div>
        <div class="kpi"><div class="kpi-val">${stats.efficiencyOffense || 0}%</div><div class="kpi-lab">EFICIENCIA ATAQUE</div></div>
      </div>

      <div class="grid grid-3" style="margin-bottom:20px;">
        <div class="kpi"><div class="kpi-val">${stats.assists || 0}</div><div class="kpi-lab">ASISTENCIAS</div></div>
        <div class="kpi"><div class="kpi-val">${stats.saves || 0}</div><div class="kpi-lab">SALVADAS</div></div>
        <div class="kpi"><div class="kpi-val">${stats.efficiencyDefense || 0}%</div><div class="kpi-lab">EF. DEFENSIVA</div></div>
      </div>

      <div class="divider"></div>
      <div style="font-size:12px; color:var(--muted); text-align:center; margin-top:16px; line-height: 1.6;">
        Para la visualización de más estadísticas de performance,<br>
        visite nuestra página web en <br>
        <a href="https://blitzrl.github.io/blitzRL-viewer/#/performance" target="_blank" style="color:var(--accent); text-decoration:underline; font-weight:600;">blitzrl.github.io/blitzRL-viewer/#/performance</a>
      </div>
    `,
    footer: `<button class="btn btn-ghost" data-close>CERRAR</button>`
  });
}