import { getDB } from '../services/storage.js';
import { getSupabase, createCoachRequest, respondPortalRequest } from '../services/supabase.js?v=51';
import { toast, openModal, closeTopModal } from '../services/ui.js?v=51';
import { calculatePlayerPrice } from '../services/economy.js?v=51';

export function openSigningWizard(DB, session, playerId, isLoan = false, prefillData = null, counterTargetTeamId = null) {
  const player = DB.players.find(p => p.id === playerId);
  if (!player) return toast('Jugador no encontrado', 'error');

  const myTeam = DB.teams.find(t => t.id === session.teamId);
  const isInternalSigning = myTeam && myTeam.roster.some(r => r.playerId === playerId);
  
  const originTeam = DB.teams.find(t => (t.roster || []).some(r => r.playerId === playerId));
  const isFreeAgent = !originTeam;
  
  const priceData = calculatePlayerPrice(player, { pig: player.pig || 0 }, DB.config.economy);
  const basePlayerValue = player.marketValue || priceData.price;

  const fromTeamId = session.teamId; 
  const toTeamId = isInternalSigning ? session.teamId : (counterTargetTeamId || originTeam?.id);
  const toTeamName = isInternalSigning ? myTeam.name : (DB.teams.find(t => t.id === toTeamId)?.name || 'Equipo Rival');

  if (isFreeAgent && !isInternalSigning && !counterTargetTeamId) {
    if (!confirm(`¿Enviar solicitud de fichaje al Admin por ${player.name}?`)) return;
    getSupabase().rpc('coach_sign_free_agent', { p_token: session.token, p_player_id: player.id, p_team_id: session.teamId })
      .then(({ error }) => {
        if (error) toast('Error: ' + error.message, 'error');
        else { toast('✅ Solicitud enviada al Admin', 'success'); window.dispatchEvent(new HashChangeEvent('hashchange')); }
      });
    return;
  }

  const state = {
    step: 1,
    durationSeasons: prefillData?.durationSeasons || 1,
    durationMatchdays: prefillData?.durationMatchdays || 0,
    uniquePrice: isInternalSigning ? 0 : (prefillData?.uniquePrice || basePlayerValue),
    perMatchdayPrice: prefillData?.perMatchdayPrice || 0,
    perfEnabled: prefillData?.performanceEnabled || false,
    perfTargets: prefillData?.performanceTargets || { gamesPlayed: false, goals: false, assists: false, saves: false, efficiency: false },
    renewalOption: prefillData?.renewalOptionEnabled || false,
    renewalPrice: prefillData?.renewalPrice || 0,
    sellOnClause: prefillData?.sellOnClauses?.length > 0 || false,
    sellOnPercentage: prefillData?.sellOnClauses?.[0]?.percentage || 15,
    sellOnSales: prefillData?.sellOnClauses?.[0]?.remainingSales || 1,
    customMessage: prefillData?.customMessage || ''
  };

  openModal({
    id: 'signing-modal-' + playerId,
    title: `${isInternalSigning ? 'FIRMAR CONTRATO' : (prefillData ? 'CONTRAOFERTA' : (isLoan ? 'PRÉSTAMO' : 'FICHAJE'))} · ${player.name.toUpperCase()}`,
    wide: true,
    body: `<div id="signingWizardBody"></div>`,
    footer: `
      <button class="btn btn-ghost" id="signBtnPrev" style="display:none">← ATRÁS</button>
      <button class="btn btn-primary" id="signBtnNext">SIGUIENTE →</button>
    `,
    onMount: (root) => {
      const body = root.querySelector('#signingWizardBody');
      const btnPrev = root.querySelector('#signBtnPrev');
      const btnNext = root.querySelector('#signBtnNext');

      function render() {
        btnPrev.style.display = state.step > 1 ? 'inline-flex' : 'none';
        btnNext.textContent = state.step === 3 ? (isInternalSigning ? 'FIRMAR CONTRATO' : (prefillData ? 'ENVIAR CONTRAOFERTA' : (isLoan ? 'ENVIAR OFERTA DE PRÉSTAMO' : 'ENVIAR OFERTA DE FICHAJE'))) : 'SIGUIENTE →';
        
        if (state.step === 1) {
          body.innerHTML = `
            <div class="card">
              <div class="card-header"><div class="card-title">PASO 1: VIGENCIA Y ECONÓMICO</div></div>
              <div class="row">
                <div class="field"><label>Temporadas</label><input class="input" type="number" id="sSeasons" min="1" max="5" value="${state.durationSeasons}"></div>
                <div class="field"><label>Jornadas extra</label><input class="input" type="number" id="sMatchdays" min="0" max="20" value="${state.durationMatchdays}"></div>
              </div>
              <div class="row">
                ${!isInternalSigning ? `<div class="field"><label>Precio de ${isLoan ? 'Préstamo' : 'Fichaje'} ($)</label><input class="input" type="number" id="sUnique" value="${state.uniquePrice}"></div>` : ''}
                ${isLoan ? `<div class="field"><label>Precio por Jornada ($)</label><input class="input" type="number" id="sPerMatch" value="${state.perMatchdayPrice}"></div>` : ''}
              </div>
              ${!isLoan && !isInternalSigning ? `
              <div class="field" style="margin-top:16px; padding:12px; background:var(--bg-graphite); border-radius:8px;">
                <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                  <input type="checkbox" id="sSellOnEnabled" ${state.sellOnClause ? 'checked' : ''}> Activar Cláusula de Futura Venta
                </label>
                <div id="sSellOnFields" style="opacity:${state.sellOnClause ? 1 : 0.4}; pointer-events:${state.sellOnClause ? 'auto' : 'none'};">
                  <div class="row">
                    <div class="field"><label>Porcentaje (%)</label><input class="input" type="number" id="sSellOnPct" min="1" max="100" value="${state.sellOnPercentage}"></div>
                    <div class="field"><label>Válido por X ventas</label><input class="input" type="number" id="sSellOnSales" min="1" max="5" value="${state.sellOnSales}"></div>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>
          `;
        }
        else if (state.step === 2) {
          body.innerHTML = `
            <div class="card">
              <div class="card-header"><div class="card-title">PASO 2: RENDIMIENTO Y RENOVACIÓN</div></div>
              <label style="display:flex; align-items:center; gap:8px; margin-bottom:16px; font-weight:600;">
                <input type="checkbox" id="sPerfEnabled" ${state.perfEnabled ? 'checked' : ''}> Activar cláusula de rendimiento
              </label>
              <div style="opacity: ${state.perfEnabled ? 1 : 0.4}; pointer-events: ${state.perfEnabled ? 'auto' : 'none'};">
                <div class="row-3">
                  <label><input type="checkbox" id="sPg" ${state.perfTargets.gamesPlayed ? 'checked' : ''}> Partidos</label>
                  <label><input type="checkbox" id="sPgoals" ${state.perfTargets.goals ? 'checked' : ''}> Goles</label>
                  <label><input type="checkbox" id="sPassists" ${state.perfTargets.assists ? 'checked' : ''}> Asistencias</label>
                </div>
                <div class="row-3" style="margin-top:10px;">
                  <input class="input" type="number" id="sPgVal" value="${state.perfTargets.gamesPlayedMin || 0}" placeholder="PJ Mín">
                  <input class="input" type="number" id="sPgoalsVal" value="${state.perfTargets.goalsMin || 0}" placeholder="Goles Mín">
                  <input class="input" type="number" id="sPassistsVal" value="${state.perfTargets.assistsMin || 0}" placeholder="Asist Mín">
                </div>
              </div>
              <div class="divider"></div>
              <label style="display:flex; align-items:center; gap:8px; margin-bottom:16px; font-weight:600;">
                <input type="checkbox" id="sRenewEnabled" ${state.renewalOption ? 'checked' : ''}> Opción de Renovación
              </label>
              <div style="opacity: ${state.renewalOption ? 1 : 0.4}; pointer-events: ${state.renewalOption ? 'auto' : 'none'};">
                <div class="field"><label>Precio para renovar ($)</label><input class="input" type="number" id="sRenewPrice" value="${state.renewalPrice}"></div>
              </div>
            </div>
          `;
        }
        else if (state.step === 3) {
          if (isInternalSigning) {
            body.innerHTML = `
              <div class="card" style="border-left:4px solid var(--success)">
                <div class="card-header"><div class="card-title">PASO 3: CONFIRMACIÓN DE FIRMA</div></div>
                <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
                  <div><b>Jugador:</b> ${player.name}</div>
                  <div><b>Equipo:</b> ${myTeam.name}</div>
                  <div><b>Vigencia:</b> ${state.durationSeasons} Temp. + ${state.durationMatchdays} Jorn.</div>
                  <p style="color:var(--muted); font-size:12px; margin-top:10px;">Al firmar, el jugador pasará a tener un contrato activo en tu plantilla.</p>
                </div>
              </div>
            `;
          } else {
            body.innerHTML = `
              <div class="card" style="border-left:4px solid var(--success)">
                <div class="card-header"><div class="card-title">PASO 3: CONFIRMACIÓN Y MENSAJE</div></div>
                <div class="field">
                  <label>Mensaje para el otro Coach (Opcional)</label>
                  <textarea class="textarea" id="sMessage" rows="4" placeholder="Ej: Podemos ofertar más, contactame por Discord...">${state.customMessage}</textarea>
                </div>
                <div style="font-size:12px; color:var(--muted); margin-top:16px; padding:12px; background:var(--bg-deep); border-radius:6px;">
                  <div><b>Jugador:</b> ${player.name}</div>
                  <div><b>Dueño actual:</b> ${originTeam?.name || 'Agente Libre'}</div>
                  <div><b>Envías la oferta a:</b> ${toTeamName}</div>
                  <div><b>Vigencia:</b> ${state.durationSeasons} Temp. + ${state.durationMatchdays} Jorn.</div>
                  <div><b>Precio:</b> $${state.uniquePrice.toLocaleString()}</div>
                </div>
              </div>
            `;
          }
        }
      }

      function saveState() {
        if (state.step === 1) {
          state.durationSeasons = parseInt(body.querySelector('#sSeasons')?.value) || 1;
          state.durationMatchdays = parseInt(body.querySelector('#sMatchdays')?.value) || 0;
          if (!isInternalSigning) state.uniquePrice = parseInt(body.querySelector('#sUnique')?.value) || 0;
          if (isLoan) state.perMatchdayPrice = parseInt(body.querySelector('#sPerMatch')?.value) || 0;
          if (!isLoan && !isInternalSigning) {
            state.sellOnClause = body.querySelector('#sSellOnEnabled')?.checked || false;
            state.sellOnPercentage = parseInt(body.querySelector('#sSellOnPct')?.value) || 0;
            state.sellOnSales = parseInt(body.querySelector('#sSellOnSales')?.value) || 0;
          }
        } else if (state.step === 2) {
          state.perfEnabled = body.querySelector('#sPerfEnabled')?.checked || false;
          state.renewalOption = body.querySelector('#sRenewEnabled')?.checked || false;
          state.renewalPrice = parseInt(body.querySelector('#sRenewPrice')?.value) || 0;
          if (state.perfEnabled) {
            state.perfTargets = {
              gamesPlayed: { enabled: body.querySelector('#sPg').checked, min: parseInt(body.querySelector('#sPgVal').value) || 0 },
              goals: { enabled: body.querySelector('#sPgoals').checked, min: parseInt(body.querySelector('#sPgoalsVal').value) || 0 },
              assists: { enabled: body.querySelector('#sPassists').checked, min: parseInt(body.querySelector('#sPassistsVal').value) || 0 }
            };
          }
        } else if (state.step === 3) {
          if (!isInternalSigning) {
            state.customMessage = body.querySelector('#sMessage')?.value.trim() || '';
          }
        }
      }

      btnNext.addEventListener('click', async () => {
        saveState();
        if (state.step < 3) {
          state.step++;
          render();
        } else {
          try {
            btnNext.disabled = true;
            btnNext.textContent = 'ENVIANDO...';
            
            const payload = {
              playerId: player.id,
              playerName: player.name,
              from_team_id: fromTeamId,
              is_counter_offer: !!counterTargetTeamId,
              durationSeasons: state.durationSeasons,
              durationMatchdays: state.durationMatchdays,
              uniquePrice: state.uniquePrice,
              perMatchdayPrice: state.perMatchdayPrice,
              performanceEnabled: state.perfEnabled,
              performanceTargets: state.perfTargets,
              renewalOptionEnabled: state.renewalOption,
              renewalPrice: state.renewalPrice,
              sellOnClauses: (state.sellOnClause && !isInternalSigning) ? [{ originalTeamId: originTeam.id, percentage: state.sellOnPercentage, remainingSales: state.sellOnSales }] : [],
              customMessage: state.customMessage,
              is_internal_signing: isInternalSigning 
            };

            if (isInternalSigning) {
              // 🔥 FIX: Usamos la RPC para insertar (evita bloqueo RLS) y luego la auto-aceptamos
              const res = await createCoachRequest(session.token, 'contract_sign', session.teamId, payload);
              if (res && res.request_id) {
                await respondPortalRequest(session.token, 'accept', res.request_id);
              }
              toast('✅ Contrato firmado. Procesando...', 'success');
            } else {
              const reqType = isLoan ? 'loan_request' : 'transfer_offer';
              await createCoachRequest(session.token, reqType, toTeamId, payload);
              toast(`✅ ${prefillData ? 'Contraoferta' : 'Oferta'} enviada`, 'success');
            }

            closeTopModal();
            // Damos tiempo al Gestor (radar de 10s) para procesar y subir a Supabase
            setTimeout(() => {
              if (window.refreshPortalView) window.refreshPortalView();
            }, 8000);

          } catch (e) {
            toast('Error: ' + e.message, 'error');
            btnNext.disabled = false;
            btnNext.textContent = 'ENVIAR';
          }
        }
      });

      btnPrev.addEventListener('click', () => {
        saveState();
        state.step--;
        render();
      });

      body.addEventListener('change', (e) => {
        if (e.target.id === 'sPerfEnabled' || e.target.id === 'sRenewEnabled' || e.target.id === 'sSellOnEnabled') {
          saveState();
          render();
        }
      });

      render();
    }
  });
}