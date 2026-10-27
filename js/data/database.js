// ============================================================
// ZENITH VIEWER — Database defaults
// Solo widgets, tipos, zonas y economía por defecto
// ============================================================

export const DEFAULT_ZONES = {
  hasTop1Highlight: true,
  zones: [
    { from:1,  to:1,  type:'champion',   color:'#E6C476' },
    { from:2,  to:4,  type:'playoff',    color:'#4ade80' },
    { from:5,  to:6,  type:'playin',     color:'#6FA8FF' },
    { from:7,  to:8,  type:'promotion',  color:'#facc15' },
    { from:9,  to:10, type:'relegation', color:'#f87171' }
  ]
};

export const ECONOMY_DEFAULTS = {
  enabled: true,
  allowDebt: true,
  pigMultiplier: 1000,
  pigAllowNegative: true,
  pigNegativeFloor: -25,
  missedShotsPenalty: 0.5,
  basePriceByRank: {
    'Bronze':         { 1: 3000,  2: 5000,  3: 8000 },
    'Silver':         { 1: 10000, 2: 13000, 3: 16000 },
    'Gold':           { 1: 18000, 2: 21000, 3: 24000 },
    'Platinum':       { 1: 25000, 2: 28000, 3: 31000 },
    'Diamond':        { 1: 22000, 2: 25000, 3: 28000 },
    'Champion':       { 1: 35000, 2: 38000, 3: 42000 },
    'Grand Champion': { 1: 45000, 2: 50000, 3: 55000 },
    'SSL':            { 1: 65000, 2: 65000, 3: 65000 }
  },
  bonuses: {
    winSimple:     { amount: 5000,  label: 'Victoria simple' },
    winHard:       { amount: 8000,  label: 'Victoria complicada' },
    winHumiliating:{ amount: 12000, label: 'Victoria humillante' },
    qualifyPlayoffs: { amount: 15000, label: 'Clasificar a Play-Offs' },
    passRound:       { amount: 10000, label: 'Pasar de ronda (Playoffs)' },
    winLeague:       { amount: 50000, label: 'Ganar la liga' },
    promote:         { amount: 30000, label: 'Ascenso de división' },
    thresholds: {
      BO3: { simpleMargin: 2, humiliatingGoalDiff: 4, humiliatingShutout: 2 },
      BO5: { simpleMargin: 3, humiliatingGoalDiff: 5, humiliatingShutout: 3 },
      BO7: { simpleMargin: 4, humiliatingGoalDiff: 6, humiliatingShutout: 4 }
    }
  },
  sanctions: {
    reasons: [
      { id: 'no_show', label: 'No presentarse a partido', defaultAmount: 10000 },
      { id: 'toxic',   label: 'Conducta tóxica',          defaultAmount: 5000 },
      { id: 'late',    label: 'Impuntualidad',            defaultAmount: 2000 },
      { id: 'other',   label: 'Otro (especificar)',       defaultAmount: 0 }
    ]
  }
};

export function getDefaultWidgets(){
  return [
    { id:'upcoming',        instanceId:'upcoming_default',        name:'Próximo Partido',       enabled:true,  order:1,  span:2, rowSpan:1, config:{ itemIds:[], interval:5 } },
    { id:'standings',       instanceId:'standings_default',       name:'Tabla General',         enabled:true,  order:2,  span:1, rowSpan:1, config:{} },
    { id:'topPlayers',      instanceId:'topPlayers_default',      name:'Top Players',           enabled:true,  order:3,  span:1, rowSpan:1, config:{} },
    { id:'lastResult',      instanceId:'lastResult_default',      name:'Último Resultado',      enabled:true,  order:4,  span:1, rowSpan:1, config:{ itemIds:[], interval:5 } },
    { id:'nextMatchdays',   instanceId:'nextMatchdays_default',   name:'Próximas Jornadas',     enabled:true,  order:5,  span:1, rowSpan:1, config:{} },
    { id:'ballonDor',       instanceId:'ballonDor_default',       name:"Zenith Ballon d'Or",    enabled:true,  order:6,  span:1, rowSpan:1, config:{} },
    { id:'news',            instanceId:'news_default',            name:'Noticias',              enabled:true,  order:7,  span:3, rowSpan:1, config:{} },
    { id:'mvpCarousel',     instanceId:'mvpCarousel_default',     name:'MVP del Momento',       enabled:true,  order:8,  span:1, rowSpan:1, config:{} },
    { id:'topScorers',      instanceId:'topScorers_default',      name:'Máximos Goleadores',    enabled:true,  order:9,  span:1, rowSpan:1, config:{} },
    { id:'topAssists',      instanceId:'topAssists_default',      name:'Máximos Asistentes',    enabled:true,  order:10, span:1, rowSpan:1, config:{} },
    { id:'topSaves',        instanceId:'topSaves_default',        name:'Mejores Porteros',      enabled:true,  order:11, span:1, rowSpan:1, config:{} },
    { id:'topEfficiency',   instanceId:'topEfficiency_default',   name:'Mejor Eficiencia',      enabled:true,  order:12, span:1, rowSpan:1, config:{} },
    { id:'playerSpotlight', instanceId:'playerSpotlight_default', name:'Jugador Destacado',     enabled:true,  order:13, span:1, rowSpan:1, config:{} },
    { id:'playInUpcoming',  instanceId:'playInUpcoming_default',  name:'Próximo Play-In',       enabled:false, order:14, span:1, rowSpan:1, config:{ itemIds:[], interval:5 } },
    { id:'playoffUpcoming', instanceId:'playoffUpcoming_default', name:'Próximo Play-Off',      enabled:false, order:15, span:1, rowSpan:1, config:{ itemIds:[], interval:5 } },
    { id:'playoffBracket',  instanceId:'playoffBracket_default',  name:'Llave Play-Offs',       enabled:false, order:16, span:2, rowSpan:1, config:{} }
  ];
}

export const WIDGET_TYPES = [
  { id:'upcoming',        label:'Próximo Partido',       configurable:false },
  { id:'standings',       label:'Tabla General',         configurable:false },
  { id:'topPlayers',      label:'Top Players',           configurable:false },
  { id:'lastResult',      label:'Último Resultado',      configurable:false },
  { id:'nextMatchdays',   label:'Próximas Jornadas',     configurable:false },
  { id:'ballonDor',       label:"Zenith Ballon d'Or",    configurable:false },
  { id:'news',            label:'Noticias',              configurable:false },
  { id:'mvpCarousel',     label:'MVP del Momento',       configurable:false },
  { id:'topScorers',      label:'Máximos Goleadores',    configurable:false },
  { id:'topAssists',      label:'Máximos Asistentes',    configurable:false },
  { id:'topSaves',        label:'Mejores Porteros',      configurable:false },
  { id:'topEfficiency',   label:'Mejor Eficiencia',      configurable:false },
  { id:'playerSpotlight', label:'Jugador Destacado',     configurable:false },
  { id:'playInUpcoming',  label:'Próximo Play-In',       configurable:false },
  { id:'playoffUpcoming', label:'Próximo Play-Off',      configurable:false },
  { id:'playoffBracket',  label:'Llave Play-Offs',       configurable:false }
];

export function getWidgetType(id){
  return WIDGET_TYPES.find(w => w.id === id) || null;
}
