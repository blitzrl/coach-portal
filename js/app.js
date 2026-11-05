import { CoachAuth } from './auth.js?v=65';
import { loadPortalDB, subscribeToChanges, getSupabase } from './services/supabase.js?v=65'; 
import { renderDashboardView, bindDashboardEvents } from './views/dashboard.js?v=65';
import { renderMarketView, bindMarketEvents } from './views/market.js?v=65';
import { renderInboxView, bindInboxEvents } from './views/inbox.js?v=65';
import { renderEconomyView } from './views/economy.js?v=65';
import { showCoachSelfProfile } from './views/coachProfile.js?v=65';

let DB = null;
let currentSession = null;
let _currentView = 'dashboard';
let _sessionCheckInterval = null;

window.refreshPortalView = () => {
  if (_currentView) renderView(_currentView);
};

function persistActiveTeam(teamId, remember) {
  if (remember) {
    localStorage.setItem('zenith_active_team', teamId);
    sessionStorage.removeItem('zenith_active_team');
  } else {
    sessionStorage.setItem('zenith_active_team', teamId);
    localStorage.removeItem('zenith_active_team');
  }
}

function getMyTeams(coachName, fallbackTeamIds) {
  let myTeams = DB.teams.filter(t => t.coach === coachName || t.assistant === coachName);
  if (myTeams.length === 0 && fallbackTeamIds && fallbackTeamIds.length > 0) {
    myTeams = DB.teams.filter(t => fallbackTeamIds.includes(t.id));
  }
  return myTeams;
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await CoachAuth.validateSession();
    if (!session.ok) {
      sessionStorage.clear();
      window.location.href = 'index.html';
      return;
    }
    currentSession = session;
    
    // 🔥 FIX CRÍTICO: Garantizar que el token siempre esté presente en la sesión
    if (!currentSession.token) {
      currentSession.token = sessionStorage.getItem('zenith_coach_token');
    }

    DB = await loadPortalDB();

    const dbCoach = DB.coaches.find(c => c.id === currentSession.coachId);
    if (dbCoach) {
      if (!currentSession.teamIds || currentSession.teamIds.length === 0) {
        currentSession.teamIds = dbCoach.teamIds || [];
      }
      if (!currentSession.orgName) {
        currentSession.orgName = dbCoach.orgName || '';
      }
    }

    const remember = localStorage.getItem('zenith_remember_team') === 'true';
    const savedTeamId = remember 
      ? localStorage.getItem('zenith_active_team') 
      : sessionStorage.getItem('zenith_active_team');
    
    const hasMultipleTeams = currentSession.teamIds.length > 1;
    const isValidSaved = savedTeamId && currentSession.teamIds.includes(savedTeamId);

    try {
      const sb = getSupabase();
      await sb.from('coach_requests').update({ status: 'completed' }).in('status', ['approved_by_admin', 'accepted_by_target']);
    } catch (cleanupErr) { console.warn('Error en limpieza:', cleanupErr); }

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';

    setupHeaderEvents();

    if (hasMultipleTeams && !isValidSaved) {
      currentSession.activeTeamId = null;
      showTeamSelectionModal(() => {
        updateHeader();
        initRouter();
        subscribeRealtime();
        startSessionCheck();
      });
      return; 
    }

    currentSession.activeTeamId = isValidSaved ? savedTeamId : (currentSession.teamIds[0] || null);
    if (currentSession.activeTeamId) {
      persistActiveTeam(currentSession.activeTeamId, remember);
    }

    updateHeader();
    initRouter();
    subscribeRealtime();
    startSessionCheck();

  } catch (err) { 
    alert('Error crítico: ' + err.message); 
    console.error(err);
  }
});

function showTeamSelectionModal(onSelect) {
  const modal = document.getElementById('teamSelectionModal');
  const list = document.getElementById('teamSelectionList');
  const subtitleEl = document.getElementById('teamSelectionSubtitle');
  const remember = localStorage.getItem('zenith_remember_team') === 'true';

  if (currentSession.orgName && currentSession.teamIds.length > 1) {
    subtitleEl.innerHTML = `<strong style="color:var(--gold)">👥 ${esc(currentSession.orgName)}</strong><br>Tienes acceso a ${currentSession.teamIds.length} equipos. Elige con cuál deseas trabajar.`;
  } else {
    subtitleEl.innerHTML = `Tienes acceso a ${currentSession.teamIds.length} equipos. Elige con cuál deseas trabajar.`;
  }

  list.innerHTML = currentSession.teamIds.map(teamId => {
    const team = DB.teams.find(t => t.id === teamId);
    if (!team) return '';
    const division = team.divisionId ? (DB.divisions.find(d => d.id === team.divisionId)?.name || '') : 'Sin división';
    return `
      <button class="btn" data-team-select="${teamId}" style="justify-content:flex-start; gap:12px; padding:12px; text-align:left;">
        ${team.logo 
          ? `<img src="${team.logo}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;background:var(--bg-elev);padding:2px;flex-shrink:0;">` 
          : `<div style="width:32px;height:32px;border-radius:6px;background:var(--bg-elev);display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0;">◆</div>`}
        <div style="min-width:0;">
          <div style="font-weight:600; color:var(--silver-light); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(team.name)}</div>
          <div style="font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(division)}</div>
        </div>
      </button>
    `;
  }).join('');

  modal.style.display = 'flex';

  list.querySelectorAll('[data-team-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedId = btn.dataset.teamSelect;
      currentSession.activeTeamId = selectedId;
      persistActiveTeam(selectedId, remember);
      modal.style.display = 'none';
      onSelect();
    });
  });
}

