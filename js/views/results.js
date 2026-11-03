import { respondPortalRequest, cancelCoachRequest, markNotificationRead, archiveCoachNotifications, getSupabase, loadPortalDB } from '../services/supabase.js?v=64';
import { toast, openModal, closeTopModal } from '../services/ui.js?v=64';
import { openSigningWizard } from './signingWizard.js?v=64';

function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US'); }

let _isArchiveMode = false;
let _selectedNotifs = new Set();
let _showHistory = false;

export function renderInboxView(DB, session) {
  const pendingRequests = DB.requests.filter(r => r.to_coach_id === session.coachId && r.status === 'pending' && r.type !== 'contract_sign');
  const myRequests = DB.requests.filter(r => r.from_coach_id === session.coachId && r.status === 'pending' && r.type !== 'contract_sign');
  
  const unreadNotifs = DB.notifications.filter(n => n.coach_id === session.coachId && !n.read_at && !n.archived_at);
  const readNotifs = DB.notifications.filter(n => n.coach_id === session.coachId && n.read_at && !n.archived_at);
  const archivedNotifs = DB.notifications.filter(n => n.coach_id === session.coachId && n.archived_at);

  return `
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div class="card-title">BANDEJA DE ENTRADA</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="card-sub">${unreadNotifs.length} nuevas</span>
          ${_isArchiveMode 
            ? `<button class="btn btn-sm btn-primary" id="btnExecuteArchive">📁 ARCHIVAR SELECCIONADAS</button>
               <button class="btn btn-sm btn-ghost" id="btnCancelArchive">CANCELAR</button>`
            : `<button class="btn btn-sm" id="btnArchiveMode">📁 ARCHIVAR</button>`
          }
        </div>
      </div>

      ${_isArchiveMode ? `<div class="ia-warning-item" style="margin-bottom:16px; background:rgba(111,168,255,.1); border-color:rgba(111,168,255,.3); color:var(--accent)">MODO ARCHIVO: Selecciona las notificaciones que deseas mover al historial.</div>` : ''}

      ${pendingRequests.length > 0 ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px; color:var(--accent); margin-bottom:12px; border-bottom:1px solid var(--border-soft); padding-bottom:6px;">OFERTAS RECIBIDAS</h3>
          ${pendingRequests.map(req => renderRequestCard(req, DB, session)).join('')}
        </div>
      ` : ''}

      ${myRequests.length > 0 ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px; color:var(--gold); margin-bottom:12px; border-bottom:1px solid var(--border-soft); padding-bottom:6px;">TUS OFERTAS ENVIADAS</h3>
          ${myRequests.map(req => renderMyRequestCard(req, DB)).join('')}
        </div>
      ` : ''}

      <div style="margin-bottom:24px;">
        <h3 style="font-size:14px; color:var(--gold); margin-bottom:12px; border-bottom:1px solid var(--border-soft); padding-bottom:6px;">NOTIFICACIONES NUEVAS</h3>
        ${unreadNotifs.map(n => renderNotifCard(n)).join('') || '<div style="color:var(--muted); font-size:12px; text-align:center; padding:10px;">No hay notificaciones nuevas.</div>'}
      </div>

      <div style="margin-bottom:24px;">
        <h3 style="font-size:14px; color:var(--muted); margin-bottom:12px; border-bottom:1px solid var(--border-soft); padding-bottom:6px;">LEÍDAS</h3>
        ${readNotifs.map(n => renderNotifCard(n)).join('') || '<div style="color:var(--muted); font-size:12px; text-align:center; padding:10px;">No hay notificaciones leídas.</div>'}
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-soft); padding-bottom:6px; margin-bottom:12px;">
          <h3 style="font-size:14px; color:var(--silver-light); margin:0;">HISTORIAL ANTIGUO (${archivedNotifs.length})</h3>
          <button class="btn btn-sm btn-ghost" id="btnToggleHistory" style="font-size:11px;">
            ${_showHistory ? '▲ OCULTAR' : '▼ DESPLEGAR'}
          </button>
        </div>
        <div id="historyContainer" style="display:${_showHistory ? 'block' : 'none'}; max-height: 400px; overflow-y: auto; padding-right: 4px;">
          ${archivedNotifs.map(n => renderNotifCard(n)).join('') || '<div style="color:var(--muted); font-size:12px; text-align:center; padding:10px;">El historial está vacío.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderRequestCard(req, DB, session) {
  const payload = req.payload || {};
  const player = DB.players.find(p => p.id === payload.playerId);
  const fromTeam = DB.teams.find(t => t.id === req.from_team_id);
  const coach = DB.coaches.find(c => c.id === req.from_coach_id);
  
  const isTransfer = req.type === 'transfer_offer';
  const isCounter = payload.is_counter_offer === true;
  
  let title = '📤 Solicitud de Préstamo';
  if (isTransfer) title = isCounter ? '🔄 Contraoferta' : '💰 Oferta de Fichaje';
  
  let clausesHTML = '';
  if (isTransfer) {
    if (payload.durationSeasons) clausesHTML += `<div><b>Vigencia:</b> ${payload.durationSeasons} Temp. ${payload.durationMatchdays ? `+ ${payload.durationMatchdays} Jorn.` : ''}</div>`;
    if (payload.uniquePrice > 0) clausesHTML += `<div><b>Precio:</b> $${formatMoney(payload.uniquePrice)}</div>`;
  } else {
    if (payload.durationMatchdays) clausesHTML += `<div><b>Duración:</b> ${payload.durationMatchdays} Jornadas</div>`;
    if (payload.perMatchdayPrice > 0) clausesHTML += `<div><b>Precio por Jornada:</b> $${formatMoney(payload.perMatchdayPrice)}</div>`;
    if (payload.uniquePrice > 0) clausesHTML += `<div><b>Pago Único:</b> $${formatMoney(payload.uniquePrice)}</div>`;
  }

  return `
    <div class="card" style="border-left:4px solid ${isCounter ? 'var(--danger)' : (isTransfer ? 'var(--gold)' : 'var(--accent)')}; margin-bottom:10px; background:${isCounter ? 'rgba(226,92,92,0.05)' : (isTransfer ? 'rgba(230,196,118,0.05)' : 'rgba(111,168,255,0.05)')}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="width:100%;">
          <div style="font-size:14px; font-weight:600; color:var(--silver-light); margin-bottom:4px;">
            ${title}: ${player ? player.name : 'Jugador'}
          </div>
          <div style="font-size:12px; color:var(--muted); margin-bottom:8px;">
            Enviada por: <b>${coach ? coach.name : '?'}</b> (${fromTeam ? fromTeam.name : '?'})
          </div>
          <div style="font-size:12px; color:var(--silver); background:var(--bg-deep); padding:8px; border-radius:6px; margin-bottom:8px;">
            ${clausesHTML}
          </div>
          ${payload.customMessage ? `<div style="font-size:12px; color:var(--accent); font-style:italic; padding:8px; border-left:2px solid var(--accent); background:rgba(111,168,255,0.05); margin-bottom:8px;">"${payload.customMessage}"</div>` : ''}
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-sm btn-primary" data-open-negotiation="${req.id}">VER DETALLE Y ACEPTAR</button>
            <button class="btn btn-sm btn-danger" data-reject-negotiation="${req.id}">RECHAZAR</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMyRequestCard(req, DB) {
  const payload = req.payload || {};
  const player = DB.players.find(p => p.id === payload.playerId);
  const toTeam = DB.teams.find(t => t.id === req.to_team_id);
  const isCounter = payload.is_counter_offer === true;
  
  return `
    <div class="card" style="border-left:4px solid var(--muted); margin-bottom:10px; background:var(--bg-elev)">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--silver-light);">
            ${isCounter ? '🔄 Contraoferta' : 'Oferta'} por ${player ? player.name : 'Jugador'}
          </div>
          <div style="font-size:11px; color:var(--muted);">Enviada a: ${toTeam ? toTeam.name : '?'}</div>
        </div>
        <button class="btn btn-sm btn-danger" data-cancel-offer="${req.id}">CANCELAR</button>
      </div>
    </div>
  `;
}

function renderNotifCard(n) {
  let icon = '📢'; let color = 'var(--accent)'; let borderColor = 'rgba(111,168,255,.3)'; let bg = 'var(--bg-elev)';
  let isUnread = !n.read_at && !n.archived_at;
  let isCriticalUnanswered = n.type === 'admin_warning' && n.title.includes('CRÍTICA') && !n.acknowledged_at && !n.read_at; 

  if (n.type === 'admin_warning') {
    if (n.title.includes('CRÍTICA')) { icon = '🔴'; color = 'var(--danger)'; borderColor = 'rgba(226,92,92,.5)'; bg = 'linear-gradient(90deg, rgba(226,92,92,0.1), var(--bg-panel))'; }
    else if (n.title.includes('ADVERTENCIA DEL')) { icon = '⚠️'; color = 'var(--gold)'; borderColor = 'rgba(230,196,118,.5)'; bg = 'linear-gradient(90deg, rgba(230,196,118,0.1), var(--bg-panel))'; }
    else { icon = 'ℹ️'; color = 'var(--accent)'; borderColor = 'rgba(111,168,255,.5)'; bg = 'linear-gradient(90deg, rgba(111,168,255,0.1), var(--bg-panel))'; }
  } else if (n.title.includes('Aceptad')) { icon = '✅'; color = 'var(--success)'; borderColor = 'rgba(99,194,138,.5)'; }
  else if (n.title.includes('Rechazad')) { icon = '❌'; color = 'var(--danger)'; borderColor = 'rgba(226,92,92,.5)'; }

  const isSelected = _selectedNotifs.has(n.id);
  let checkboxHTML = '';
  if (_isArchiveMode && !n.archived_at) {
    if (isCriticalUnanswered) checkboxHTML = `<input type="checkbox" disabled style="width:18px; height:18px; margin-top:4px; opacity:0.3;">`;
    else checkboxHTML = `<input type="checkbox" ${isSelected ? 'checked' : ''} style="width:18px; height:18px; margin-top:4px; pointer-events:none;">`;
  }

  return `
    <div class="card" id="notif-card-${n.id}" style="margin-bottom:10px; border-left:4px solid ${borderColor}; background:${bg}; opacity:${isUnread ? 1 : 0.7}; ${_isArchiveMode && !n.archived_at && !isCriticalUnanswered ? 'cursor:pointer;' : ''}"
         ${_isArchiveMode && !n.archived_at && !isCriticalUnanswered ? `onclick="window.toggleArchiveSelection('${n.id}')"` : ''}>
      <div style="display:flex; gap:16px; align-items:flex-start; justify-content:space-between;">
        <div style="display:flex; gap:16px; width: 100%;">
          ${checkboxHTML}
          <div style="font-size:24px; flex-shrink:0">${icon}</div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600; color:${color}; margin-bottom:4px;">${n.title}</div>
            <div style="font-size:13px; color:var(--silver-light); line-height:1.5; margin-bottom:8px;">${n.body}</div>
            <div style="font-size:11px; color:var(--muted);">${new Date(n.created_at).toLocaleString()}</div>
          </div>
        </div>
        ${!isUnread && !_isArchiveMode && !n.archived_at ? '' : (!_isArchiveMode && !n.archived_at ? `
          ${n.type === 'admin_warning' ? `<button class="btn btn-sm btn-primary" data-respond-warning="${n.id}" data-warning-id="${n.link_id}">RESPONDER</button>` : `<button class="btn btn-sm" data-read-notif="${n.id}">LEÍDO</button>`}
        ` : '')}
      </div>
    </div>
  `;
}

window.toggleArchiveSelection = function(id) {
  if (_selectedNotifs.has(id)) {
    _selectedNotifs.delete(id);
    const el = document.getElementById(`notif-card-${id}`);
    if (el) { el.style.outline = 'none'; el.querySelector('input[type="checkbox"]').checked = false; }
  } else {
    _selectedNotifs.add(id);
    const el = document.getElementById(`notif-card-${id}`);
    if (el) { el.style.outline = '2px solid var(--accent)'; el.querySelector('input[type="checkbox"]').checked = true; }
  }
};

async function refreshInboxOnTheFly(session) {
  try {
    const newDB = await loadPortalDB();
    const content = document.getElementById('viewContent');
    if (content) {
      content.innerHTML = renderInboxView(newDB, session);
      bindInboxEvents(newDB, session);
    }
  } catch (e) { toast('Error al refrescar', 'error'); }
}

export function bindInboxEvents(DB, session) {
  document.getElementById('btnArchiveMode')?.addEventListener('click', () => { _isArchiveMode = true; _selectedNotifs.clear(); refreshInboxOnTheFly(session); });
  document.getElementById('btnCancelArchive')?.addEventListener('click', () => { _isArchiveMode = false; _selectedNotifs.clear(); refreshInboxOnTheFly(session); });
  document.getElementById('btnToggleHistory')?.addEventListener('click', () => { _showHistory = !_showHistory; refreshInboxOnTheFly(session); });

  document.getElementById('btnExecuteArchive')?.addEventListener('click', async () => {
    if (_selectedNotifs.size === 0) {
      if (!confirm('¿No has seleccionado nada. ¿Quieres archivar TODAS las notificaciones leídas?')) return;
      const validToArchive = DB.notifications.filter(n => n.coach_id === session.coachId && !n.archived_at && n.read_at).map(n => n.id);
      if (validToArchive.length === 0) return toast('No hay notificaciones para archivar.', 'info');
      await executeArchive(session, validToArchive);
    } else {
      if (!confirm(`¿Mover las ${_selectedNotifs.size} notificaciones al historial?`)) return;
      await executeArchive(session, Array.from(_selectedNotifs));
    }
  });

  document.querySelectorAll('[data-open-negotiation]').forEach(btn => {
    btn.addEventListener('click', () => {
      const req = DB.requests.find(r => r.id === btn.dataset.openNegotiation);
      if (req) openNegotiationModal(req, DB, session);
    });
  });

  document.querySelectorAll('[data-reject-negotiation]').forEach(btn => {
    btn.addEventListener('click', () => openRejectModal(btn.dataset.rejectNegotiation, DB, session));
  });

  document.querySelectorAll('[data-cancel-offer]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Seguro que quieres cancelar esta oferta?')) return;
      try {
        btn.disabled = true; btn.textContent = '...';
        await cancelCoachRequest(session.token, btn.dataset.cancelOffer);
        toast('Oferta cancelada', 'success');
        refreshInboxOnTheFly(session);
      } catch (e) { toast('Error: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'CANCELAR'; }
    });
  });

  document.querySelectorAll('[data-read-notif]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { btn.disabled = true; btn.textContent = '...'; await markNotificationRead(session.token, btn.dataset.readNotif); refreshInboxOnTheFly(session); } catch (e) { toast('Error: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'LEÍDO'; }
    });
  });

  document.querySelectorAll('[data-respond-warning]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const notifId = btn.dataset.respondWarning;
      const warningId = btn.dataset.warningId;
      openModal({
        id: 'respond-warning-modal', title: 'RESPONDER ADVERTENCIA',
        body: `<p style="font-size:13px; color:var(--silver); margin-bottom:14px;">Escribe una respuesta para el administrador.</p><div class="field"><label>Tu respuesta</label><textarea class="textarea" id="warn-reply" rows="4"></textarea></div>`,
        footer: `<button class="btn btn-ghost" data-close>CANCELAR</button><button class="btn btn-primary" id="btnSendReply">ENVIAR</button>`,
        onMount: (root) => {
          root.querySelector('#btnSendReply').addEventListener('click', async () => {
            const msg = root.querySelector('#warn-reply').value.trim();
            if (!msg) return toast('Escribe una respuesta', 'error');
            try {
              const sb = getSupabase();
              const { error: err1 } = await sb.rpc('coach_ack_warning', { p_warning_id: warningId, p_message: msg });
              if (err1) throw err1;
              await markNotificationRead(session.token, notifId);
              toast('✅ Respuesta enviada', 'success'); closeTopModal(); refreshInboxOnTheFly(session);
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          });
        }
      });
    });
  });
}

