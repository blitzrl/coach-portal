let _client = null;
let _channel = null;

export function getSupabase() {
  if (!_client) {
    const cfg = window.ZENITH_CONFIG || {};
    _client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  return _client;
}

function camel(s) { return s.replace(/_([a-z])/g, (_, l) => l.toUpperCase()); }

function mergeRow(row, columnMap = {}) {
  if (!row) return null;
  const result = {};
  Object.keys(row).forEach(key => {
    if (key === 'data' || key === 'created_at' || key === 'updated_at') return;
    const mapped = columnMap[key] || camel(key);
    result[mapped] = row[key];
  });
  if (row.data && typeof row.data === 'object') {
    Object.assign(result, row.data);
  }
  return result;
}

export async function loadRemoteDB() {
  const sb = getSupabase();
  const [seasons, divisions, teams, players, matches, playoffs, news, config, archived, coaches] = await Promise.all([
    sb.from('seasons').select('*'), sb.from('divisions').select('*'), sb.from('teams').select('*'),
    sb.from('players').select('*'), sb.from('matches').select('*'), sb.from('playoffs').select('*'),
    sb.from('news').select('*'), sb.from('config').select('*').maybeSingle(),
    sb.from('archived_seasons').select('*'), sb.from('coaches').select('*')
  ]);
  const errors = [seasons, divisions, teams, players, matches, playoffs, news, config, archived, coaches].map(r => r.error).filter(Boolean);
  if (errors.length) throw new Error('Error Supabase: ' + errors[0].message);
  const configData = config?.data?.data || {};
  return {
    meta: { version: 3, updatedAt: new Date().toISOString() },
    seasons: (seasons.data || []).map(r => ({ id: r.id, name: r.name, year: r.year, active: r.active })),
    divisions: (divisions.data || []).map(r => ({ id: r.id, seasonId: r.season_id, name: r.name, tier: r.tier, visible: r.visible, config: r.data?.config || {} })),
    teams: (teams.data || []).map(r => ({ id: r.id, divisionId: r.division_id, seasonId: r.season_id, name: r.name, logo: r.data?.logo || '', coach: r.data?.coach || '', assistant: r.data?.assistant || '', roster: r.data?.roster || [], money: r.data?.money || 0 })),
    players: (players.data || []).map(r => ({ id: r.id, divisionId: r.division_id, name: r.name, profilePicture: r.data?.profilePicture || '', nationalityCode: r.data?.nationalityCode || '', rank: r.data?.rank || '', rankLevel: r.data?.rankLevel ?? 2, rankDivision: r.data?.rankDivision || 'II', marketValue: r.data?.marketValue || null, status: r.data?.status || 'owned', onLoan: r.data?.onLoan || false, ownerTeamId: r.data?.ownerTeamId || null, contractId: r.data?.contractId || null })),
    matches: (matches.data || []).map(r => mergeRow(r)),
    playoffs: (playoffs.data || []).map(r => ({ divisionId: r.division_id, seasonId: r.season_id, status: r.data?.status || 'pending', bracket: r.data?.bracket || null, championId: r.data?.championId || null })),
    news: (news.data || []).map(r => ({ id: r.id, date: r.date, published: r.published, pinned: r.pinned, title: r.data?.title || '', body: r.data?.body || '', category: r.data?.category || 'GENERAL', customCategory: r.data?.customCategory || '', banner: r.data?.banner || '', featured: !!r.data?.featured, goldenFrame: !!r.data?.goldenFrame, blocks: r.data?.blocks || [] })),
    archivedSeasons: (archived.data || []).map(r => ({ id: r.id, name: r.name, year: r.year, archivedAt: r.archived_at, championByDivision: r.data?.championByDivision || {}, movements: r.data?.movements || [], snapshot: r.data?.snapshot || null })),
    coaches: (coaches.data || []).map(r => ({ id: r.id, name: r.name, teamId: r.team_id, profilePicture: r.data?.profilePicture || '', roleType: r.data?.roleType || 'coach' })),
    config: configData, widgets: configData.widgets || null, trophies: configData.trophies || {}, transferLog: configData.transferLog || [], transferBannerBg: configData.transferBannerBg || '', economyLedger: configData.economyLedger || [], contracts: configData.contracts || [], viewSeasonId: null
  };
}

export async function loadPortalDB() {
  const sb = getSupabase();
  
  const [configRes, seasonsRes, divisionsRes, playersRes, teamsRes, coachesRes, matchesRes, newsRes, reqsRes, notifsRes, contractsRes] = await Promise.all([
    sb.from('config').select('*').maybeSingle(),
    sb.from('seasons').select('*'),
    sb.from('divisions').select('*'),
    sb.from('players').select('*'),
    sb.from('teams').select('*'),
    sb.from('coaches').select('*'),
    sb.from('matches').select('*'),
    sb.from('news').select('*'),
    sb.from('coach_requests').select('*').in('status', ['pending', 'accepted_by_target', 'processing']).order('created_at', { ascending: false }),
    sb.from('coach_notifications').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('coach_contracts').select('*')
  ]);
  
  if (configRes.error) throw new Error('Error cargando config: ' + configRes.error.message);
  const cfgData = configRes.data?.data || {};

  const contracts = (contractsRes?.data || []).map(r => ({
    id: r.id,
    playerId: r.player_id,
    teamId: r.team_id,
    type: r.type,
    status: r.status,
    durationSeasons: r.duration_seasons,
    durationMatchdays: r.duration_matchdays,
    startSeasonId: r.start_season_id,
    endSeasonId: r.end_season_id,
    endMatchday: r.end_matchday,
    transferPrice: r.data?.transferPrice || 0,
    clauses: r.data?.clauses || {},
    history: r.data?.history || []
  }));
  
  return {
    config: cfgData, 
    seasons: (seasonsRes.data || []).map(r => ({ id: r.id, name: r.name, year: r.year, active: r.active })),
    // 🔥 FIX: Añadido r.data?.config || {} para los colores de la tabla
    divisions: (divisionsRes.data || []).map(r => ({ id: r.id, seasonId: r.season_id, name: r.name, tier: r.tier, visible: r.visible, config: r.data?.config || {} })),
    teams: (teamsRes.data || []).map(r => ({ id: r.id, divisionId: r.division_id, seasonId: r.season_id, name: r.name, logo: r.data?.logo || '', coach: r.data?.coach || '', assistant: r.data?.assistant || '', roster: r.data?.roster || [], money: r.data?.money || 0 })),
    players: (playersRes.data || []).map(r => ({ id: r.id, divisionId: r.division_id, name: r.name, profilePicture: r.data?.profilePicture || '', nationalityCode: r.data?.nationalityCode || '', rank: r.data?.rank || '', rankLevel: r.data?.rankLevel ?? 2, rankDivision: r.data?.rankDivision || 'II', marketValue: r.data?.marketValue || null, status: r.data?.status || 'owned', onLoan: r.data?.onLoan || false, ownerTeamId: r.data?.ownerTeamId || null, contractId: r.data?.contractId || null })),
    coaches: (coachesRes.data || []).map(r => ({ id: r.id, name: r.name, teamId: r.team_id, profilePicture: r.data?.profilePicture || '', roleType: r.data?.roleType || 'coach' })),
    matches: (matchesRes.data || []).map(r => mergeRow(r)),
    news: newsRes.data || [], 
    requests: reqsRes.data || [], 
    notifications: notifsRes.data || [],
    contracts: contracts,
    transferLog: cfgData.transferLog || [],
    economyLedger: cfgData.economyLedger || []
  };
}

export async function createCoachRequest(token, type, toTeamId, payload) {
  const sb = getSupabase();
  if (type === 'transfer' && toTeamId === null) {
    const { data, error } = await sb.rpc('coach_sign_free_agent', { p_token: token, p_player_id: payload.playerId, p_team_id: payload.targetTeamId });
    if (error) throw new Error(error.message);
    if (!data.ok) throw new Error(data.error);
    return data;
  }
  if (type === 'staff_transfer') {
    const { data, error } = await sb.rpc('coach_sign_staff', { p_token: token, p_coach_id: payload.coachId });
    if (error) throw new Error(error.message);
    if (!data.ok) throw new Error(data.error);
    return data;
  }
  const { data, error } = await sb.rpc('coach_create_request', { p_payload: payload, p_to_team_id: toTeamId, p_type: type });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export async function updateLineup(token, teamId, roster) {
  const { data, error } = await getSupabase().rpc('coach_update_lineup', { p_token: token, p_team_id: teamId, p_roster: roster });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export async function cancelCoachRequest(token, requestId) {
  const { data, error } = await getSupabase().rpc('coach_cancel_request', { p_token: token, p_request_id: requestId });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export async function respondPortalRequest(token, action, requestId) {
  const { data, error } = await getSupabase().rpc('portal_respond_request', { p_token: token, p_action: action, p_request_id: requestId });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export async function markNotificationRead(token, notifId) {
  const { error } = await getSupabase().rpc('coach_mark_notification_read', { p_notif_id: notifId });
  if (error) throw new Error(error.message);
}

export async function archiveCoachNotifications(token, notifIds) {
  const { data, error } = await getSupabase().rpc('coach_archive_notifications', { p_token: token, p_notif_ids: notifIds });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export async function blockCoachNegotiation(token, blockedCoachId, durationHours) {
  const { data, error } = await getSupabase().rpc('coach_block_negotiation', { p_coach_id: token, p_blocked_coach_id: blockedCoachId, p_duration_hours: durationHours });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.error);
  return data;
}

export function subscribeToChanges(onChange) {
  const sb = getSupabase();
  if (_channel) sb.removeChannel(_channel);
  let timer = null;
  const trigger = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => onChange(), 500); };
  _channel = sb.channel('zenith-coach-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_requests' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_notifications' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_warnings' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_contracts' }, trigger)
    .subscribe((status) => console.log('[REALTIME COACH] Status:', status));
  return _channel;
}