// ============================================================
// THEME SERVICE — Aplica temas dinámicos al DOM (solo lectura)
// ============================================================

export const DEFAULT_THEME = {
  name: 'Zenith Default',
  brandName: 'ZENITH',
  brandMotto: 'YOUR LEVEL IS NOT YOUR LIMIT',
  logo: '',
  background: {
    type: 'gradient',
    solidColor: '#050505',
    gradientColors: ['#050505', '#0A0A0C', '#121316'],
    gradientAngle: 135
  },
  colors: {
    accent: '#6FA8FF',
    gold: '#E6C476',
    danger: '#E25C5C',
    success: '#63C28A'
  }
};

function deepMerge(defaults, overrides){
  if (!overrides) return JSON.parse(JSON.stringify(defaults));
  const result = JSON.parse(JSON.stringify(defaults));
  Object.keys(overrides).forEach(key => {
    const val = overrides[key];
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      result[key] = val.slice();
    } else if (typeof val === 'object') {
      result[key] = deepMerge(result[key] || {}, val);
    } else {
      result[key] = val;
    }
  });
  return result;
}

function buildBackground(theme){
  const bg = theme.background || DEFAULT_THEME.background;
  const accent = theme.colors?.accent || DEFAULT_THEME.colors.accent;
  const accentRgba = hexToRgba(accent, 0.05);
  const glow = `radial-gradient(1200px 600px at 80% -10%, ${accentRgba}, transparent 60%)`;

  if (bg.type === 'solid') {
    return `${glow}, ${bg.solidColor}`;
  }
  const colors = (bg.gradientColors && bg.gradientColors.length >= 2)
    ? bg.gradientColors
    : DEFAULT_THEME.background.gradientColors;
  const angle = (typeof bg.gradientAngle === 'number') ? bg.gradientAngle : 135;
  return `${glow}, linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

function hexToRgba(hex, alpha){
  if (!hex || typeof hex !== 'string') return `rgba(111,168,255,${alpha})`;
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(theme){
  const t = deepMerge(DEFAULT_THEME, theme || {});
  const root = document.documentElement;

  // 1. Colores como variables CSS
  root.style.setProperty('--accent', t.colors.accent);
  root.style.setProperty('--gold', t.colors.gold);
  root.style.setProperty('--danger', t.colors.danger);
  root.style.setProperty('--success', t.colors.success);

  // 2. Fondo (body + .app-shell)
  const bg = buildBackground(t);
  document.body.style.background = bg;
  document.querySelectorAll('.app-shell').forEach(el => {
    el.style.background = bg;
  });

  // 3. Branding — todos los elementos con id o clase del topbar
  const nameEl = document.getElementById('brandName');
  if (nameEl) nameEl.textContent = t.brandName || 'ZENITH';

  // También actualizar los .topbar-name del sidebar móvil
  document.querySelectorAll('.topbar-name').forEach(el => {
    if (el.id !== 'brandName') el.textContent = t.brandName || 'ZENITH';
  });

  const mottoEl = document.getElementById('brandMotto');
  if (mottoEl && t.brandMotto) mottoEl.textContent = t.brandMotto;

  // 4. Logo — swap entre custom y SVG default
  const logoEl = document.getElementById('brandLogo');
  const logoDefaultEl = document.getElementById('brandLogoDefault');
  if (logoEl && logoDefaultEl) {
    if (t.logo) {
      logoEl.src = t.logo;
      logoEl.style.display = '';
      logoDefaultEl.style.display = 'none';
    } else {
      logoEl.style.display = 'none';
      logoDefaultEl.style.display = '';
    }
  }

  // 5. Título de la pestaña del navegador
  if (t.brandName) {
    document.title = `${t.brandName} CHAMPIONSHIP`;
  }
}

export function resetTheme(){
  applyTheme(DEFAULT_THEME);
}

export function themePreviewBg(theme){
  if (!theme || !theme.background) return '#050505';
  if (theme.background.type === 'solid') return theme.background.solidColor;
  const colors = theme.background.gradientColors || [];
  if (colors.length < 2) return '#050505';
  const angle = theme.background.gradientAngle || 135;
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}