function openNegotiationModal(req, DB, session) {
  const payload = req.payload || {};
  const player = DB.players.find(p => p.id === payload.playerId);
  const fromTeam = DB.teams.find(t => t.id === req.from_team_id);
  
  openModal({
    id: 'negotiation-modal-' + req.id,
    title: 'VER NEGOCIACIÓN',
    wide: true,
    body: `
      <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px;">
        <div class="team-logo-box-xl" style="border-radius:50%">
          ${player?.profilePicture ? `<img src="${player.profilePicture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '👤'}
        </div>
        <div>
          <h2 style="font-family:var(--font-display); font-size:24px; color:var(--silver-light); margin:0;">${player?.name}</h2>
          <div style="color:var(--accent); font-weight:600; margin-top:4px">De ${fromTeam?.name}</div>
        </div>
      </div>

      <div class="card" style="background:var(--bg-graphite); border:1px solid var(--border-soft); padding:16px; margin-bottom:16px;">
        <div style="font-size:14px; font-weight:600; color:var(--silver-light); margin-bottom:12px; border-bottom:1px solid var(--border-soft); padding-bottom:8px;">DETALLES DEL CONTRATO</div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
          ${payload.uniquePrice > 0 ? `<div><b>Precio:</b> $${formatMoney(payload.uniquePrice)}</div>` : ''}
        </div>
      </div>

      <div id="timerDisplay" style="display:none; text-align:center; font-size:24px; font-weight:700; color:var(--danger); margin-bottom:20px;">
        Ejecutando en: <span id="countdown">10</span>s
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" data-close>LEER LUEGO</button>
      <button class="btn btn-primary" id="btnCounterOffer">🔄 CONTRAOFERTAR</button>
      <button class="btn btn-danger" id="btnRejectNegotiation">RECHAZAR</button>
      <button class="btn btn-primary" id="btnAcceptNegotiation" style="background:var(--success); border-color:var(--success);">ACEPTAR OFERTA</button>
    `,
    onMount: (root) => {
      let timerInterval = null;
      let isSubmitting = false;

      root.querySelector('#btnRejectNegotiation').addEventListener('click', () => {
        if (timerInterval) clearInterval(timerInterval);
        closeTopModal();
        openRejectModal(req.id, DB, session);
      });

      root.querySelector('#btnCounterOffer').addEventListener('click', () => {
        if (timerInterval) clearInterval(timerInterval);
        closeTopModal();
        openSigningWizard(DB, session, player.id, !(req.type === 'transfer_offer'), payload, req.from_team_id);
      });

      const btnAccept = root.querySelector('#btnAcceptNegotiation');
      
      btnAccept.addEventListener('click', async () => {
        if (isSubmitting) return;

        if (btnAccept.dataset.state === 'ready') {
          isSubmitting = true;
          btnAccept.disabled = true; 
          btnAccept.textContent = 'EJECUTANDO...';
          try {
            await respondPortalRequest(session.token, 'accept', req.id);
            
            await getSupabase().from('coach_requests')
              .update({ 
                status: 'completed',
                admin_response_note: 'Procesado por el Portal - ' + req.type 
              })
              .eq('id', req.id);

            await getSupabase().from('config').update({ updated_at: new Date().toISOString() }).eq('id', 1);

            toast('✅ Transacción ejecutada correctamente', 'success');
            closeTopModal();
            refreshInboxOnTheFly(session);
          } catch (e) {
            toast('Error: ' + e.message, 'error');
            isSubmitting = false;
            btnAccept.disabled = false; 
            btnAccept.textContent = 'CONFIRMAR TRANSACCIÓN';
          }
          return;
        }

        btnAccept.disabled = true; 
        btnAccept.textContent = 'ESPERA...';
        btnAccept.dataset.state = 'waiting';
        
        root.querySelector('#timerDisplay').style.display = 'block';
        let timeLeft = 10;
        root.querySelector('#countdown').textContent = timeLeft;
        
        timerInterval = setInterval(() => {
          timeLeft--;
          root.querySelector('#countdown').textContent = timeLeft;
          
          if (timeLeft <= 0) {
            clearInterval(timerInterval);
            root.querySelector('#timerDisplay').style.display = 'none';
            
            btnAccept.disabled = false;
            btnAccept.dataset.state = 'ready';
            btnAccept.textContent = 'CONFIRMAR TRANSACCIÓN';
            btnAccept.style.background = 'var(--danger)';
            btnAccept.style.borderColor = 'var(--danger)';
          }
        }, 1000);
      });
    }
  });
}

function openRejectModal(reqId, DB, session) {
  openModal({
    id: 'reject-modal-' + reqId,
    title: 'RECHAZAR OFERTA',
    body: `<p style="font-size:13px; color:var(--silver); margin-bottom:16px;">¿Seguro que quieres rechazar esta oferta?</p>`,
    footer: `
      <button class="btn btn-ghost" data-close>CANCELAR</button>
      <button class="btn btn-danger" id="btnConfirmReject">RECHAZAR</button>
    `,
    onMount: (root) => {
      root.querySelector('#btnConfirmReject').addEventListener('click', async () => {
        try {
          await respondPortalRequest(session.token, 'reject', reqId);
          toast('Oferta rechazada', 'success');
          closeTopModal();
          refreshInboxOnTheFly(session);
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        }
      });
    }
  });
}

async function executeArchive(session, ids) {
  try {
    await archiveCoachNotifications(session.token, ids);
    toast('Notificaciones archivadas', 'success');
    _isArchiveMode = false;
    _selectedNotifs.clear();
    refreshInboxOnTheFly(session);
  } catch (e) { toast('Error al archivar: ' + e.message, 'error'); }
}
