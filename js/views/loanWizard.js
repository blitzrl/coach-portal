import { getDB } from '../services/storage.js';
import { createCoachRequest } from '../services/supabase.js?v=64';
import { toast, openModal, closeTopModal } from '../services/ui.js?v=64';

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-US');
}

export function openLoanWizard(DB, session, playerId) {
  const player = DB.players.find(p => p.id === playerId);
  const currentTeam = DB.teams.find(t => (t.roster || []).some(r => r.playerId === playerId));
  if (!player || !currentTeam) return toast('Jugador no encontrado', 'error');

  const state = {
    step: 1,
    durationMatchdays: 5,
    uniquePrice: 0,
    perMatchdayPrice: 0,
    chargeEvenIfNotPlayed: true,
    perfEnabled: false,
    perfTargets: { gamesPlayed: false, goals: false, assists: false, saves: false, efficiency: false }
  };

  openModal({
    id: 'loan-wizard-modal',
    title: `SOLICITAR PRÉSTAMO · ${player.name.toUpperCase()}`,
    wide: true,
    body: `<div id="loanWizardBody"></div>`,
    footer: `
      <button class="btn btn-ghost" id="loanBtnPrev" style="display:none">← ATRÁS</button>
      <button class="btn btn-primary" id="loanBtnNext">SIGUIENTE →</button>
    `,
    onMount: (root) => {
      const body = root.querySelector('#loanWizardBody');
      const btnPrev = root.querySelector('#loanBtnPrev');
      const btnNext = root.querySelector('#loanBtnNext');

      function render() {
        btnPrev.style.display = state.step > 1 ? 'inline-flex' : 'none';
        btnNext.textContent = state.step === 4 ? 'ENVIAR OFERTA' : 'SIGUIENTE →';
        
        if (state.step === 1) {
          body.innerHTML = `
            <div class="card">
              <div class="card-header"><div class="card-title">PASO 1: DURACIÓN</div></div>
              <div class="field">
                <label>Duración (Jornadas)</label>
                <input class="input" type="number" id="lDuration" min="1" max="20" value="${state.durationMatchdays}">
              </div>
            </div>
          `;
        } 
        else if (state.step === 2) {
          body.innerHTML = `
            <div class="card">
              <div class="card-header"><div class="card-title">PASO 2: CLÁUSULAS FINANCIERAS</div></div>
              <div class="row">
                <div class="field">
                  <label>Precio Único ($)</label>
                  <input class="input" type="number" id="lUnique" value="${state.uniquePrice}">
                </div>
                <div class="field">
                  <label>Precio por Jornada ($)</label>
                  <input class="input" type="number" id="lPerMatch" value="${state.perMatchdayPrice}">
                </div>
              </div>
              <div class="field">
                <label style="display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" id="lChargePlayed" ${state.chargeEvenIfNotPlayed ? 'checked' : ''}>
                  Cobrar por jornada incluso si el jugador NO juega.
                </label>
              </div>
            </div>
          `;
        }
        else if (state.step === 3) {
          body.innerHTML = `
            <div class="card">
              <div class="card-header"><div class="card-title">PASO 3: CLÁUSULAS DE RENDIMIENTO</div></div>
              <label style="display:flex; align-items:center; gap:8px; margin-bottom:16px; font-weight:600;">
                <input type="checkbox" id="lPerfEnabled" ${state.perfEnabled ? 'checked' : ''}> Activar cláusula de rendimiento
              </label>
              <div style="opacity: ${state.perfEnabled ? 1 : 0.4}; pointer-events: ${state.perfEnabled ? 'auto' : 'none'};">
                <div class="row-3">
                  <label><input type="checkbox" id="lPg" ${state.perfTargets.gamesPlayed ? 'checked' : ''}> Partidos Jugados</label>
                  <label><input type="checkbox" id="lPgoals" ${state.perfTargets.goals ? 'checked' : ''}> Goles</label>
                  <label><input type="checkbox" id="lPassists" ${state.perfTargets.assists ? 'checked' : ''}> Asistencias</label>
                  <label><input type="checkbox" id="lPsaves" ${state.perfTargets.saves ? 'checked' : ''}> Salvadas</label>
                  <label><input type="checkbox" id="lPeff" ${state.perfTargets.efficiency ? 'checked' : ''}> Eficiencia (%)</label>
                </div>
                <div class="row-3" style="margin-top:10px;">
                  <input class="input" type="number" id="lPgVal" value="${state.perfTargets.gamesPlayedMin || 0}" placeholder="PJ Mín">
                  <input class="input" type="number" id="lPgoalsVal" value="${state.perfTargets.goalsMin || 0}" placeholder="Goles Mín">
                  <input class="input" type="number" id="lPassistsVal" value="${state.perfTargets.assistsMin || 0}" placeholder="Asist Mín">
                  <input class="input" type="number" id="lPsavesVal" value="${state.perfTargets.savesMin || 0}" placeholder="Salv Mín">
                  <input class="input" type="number" id="lPeffVal" value="${state.perfTargets.efficiencyMin || 0}" placeholder="Efic %">
                </div>
              </div>
            </div>
          `;
        }
        else if (state.step === 4) {
          body.innerHTML = `
            <div class="card" style="border-left:4px solid var(--success)">
              <div class="card-header"><div class="card-title">PASO 4: CONFIRMACIÓN</div></div>
              <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
                <div><b>Jugador:</b> ${player.name}</div>
                <div><b>Equipo Dueño:</b> ${currentTeam.name}</div>
                <div><b>Duración:</b> ${state.durationMatchdays} jornadas</div>
                <div><b>Cláusulas Financieras:</b> ${state.uniquePrice > 0 ? `$${formatMoney(state.uniquePrice)} único` : ''} ${state.perMatchdayPrice > 0 ? `+ $${formatMoney(state.perMatchdayPrice)}/jornada` : ''}</div>
              </div>
            </div>
          `;
        }
      }

      function saveState() {
        if (state.step === 1) {
          state.durationMatchdays = parseInt(body.querySelector('#lDuration')?.value) || 5;
        } else if (state.step === 2) {
          state.uniquePrice = parseInt(body.querySelector('#lUnique')?.value) || 0;
          state.perMatchdayPrice = parseInt(body.querySelector('#lPerMatch')?.value) || 0;
          state.chargeEvenIfNotPlayed = body.querySelector('#lChargePlayed')?.checked;
        } else if (state.step === 3) {
          state.perfEnabled = body.querySelector('#lPerfEnabled')?.checked;
          if (state.perfEnabled) {
            state.perfTargets = {
              gamesPlayed: { enabled: body.querySelector('#lPg').checked, min: parseInt(body.querySelector('#lPgVal').value) || 0 },
              goals: { enabled: body.querySelector('#lPgoals').checked, min: parseInt(body.querySelector('#lPgoalsVal').value) || 0 },
              assists: { enabled: body.querySelector('#lPassists').checked, min: parseInt(body.querySelector('#lPassistsVal').value) || 0 },
              saves: { enabled: body.querySelector('#lPsaves').checked, min: parseInt(body.querySelector('#lPsavesVal').value) || 0 },
              efficiency: { enabled: body.querySelector('#lPeff').checked, min: parseInt(body.querySelector('#lPeffVal').value) || 0 }
            };
          }
        }
      }

      btnNext.addEventListener('click', async () => {
        saveState();
        
        if (state.step < 4) {
          state.step++;
          render();
        } else {
          try {
            btnNext.disabled = true; btnNext.textContent = 'ENVIANDO...';
            
            const payload = {
              playerId: player.id,
              playerName: player.name,
              from_team_id: session.activeTeamId,
              durationMatchdays: state.durationMatchdays,
              uniquePrice: state.uniquePrice,
              perMatchdayPrice: state.perMatchdayPrice,
              chargeEvenIfNotPlayed: state.chargeEvenIfNotPlayed,
              performanceEnabled: state.perfEnabled,
              performanceTargets: state.perfTargets
            };
            
            await createCoachRequest(session.token, 'loan_request', currentTeam.id, payload);
            toast('✅ Oferta de préstamo enviada', 'success');
            closeTopModal();
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } catch (e) {
            toast('Error: ' + e.message, 'error');
            btnNext.disabled = false; btnNext.textContent = 'ENVIAR OFERTA';
          }
        }
      });

      btnPrev.addEventListener('click', () => {
        saveState();
        state.step--;
        render();
      });

      body.addEventListener('change', (e) => {
        if(e.target.id === 'lPerfEnabled') {
          state.perfEnabled = e.target.checked;
          render(); 
        }
      });

      render();
    }
  });
}
