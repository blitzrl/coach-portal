function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-US');
}

export function renderEconomyView(DB, session) {
  const team = DB.teams.find(t => t.id === session.activeTeamId);
  if (!team) return `<div class="card">Equipo no encontrado.</div>`;

  const balance = team.money || 0;
  const isDebt = balance < 0;
  const ledger = (DB.config?.economyLedger || []).filter(l => l.teamId === session.activeTeamId);

  return `
    <div class="card" style="margin-bottom:20px; border-left:4px solid ${isDebt ? 'var(--danger)' : 'var(--success)'}">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <div style="font-size:16px; font-weight:600; color:var(--silver-light)">BALANCE DEL CLUB</div>
          <div style="font-size:12px; color:var(--muted)">Fondos disponibles para fichajes y operaciones.</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px; letter-spacing:.1em; color:var(--muted)">SALDO ACTUAL</div>
          <div style="font-family:var(--font-display); font-size:32px; color:${isDebt ? 'var(--danger)' : 'var(--success)'}; line-height:1">
            ${isDebt ? '-' : ''}$${Math.abs(balance).toLocaleString('en-US')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">HISTORIAL DE MOVIMIENTOS</div>
      </div>
      <div class="table-wrap">
        <table class="ztable">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>TIPO</th>
              <th>MOTIVO</th>
              <th class="num">MONTO</th>
            </tr>
          </thead>
          <tbody>
            ${ledger.map(item => {
              const date = new Date(item.ts).toLocaleString();
              const isPositive = item.amount >= 0;
              const typeLabels = {
                transfer: 'Fichaje', free: 'Libre', bonus_win: 'Bonus Victoria',
                bonus_season: 'Bonus Temporada', sanction: 'Sanción', manual_adjust: 'Ajuste Manual',
                loan_unique: 'Préstamo Único', loan_matchday: 'Préstamo Jornada', buy_option: 'Compra',
                sell_on_clause: 'Cláusula Futura Venta'
              };
              return `
                <tr>
                  <td style="font-size:11px;color:var(--muted)">${date}</td>
                  <td><span class="badge" style="font-size:10px">${typeLabels[item.type] || item.type}</span></td>
                  <td style="font-size:12px">${item.reason}</td>
                  <td class="num" style="font-weight:600;color:${isPositive ? 'var(--success)' : 'var(--danger)'}">
                    ${isPositive ? '+' : ''}$${Math.abs(item.amount).toLocaleString('en-US')}
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No hay movimientos registrados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
