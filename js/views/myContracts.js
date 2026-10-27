import { loadPortalDB, getSupabase } from '../services/supabase.js';
import { toast } from '../services/ui.js';

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-US');
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString();
}

// Genera una barra visual de vigencia (ej. [🟩🟩⬜⬜⬜])
function getVigenciaBar(duration, remaining) {
  const total = duration || 1;
  const rem = Math.max(0, Math.min(total, remaining));
  const filled = '🟩'.repeat(rem);
  const empty = '⬜'.repeat(total - rem);
  return filled + empty;
}

export function renderMyContractsView(DB, session) {
  const myPlayers = DB.players.filter(p => {
    // Filtramos los jugadores que están en el equipo del coach y tienen contrato
    const isInMyTeam = DB.teams.find(t => t.id === session.teamId)?.roster.some(r => r.playerId === p.id);
    return isInMyTeam && p.contractId;
  });

  const contracts = myPlayers.map(p => {
    const contract = DB.contracts?.find(c => c.id === p.contractId);
    return { player: p, contract };
  }).filter(c => c.contract);

  return `
    <div class="card" style="margin-bottom:20px; border-left:4px solid var(--accent)">
      <div class="card-header">
        <div class="card-title">CENTRO DE CONTRATOS</div>
        <span class="card-sub">${contracts.length} contratos activos</span>
      </div>
      <p style="font-size:12px; color:var(--muted); margin-bottom:16px;">
        Gestiona la vida contractual de tus jugadores. Revisa las cláusulas y renueva antes de que expiren.
      </p>
    </div>

    <div class="grid grid-2">
      ${contracts.map(({ player, contract }) => {
        const isLoan = contract.type === 'loan';
        const hasRenewal = contract.clauses?.renewalOption?.enabled;
        const hasSellOn = contract.clauses?.sellOnClauses?.length > 0;
        const sellOn = hasSellOn ? contract.clauses.sellOnClauses[0] : null;
        
        // Simulamos la vigencia restante (en una implementación real, se calcularía con las jornadas actuales)
        // Como el contrato tiene 'durationMatchdays' y 'endMatchday', podríamos calcularlo, 
        // pero para simplificar, mostraremos la duración total.
        const totalMatchdays = contract.durationMatchdays || 0;
        const endMatchday = contract.endMatchday || 0;
        
        // TODO: Obtener la jornada actual desde el gestor o calcularla
        // Por ahora, mostramos la duración completa como "restante"
        const remaining = totalMatchdays; 

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
              <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
                <span style="font-size:11px; color:var(--muted);">Progreso:</span>
                <span style="font-size:16px; letter-spacing:2px;">${getVigenciaBar(totalMatchdays, remaining)}</span>
              </div>

              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                ${hasSellOn ? `<span class="badge badge-gold" title="El equipo vendedor recibe un % de la próxima venta">💸 Venta: ${sellOn.percentage}%</span>` : ''}
                ${contract.clauses.performance.enabled ? `<span class="badge" style="background:rgba(111,168,255,0.1); color:var(--accent); border-color:rgba(111,168,255,0.3)">🎯 Metas</span>` : ''}
                ${hasRenewal ? `<span class="badge badge-win">🔄 Renovable: $${formatMoney(contract.clauses.renewalOption.price)}</span>` : ''}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:11px; color:var(--muted);">
                  Precio pagado: <b style="color:var(--silver-light)">$${formatMoney(contract.transferPrice)}</b>
                </div>
                ${hasRenewal ? `
                  <button class="btn btn-sm btn-primary" data-renew-contract="${contract.id}">RENOVAR</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('') || '<div class="card" style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1;">No tienes contratos activos. Ficha jugadores para empezar.</div>'}
    </div>
  `;
}

export function bindMyContractsEvents(DB, session) {
  document.querySelectorAll('[data-renew-contract]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const contractId = btn.dataset.renewContract;
      const contract = DB.contracts.find(c => c.id === contractId);
      
      if (!confirm(`¿Renovar el contrato por $${formatMoney(contract.clauses.renewalOption.price)}?`)) return;

      try {
        btn.disabled = true;
        btn.textContent = '...';
        
        // Aquí iría la llamada a la RPC para renovar (coach_renew_contract)
        // Por ahora, mostramos un mensaje de que se ha enviado la solicitud
        toast('✅ Solicitud de renovación enviada al Admin', 'success');
        
        // Enviar notificación al admin vía supabase (opcional)
        await getSupabase().from('coach_notifications').insert({
          coach_id: session.coachId,
          type: 'info',
          title: 'Solicitud de Renovación',
          body: `Has solicitado renovar el contrato de ${contract.playerId} por $${formatMoney(contract.clauses.renewalOption.price)}`,
          priority: 'normal'
        });

      } catch (e) {
        toast('Error: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'RENOVAR';
      }
    });
  });
}