function updateHeader() {
  const team = DB.teams.find(t => t.id === currentSession.activeTeamId);
  const coach = DB.coaches.find(c => c.id === currentSession.coachId);
  const hasMultiple = currentSession.teamIds && currentSession.teamIds.length > 1;

  const teamNameEl = document.getElementById('headerTeamName');
  if (teamNameEl) teamNameEl.textContent = team ? team.name : 'Selecciona un equipo';

  const orgNameEl = document.getElementById('headerOrgName');
  if (orgNameEl) {
    if (currentSession.orgName && hasMultiple) {
      orgNameEl.textContent = `👥 ${currentSession.orgName}`;
      orgNameEl.style.display = 'block';
    } else {
      orgNameEl.style.display = 'none';
    }
  }

  if (document.getElementById('headerCoachName')) {
    document.getElementById('headerCoachName').textContent = coach ? coach.name : currentSession.name;
  }

  const btnChange = document.getElementById('btnChangeTeam');
  if (btnChange) {
    btnChange.style.display = hasMultiple ? 'inline-flex' : 'none';
    const label = document.getElementById('btnChangeTeamLabel');
    if (label) label.textContent = currentSession.orgName || 'Cambiar';
  }
}

function setupHeaderEvents() {
  document.getElementById('btnChangeTeam')?.addEventListener('click', () => {
    if (currentSession.teamIds && currentSession.teamIds.length > 1) {
      showTeamSelectionModal(() => {
        updateHeader();
        renderView(_currentView); 
      });
    }
  });

  document.getElementById('headerCoachName')?.addEventListener('click', () => {
    const coach = DB.coaches.find(c => c.id === currentSession.coachId);
    if (coach) showCoachSelfProfile(coach, DB);
  });

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    clearInterval(_sessionCheckInterval);
    CoachAuth.logout();
  });
}

function updateBadge() {
  const badge = document.getElementById('inboxBadge');
  if (!badge) return;
  const unread = DB.notifications.filter(n => n.coach_id === currentSession.coachId && !n.read_at && !n.archived_at).length;
  const pending = DB.requests.filter(r => r.to_coach_id === currentSession.coachId && r.status === 'pending' && r.type !== 'contract_sign').length;
  const total = unread + pending;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function initRouter() {
  const navItems = document.querySelectorAll('.coach-nav-item');
  updateBadge();
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === _currentView) return;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      _currentView = view;
      renderView(view);
    });
  });
  renderView(_currentView);
}

function renderView(viewName) {
  const content = document.getElementById('viewContent');
  if (!content) return;
  try {
    if (viewName === 'dashboard') {
      content.innerHTML = renderDashboardView(DB, currentSession);
      bindDashboardEvents(DB, currentSession);
    } else if (viewName === 'market') {
      content.innerHTML = renderMarketView(DB, currentSession);
      bindMarketEvents(DB, currentSession);
    } else if (viewName === 'inbox') {
      content.innerHTML = renderInboxView(DB, currentSession);
      bindInboxEvents(DB, currentSession);
    } else if (viewName === 'economy') {
      content.innerHTML = renderEconomyView(DB, currentSession);
    }
  } catch (err) {
    content.innerHTML = `<div class="card" style="border-left:4px solid var(--danger)"><div class="card-title" style="color:var(--danger)">ERROR</div><div>${err.message}</div></div>`;
    console.error(err);
  }
}

function subscribeRealtime() {
  subscribeToChanges(async () => {
    try {
      DB = await loadPortalDB();
      updateHeader();
      updateBadge();
      renderView(_currentView);
    } catch (e) { console.warn('Error en realtime:', e); }
  });
}

function startSessionCheck() {
  _sessionCheckInterval = setInterval(async () => {
    const check = await CoachAuth.validateSession();
    if (!check.ok) {
      clearInterval(_sessionCheckInterval);
      alert('Tu sesión ha expirado.');
      CoachAuth.logout();
    }
  }, 30000);
}

function esc(str){
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
