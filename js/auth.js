// Lógica de autenticación del Portal de Coaches

const _client = window.supabase.createClient(window.ZENITH_CONFIG.SUPABASE_URL, window.ZENITH_CONFIG.SUPABASE_ANON_KEY);

export const CoachAuth = {
  async login(username, password) {
    const { data, error } = await _client.rpc('coach_login', {
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

    const { data, error } = await _client.rpc('coach_validate_session', {
      p_token: token
    });
    
    if (error || !data.ok) {
      return { ok: false, error: error?.message || data?.error || 'Sesión expirada' };
    }

    // 🔥 FIX: Recuperar el nombre del coach del sessionStorage por si el RPC no lo devuelve
    const savedData = sessionStorage.getItem('zenith_coach_data');
    const coachData = savedData ? JSON.parse(savedData) : {};
    const coachName = data.name || coachData.name || 'Coach';

    // 🔥 FIX: Asegurar que teamIds siempre sea un arreglo válido
    let teamIds = [];
    if (Array.isArray(data.teamIds)) {
      teamIds = data.teamIds;
    } else if (data.teamIds) {
      try { teamIds = JSON.parse(data.teamIds); } catch(e) { teamIds = []; }
    } else if (data.teamId) {
      teamIds = [data.teamId];
    }

    const orgName = data.orgName || '';
    
    return { ...data, name: coachName, teamIds, orgName };
  },

  async logout() {
    const token = sessionStorage.getItem('zenith_coach_token');
    if (token) {
      await _client.rpc('coach_logout', { p_token: token });
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
