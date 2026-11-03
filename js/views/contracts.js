import { toast } from '../../services/ui.js?v=63';
import { getSupabase } from '../../services/supabase.js?v=63';

function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US'); }

export function renderContractsView(DB, session) {
  const team = DB.teams.find(t => t.id === session.activeTeamId);
  if(!team) return `<div class="card">Equipo no encontrado</div>`;
  
  const myPlayers = DB.players.filter(p => team.roster.some(r => r.playerId === p.id));

  return `
    <div class="card" style="margin-bottom:20px; border-left:4px solid var(--accent)">
      <div class="card-header">
        <div class="card-title">CONTRATOS DE MI PLANTILLA</div>
        <span class="card-sub">${myPlayers.length} jugadores</span>
      </div>
      <p style="font-size:12px; color:var(--muted); margin-bottom:16px;">
        Administra la vida contractual de tus jugadores. Puedes renovar o liberar contratos.
      </p>
    </div>

    <div class="grid grid-2">
      ${myPlayers.map(player => {
        const contract = DB.contracts?.find(c => c.id === player.contractId);
        
        if (!contract) {
          return `
            <div class="card" style="border-left:4px solid var(--danger); margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:12px; align-items:center;">
                  ${player.profilePicture ? `<img src="${player.profilePicture}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : `<div style="width:48px;height:48px;border-radius:50%;background:var(--bg-graphite);display:flex;align-items:center;justify-content:center;font-weight:700;">${(player.name||'?').slice(0,2).toUpperCase()}</div>`}
                  <div>
                    <div style="font-size:16px; font-weight:600; color:var(--silver-light);">${player.name}</div>
                    <div style="font-size:11px; color:var(--danger);">SIN CONTRATO ACTIVO</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-primary" data-firmar-contrato="${player.id}">FIRMAR CONTRATO</button>
              </div>
            </div>
          `;
        }

        const isLoan = contract.type === 'loan';
        const hasRenewal = contract.clauses?.renewalOption?.enabled;
        const hasSellOn = contract.clauses?.sellOnClauses?.length > 0;
        const sellOn = hasSellOn ? contract.clauses.sellOnClauses[0] : null;

        return `
          <div class="card" style="border-left:4px solid ${isLoan ? 'var(--gold)' : 'var(--success)'}; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="display:flex; gap:12px; align-items:center;">
                ${player.profilePicture 
                  ? `<img src="${player.profilePicture}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--border)">`
                  : `<div style="width:48px;height:48px;border-radius:50%;background:var(--bg-graphite);display:flex;align-items:center;justify-content:center;font-weight:700;">${(player.name||'?').slice(0,2).toUpperCase()}</div>`}
                <div>
                  <div style="font-size:16px; font-weight:600; color:var(--silver-light);">${player.name}</div>
                  <div style="font-size:11px; color:var(--muted);">${player.rank || '—'} · ${isLoan ? 'PRÉSTAMO' : 'FICHAJE'}</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:10px; color:var(--muted); letter-spacing:.1em;">VIGENCIA</div>
                <div style="font-size:13px; color:var(--accent); font-weight:600;">
                  ${contract.durationSeasons > 0 ? `${contract.durationSeasons} Temp.` : ''} 
                  ${contract.durationMatchdays > 0 ? `+ ${contract.durationMatchdays} Jorn.` : ''}
                </div>
              </div>
            </div>

            <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border-soft);">
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                ${hasSellOn ? `<span class="badge badge-gold" title="El equipo vendedor recibe un % de la próxima venta">💸 Venta: ${sellOn.percentage}%</span>` : ''}
                ${contract.clauses.performance.enabled ? `<span class="badge" style="background:rgba(111,168,255,0.1); color:var(--accent); border-color:rgba(111,168,255,0.3)">🎯 Metas</span>` : ''}
                ${hasRenewal ? `<span class="badge badge-win">🔄 Renovable: $${formatMoney(contract.clauses.renewalOption.price)}</span>` : ''}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:11px; color:var(--muted);">
                  Precio: <b style="color:var(--silver-light)">$${formatMoney(contract.transferPrice)}</b>
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-sm btn-danger" data-release-contract="${contract.id}">LIBERAR</button>
                  ${hasRenewal ? `<button class="btn btn-sm btn-primary" data-renew-contract="${contract.id}">RENOVAR</button>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('') || '<div class="card" style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1;">No tienes jugadores en tu plantilla.</div>'}
    </div>
  `;
}

export function bindContractsEvents(DB, session) {
  document.querySelectorAll('[data-firmar-contrato]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { openSigningWizard } = await import('../signingWizard.js?v=63');
      openSigningWizard(DB, session, btn.dataset.firmarContrato, false);
    });
  });

  document.querySelectorAll('[data-renew-contract]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const contractId = btn.dataset.renewContract;
      const contract = DB.contracts.find(c => c.id === contractId);
      if (!confirm(`¿Renovar el contrato por $${formatMoney(contract.clauses.renewalOption.price)}?`)) return;
      toast('✅ Solicitud de renovación enviada (Pendiente de implementación RPC)', 'success');
    });
  });

  document.querySelectorAll('[data-release-contract]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Estás seguro de liberar a este jugador? Se convertirá en Agente Libre inmediatamente.`)) return;
      toast('⚠️ Liberación solicitada (Pendiente de implementación RPC)', 'info');
    });
  });
}
