export function renderStandingsView(DB, session) {
  const myTeam = DB.teams.find(t => t.id === session.teamId);
  if (!myTeam) return `<div class="card">Equipo no encontrado.</div>`;

  const activeSeason = DB.seasons?.find(s => s.active) || DB.seasons?.[0];
  const division = DB.divisions?.find(d => d.id === myTeam.divisionId);
  
  if (!activeSeason || !division) return `<div class="card" style="text-align:center; padding:20px; color:var(--muted);">Cargando datos de la liga...</div>`;

  const standingsMap = new Map();
  (division.teams || DB.teams.filter(t => t.divisionId === division.id)).forEach(t => {
    standingsMap.set(t.id, { teamId: t.id, name: t.name, logo: t.logo, PTS: 0, SG: 0, SP: 0, PG: 0, PP: 0, DP: 0, GF: 0, GC: 0, DG: 0 });
  });

  const matches = DB.matches.filter(m => m.divisionId === division.id && m.status === 'finished');
  matches.forEach(m => {
    const A = standingsMap.get(m.teamAId), B = standingsMap.get(m.teamBId);
    if (!A || !B) return;
    let aWins = 0, bWins = 0, aGoals = 0, bGoals = 0;
    (m.games || []).forEach(g => {
      aWins += g.scoreA > g.scoreB ? 1 : 0;
      bWins += g.scoreB > g.scoreA ? 1 : 0;
      aGoals += g.scoreA; bGoals += g.scoreB;
    });
    
    A.PG += aWins; A.PP += bWins; B.PG += bWins; B.PP += aWins;
    A.GF += aGoals; A.GC += bGoals; B.GF += bGoals; B.GC += aGoals;
    A.PTS += aWins; B.PTS += bWins;
    if(aWins > bWins){ A.SG++; B.SP++; } else if(bWins > aWins){ B.SG++; A.SP++; }
  });

  let standings = [...standingsMap.values()].map(r => ({
    ...r, DP: r.PG - r.PP, DG: r.GF - r.GC
  })).sort((a, b) => {
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.SG !== a.SG) return b.SG - a.SG;
    if (b.DP !== a.DP) return b.DP - a.DP;
    return b.DG - a.DG;
  });

  const zonesConfig = division.config?.zones?.zones || [];

  standings.forEach((r, i) => {
    r.pos = i + 1;
    const zone = zonesConfig.find(z => r.pos >= z.from && r.pos <= z.to);
    r.zoneColor = zone ? zone.color : 'transparent';
    r.zoneType = zone ? zone.type : 'none';
  });

  const legendItems = [];
  const seen = new Set();
  zonesConfig.forEach(z => {
    if (z.type !== 'none' && z.type && !seen.has(z.type)) {
      seen.add(z.type);
      const label = z.type.charAt(0).toUpperCase() + z.type.slice(1).replace('playin', 'Play-In').replace('playoff', 'Play-Offs').replace('relegation', 'Descenso');
      legendItems.push({ label, color: z.color || '#8D929A' });
    }
  });

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">TABLA GENERAL · ${division.name}</div>
      </div>
      <div class="table-wrap">
        <table class="ztable standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>EQUIPO</th>
              <th class="num">PTS</th>
              <th class="num">SG</th>
              <th class="num">DP</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map(r => `
              <tr style="${r.teamId === session.teamId ? 'background:rgba(111,168,255,0.1); font-weight:bold;' : ''}">
                <td style="border-left: 4px solid ${r.zoneColor};"><span class="pos-num ${r.pos <= 3 ? 'top' : ''}">${r.pos}</span></td>
                <td>
                  <div class="team-cell">
                    ${r.logo ? `<img src="${r.logo}" class="logo-sm">` : `<div class="logo-sm"></div>`}
                    <span class="team-cell-name">${r.name}</span>
                  </div>
                </td>
                <td class="num">${r.PTS}</td>
                <td class="num">${r.SG}</td>
                <td class="num">${r.DP >= 0 ? '+' : ''}${r.DP}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${legendItems.length > 0 ? `
        <div class="zone-legend">
          ${legendItems.map(item => `
            <div class="zone-legend-item">
              <span class="zone-legend-dot" style="background:${item.color}; color:${item.color}"></span>
              ${item.label}
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="widget-footnote" style="text-align:center; margin-top:10px;">PTS: Puntos | SG: Series Ganadas | DP: Diferencia de Puntos</div>
    </div>
  `;
}