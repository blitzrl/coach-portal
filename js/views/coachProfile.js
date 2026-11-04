import { openModal, toast } from '../services/ui.js?v=62';
import { getNationFlag } from '../data/nations.js?v=62';

export function showCoachSelfProfile(coach, DB) {
  if (!coach) return;

  const teamNames = (coach.teamIds || []).map(id => DB.teams.find(t => t.id === id)?.name).filter(Boolean).join(', ') || 'Agente Libre';
  const flag = coach.nationalityCode ? getNationFlag(coach.nationalityCode) : '';
  // 🔥 SPRINT 2: Detectar si tiene grupo activo
  const hasGroup = coach.orgName && (coach.teamIds || []).length > 1;

  const socialsList = [];
  if (coach.socials?.twitter) socialsList.push({ icon: 'fa-brands fa-twitter', url: coach.socials.twitter, label: 'Twitter' });
  if (coach.socials?.twitch) socialsList.push({ icon: 'fa-brands fa-twitch', url: coach.socials.twitch, label: 'Twitch' });
  if (coach.socials?.youtube) socialsList.push({ icon: 'fa-brands fa-youtube', url: coach.socials.youtube, label: 'YouTube' });
  if (coach.socials?.instagram) socialsList.push({ icon: 'fa-brands fa-instagram', url: coach.socials.instagram, label: 'Instagram' });

  openModal({
    id: 'coach-self-profile',
    title: 'MI PERFIL DE COACH',
    body: `
      <div style="display:flex; gap:20px; align-items:center; margin-bottom:20px; flex-wrap:wrap;">
        <div class="team-logo-box-xl" style="border-radius:50%">
          ${coach.profilePicture ? `<img src="${coach.profilePicture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '👤'}
        </div>
        <div style="min-width:0; flex:1;">
          <h2 style="font-family:var(--font-display); font-size:24px; color:var(--silver-light); margin:0; word-break:break-word;">${esc(coach.name)} ${flag}</h2>
          <div style="color:var(--accent); font-weight:600; margin-top:4px">${coach.roleType === 'coach' ? 'Head Coach' : 'Asistente'}</div>
          ${hasGroup ? `<div style="color:var(--gold); font-size:13px; margin-top:6px; font-weight:600; word-break:break-word;">👥 ${esc(coach.orgName)}</div>` : ''}
          <div style="color:var(--muted); font-size:12px; margin-top:4px; word-break:break-word;">${teamNames}</div>
        </div>
      </div>
      
      <div class="divider"></div>

      <!-- 🔥 SPRINT 2: Lista visual de equipos -->
      <div class="section-minihead">MIS EQUIPOS (${(coach.teamIds || []).length})</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
        ${(coach.teamIds || []).map(id => {
          const t = DB.teams.find(x => x.id === id);
          if (!t) return '';
          return `<div class="chip chip-accent" style="font-size:11px; padding:4px 10px;">${esc(t.name)}</div>`;
        }).join('') || '<div style="color:var(--muted); font-size:12px;">Sin equipos asignados</div>'}
      </div>
      
      <div class="divider"></div>
      
      <div class="section-minihead">CONTACTO Y REDES</div>
      
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        ${coach.rlTracker ? `<a href="${coach.rlTracker}" target="_blank" class="btn btn-sm" style="color:var(--accent); border-color:var(--accent)">RL Tracker ↗</a>` : ''}
        
        ${coach.discordId ? `
          <button class="btn btn-sm" id="copyCoachDiscordBtn" data-id="${coach.discordId}" style="cursor:pointer; border-color:rgba(88, 101, 242, 0.4); color:#5865F2; background:rgba(88, 101, 242, 0.1); display:flex; gap:6px; align-items:center; max-width:100%;" title="Copiar ID de Discord">
            <i class="fa-brands fa-discord"></i> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(coach.discordId)}</span> <i class="fa-regular fa-copy" style="margin-left:4px; opacity:0.7;"></i>
          </button>
        ` : ''}

        ${socialsList.map(s => `
          <a href="${s.url}" target="_blank" class="btn btn-sm"><i class="${s.icon}"></i> ${s.label}</a>
        `).join('')}
      </div>
    `,
    footer: `<button class="btn btn-ghost" data-close>CERRAR</button>`,
    onMount: (root) => {
      root.querySelector('#copyCoachDiscordBtn')?.addEventListener('click', (e) => {
        const discordId = e.currentTarget.dataset.id;
        if (!discordId) return;
        navigator.clipboard.writeText(discordId).then(() => {
          toast('✅ ID de Discord copiado', 'success');
        }).catch(err => {
          console.error('Error al copiar:', err);
          toast('No se pudo copiar el ID', 'error');
        });
      });
    }
  });
}

function esc(str){
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
