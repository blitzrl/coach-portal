// Lógica de autenticación del Portal de Coaches

const _client = window.supabase.createClient(window.ZENITH_CONFIG.SUPABASE_URL, window.ZENITH_CONFIG.SUPABASE_ANON_KEY);

export const CoachAuth = {
  // Hace login llamando a la RPC segura
  async login(username, password) {
    const { data, error } = await _client.rpc('coach_login', {
      p_username: username,
      p_password: password
    });
    
    if (error) {
      console.error('[CoachAuth] RPC Error:', error);
      throw new Error('Error de conexión al servidor.');
    }
    return data; // Retorna { ok: true, token, coach } o { ok: false, error }
  },

  // Valida la sesión actual y la extiende
  async validateSession() {
    const token = sessionStorage.getItem('zenith_coach_token');
    if (!token) return { ok: false, error: 'No hay sesión' };

    const { data, error } = await _client.rpc('coach_validate_session', {
      p_token: token
    });
    
    if (error || !data.ok) {
      return { ok: false, error: error?.message || data?.error || 'Sesión expirada' };
    }
    return data; // Retorna { ok: true, coachId, teamId }
  },

  // Cierra sesión
  async logout() {
    const token = sessionStorage.getItem('zenith_coach_token');
    if (token) {
      await _client.rpc('coach_logout', { p_token: token });
    }
    sessionStorage.removeItem('zenith_coach_token');
    sessionStorage.removeItem('zenith_coach_data');
    window.location.href = 'index.html';
  },

  // Helpers
  getToken() { return sessionStorage.getItem('zenith_coach_token'); },
  getCoachData() { 
    const data = sessionStorage.getItem('zenith_coach_data');
    return data ? JSON.parse(data) : null; 
  }
};