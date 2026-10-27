import { CoachAuth } from './auth.js';
import { loadPortalDB, subscribeToChanges, getSupabase } from './services/supabase.js?v=46'; 
import { renderDashboardView, bindDashboardEvents } from './views/dashboard.js?v=46';
import { renderMarketView, bindMarketEvents } from './views/market.js?v=46';
import { renderInboxView, bindInboxEvents } from './views/inbox.js?v=46';
import { renderEconomyView } from './views/economy.js?v=46';

let DB = null;
let currentSession = null;
let _currentView = 'dashboard';
let _sessionCheckInterval = null;

// 🔥 EXPONEMOS LA FUNCIÓN DE RECARGA PARA QUE ALIGNMENT.JS PUEDA USARLA
window.refreshPortalView = () => {
  if (_currentView) renderView(_currentView);
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await CoachAuth.validateSession();
    if (!session.ok) {
      sessionStorage.clear();
      window.location.href = 'index.html';
      return;
    }
    currentSession = session;
    DB = await loadPortalDB();

    try {
      const sb = getSupabase();
      await sb.from('coach_requests').update({ status: 'completed' }).in('status', ['approved_by_admin', 'accepted_by_target']);
    } catch (cleanupErr) { console.warn('Error en limpieza:', cleanupErr); }

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';

    updateHeader();
    initRouter();

    _sessionCheckInterval = setInterval(async () => {
      const check = await CoachAuth.validateSession();
      if (!check.ok) {
        clearInterval(_sessionCheckInterval);
        alert('Tu sesión ha expirado.');
        CoachAuth.logout();
      }
    }, 30000);

    subscribeToChanges(async () => {
      try {
        DB = await loadPortalDB();
        updateHeader();
        updateBadge();
        if (_currentView === 'dashboard') {
          const content = document.getElementById('viewContent');
          content.innerHTML = renderDashboardView(DB, currentSession);
          bindDashboardEvents(DB, currentSession);
        } else if (_currentView === 'market') {
          const content = document.getElementById('viewContent');
          content.innerHTML = renderMarketView(DB, currentSession);
          bindMarketEvents(DB, currentSession);
        } else if (_currentView === 'inbox') {
          const content = document.getElementById('viewContent');
          content.innerHTML = renderInboxView(DB, currentSession);
          bindInboxEvents(DB, currentSession);
        } else if (_currentView === 'economy') {
          const content = document.getElementById('viewContent');
          content.innerHTML = renderEconomyView(DB, currentSession);
        }
      } catch (e) { console.warn('Error en realtime:', e); }
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
      clearInterval(_sessionCheckInterval);
      CoachAuth.logout();
    });
  } catch (err) { alert('Error crítico: ' + err.message); }
});

function updateHeader() {
  const team = DB.teams.find(t => t.id === currentSession.teamId);
  const coach = DB.coaches.find(c => c.id === currentSession.coachId);
  if (document.getElementById('headerTeamName')) document.getElementById('headerTeamName').textContent = team ? team.name : 'Mi Equipo';
  if (document.getElementById('headerCoachName')) document.getElementById('headerCoachName').textContent = coach ? coach.name : 'Coach';
}

function updateBadge() {
  const badge = document.getElementById('inboxBadge');
  if (!badge) return;
  const unread = DB.notifications.filter(n => n.coach_id === currentSession.coachId && !n.read_at && !n.archived_at).length;
  const pending = DB.requests.filter(r => r.to_coach_id === currentSession.coachId && r.status === 'pending' && r.type !== 'contract_sign').length; // Ignoramos contract_sign
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
  }
}