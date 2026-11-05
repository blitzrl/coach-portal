// Lógica de autenticación del Portal de Coaches
import { getSupabase } from './services/supabase.js?v=65';

export const CoachAuth = {
  async login(username, password) {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('coach_login', {
      p_username: username,
      p_password: password
    });
    
    if (error) {
      console.error('[CoachAuth] RPC Error:', error);
      throw new Error('Error de conexión al servidor.');
    }
    return data; 
  },

  async validateSession() {
    const token = sessionStorage.getItem('zenith_coach_token');
    if (!token) return { ok: false, error: 'No hay sesión' };

    const sb = getSupabase();
    const { data, error } = await sb.rpc('coach_validate_session', {
      p_token: token
    });
    
    if (error || !data.ok) {
      return { ok: false, error: error?.message || data?.error || 'Sesión expirada' };
    }

    // 🔥 FIX 1: Normalizar teamIds
    let teamIds = [];
    if (Array.isArray(data.teamIds)) {
      teamIds = data.teamIds;
    } else if (data.teamIds) {
      try { teamIds = JSON.parse(data.teamIds); } catch(e) { teamIds = []; }
    } else if (data.teamId) {
      teamIds = [data.teamId];
    }

    const orgName = data.orgName || '';
    const coachName = data.name || JSON.parse(sessionStorage.getItem('zenith_coach_data') || '{}').name || 'Coach';
    
    // 🔥 FIX 2: CRUCIAL - Devolver el token en el objeto para que app.js lo use en los fichajes
    return { ...data, name: coachName, token, teamIds, orgName };
  },

  async logout() {
    const token = sessionStorage.getItem('zenith_coach_token');
    if (token) {
      const sb = getSupabase();
      await sb.rpc('coach_logout', { p_token: token });
    }
    
    const remember = localStorage.getItem('zenith_remember_team') === 'true';
    
    sessionStorage.removeItem('zenith_coach_token');
    sessionStorage.removeItem('zenith_coach_data');
    sessionStorage.removeItem('zenith_active_team');
    
    if (!remember) {
      localStorage.removeItem('zenith_active_team');
    }
    
    window.location.href = 'index.html';
  },

  getToken() { return sessionStorage.getItem('zenith_coach_token'); },
  getCoachData() { 
    const data = sessionStorage.getItem('zenith_coach_data');
    return data ? JSON.parse(data) : null; 
  }
};
