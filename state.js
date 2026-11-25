const STORAGE_KEY = 'padeltour_pro_v1';

if (typeof syncPlayoffsFromStandings !== 'function') {
  function syncPlayoffsFromStandings(category) {
    if (!category || !category.playoffs) return;
    category.playoffs.mode = category.playoffMode || category.playoffs.mode || 'top7';
  }
}

function createInitialData() {
  const players = [
    { id: 'p1', name: 'Martín Silva', side: 'Drive', hand: 'Diestro', racket: 'Bullpadel Hack 03', phone: '+56 9 8111 2233', social: '@martinsilva.padel', bio: 'Jugador constante desde el fondo con buen globo defensivo.', avatar: null, photos: [] },
    { id: 'p2', name: 'Sebastián Rojas', side: 'Revés', hand: 'Diestro', racket: 'Adidas Metalbone', phone: '+56 9 8222 3344', social: '@sebarojas', bio: 'Definición agresiva en volea y remate por tres.', avatar: null, photos: [] },
    { id: 'p3', name: 'Tomás Herrera', side: 'Drive', hand: 'Diestro', racket: 'Nox ML10 Pro Cup', phone: '+56 9 8333 4455', social: '@tomiherrera', bio: 'Lectura táctica del partido y control del ritmo.', avatar: null, photos: [] },
    { id: 'p4', name: 'Diego Morales', side: 'Revés', hand: 'Zurdo', racket: 'Head Delta Pro', phone: '+56 9 8444 5566', social: '@diegomorales_pdl', bio: 'Ángulo cruzado incómodo por ser zurdo y buena bajada de pared.', avatar: null, photos: [] },
    { id: 'p5', name: 'Lucas Fuentes', side: 'Drive', hand: 'Diestro', racket: 'Babolat Technical Viper', phone: '+56 9 8555 6677', social: '@lucasfuentes', bio: 'Rápido en transiciones defensa-ataque y salida de pared.', avatar: null, photos: [] },
    { id: 'p6', name: 'Matías Castro', side: 'Revés', hand: 'Diestro', racket: 'Siux Electra ST2', phone: '+56 9 8666 7788', social: '@maticastro', bio: 'Buen bloqueo en red y consistencia en rallies largos.', avatar: null, photos: [] },
    { id: 'p7', name: 'Nicolás Soto', side: 'Drive', hand: 'Diestro', racket: 'StarVie Triton', phone: '+56 9 8777 8899', social: '@nicosoto.padel', bio: 'Ordenado en pista y fuerte en bandeja profunda.', avatar: null, photos: [] },
    { id: 'p8', name: 'Felipe Espinoza', side: 'Revés', hand: 'Diestro', racket: 'Drop Shot Canyon Pro', phone: '+56 9 8888 9900', social: '@felipeespinoza', bio: 'Potencia en smash y presión constante en la malla.', avatar: null, photos: [] },
    { id: 'p9', name: 'Cristóbal Núñez', side: 'Drive', hand: 'Diestro', racket: 'Wilson Bela Pro', phone: '+56 9 7111 2233', social: '@crisnunez', bio: 'Seguridad en el drive y gran volumen de bolas devueltas.', avatar: null, photos: [] },
    { id: 'p10', name: 'Javier Paredes', side: 'Revés', hand: 'Diestro', racket: 'Kuikma PR990 Hybrid', phone: '+56 9 7222 3344', social: '@javiparedes', bio: 'Buena víbora y movilidad lateral.', avatar: null, photos: [] },
    { id: 'p11', name: 'Andrés Valdés', side: 'Drive', hand: 'Zurdo', racket: 'Dunlop Galactica', phone: '+56 9 7333 4455', social: '@andresvaldes', bio: 'Zurdo con buena mano para chiquitas y cambios de ritmo.', avatar: null, photos: [] },
    { id: 'p12', name: 'Rodrigo Guzmán', side: 'Revés', hand: 'Diestro', racket: 'Royal Padel RP790', phone: '+56 9 7444 5566', social: '@rodrigoguzman', bio: 'Intenso en cada punto y sólido en defensa baja.', avatar: null, photos: [] },
    { id: 'p13', name: 'Ignacio Reyes', side: 'Drive', hand: 'Diestro', racket: 'Oxdog Hyper Pro', phone: '+56 9 7555 6677', social: '@nachoreyes', bio: 'Buena colocación de voleas y paciencia en el punto.', avatar: null, photos: [] },
    { id: 'p14', name: 'Benjamín Lagos', side: 'Revés', hand: 'Diestro', racket: 'Varlion Bourne Summum', phone: '+56 9 7666 7788', social: '@benjalagos', bio: 'Ataque decidido cuando queda bola corta.', avatar: null, photos: [] },
    { id: 'p15', name: 'Vicente Araya', side: 'Drive', hand: 'Diestro', racket: 'Nox AT10 Genius 18K', phone: '+56 9 7777 8899', social: '@vicentearaya', bio: 'Regularidad y buena comunicación con su pareja.', avatar: null, photos: [] },
    { id: 'p16', name: 'Joaquín Bravo', side: 'Revés', hand: 'Diestro', racket: 'Bullpadel Vertex 04', phone: '+56 9 7888 9900', social: '@joaquinbravo', bio: 'Fuerte en el juego aéreo y definición cercana a la red.', avatar: null, photos: [] }
  ];

  const categories = [
    {
      id: 'cat_3honor',
      name: '3ra Honor',
      badge: 'División de Honor',
      promoteCount: 0,
      relegateCount: 2,
      leagueMode: 'single',
      playoffMode: 'top7',
      teams: [
        { id: 't3_1', name: 'Silva / Rojas', group: 'A', player1Id: 'p1', player2Id: 'p2', substitutions: [] },
        { id: 't3_2', name: 'Herrera / Morales', group: 'A', player1Id: 'p3', player2Id: 'p4', substitutions: [] },
        { id: 't3_3', name: 'Fuentes / Castro', group: 'A', player1Id: 'p5', player2Id: 'p6', substitutions: [] },
        { id: 't3_4', name: 'Soto / Espinoza', group: 'A', player1Id: 'p7', player2Id: 'p8', substitutions: [] },
        { id: 't3_5', name: 'Núñez / Paredes', group: 'A', player1Id: 'p9', player2Id: 'p10', substitutions: [] },
        { id: 't3_6', name: 'Valdés / Guzmán', group: 'A', player1Id: 'p11', player2Id: 'p12', substitutions: [] },
        { id: 't3_7', name: 'Reyes / Lagos', group: 'A', player1Id: 'p13', player2Id: 'p14', substitutions: [] },
        { id: 't3_8', name: 'Araya / Bravo', group: 'A', player1Id: 'p15', player2Id: 'p16', substitutions: [] }
      ],
      matches: [],
      playoffs: {
        mode: 'top7',
        qf1: { teamA: null, teamB: null, winner: null, labelA: '2°', labelB: '7°', court: 'Cancha 1', time: '19:30', sets: [] },
        qf2: { teamA: null, teamB: null, winner: null, labelA: '3°', labelB: '6°', court: 'Cancha 2', time: '19:30', sets: [] },
        qf3: { teamA: null, teamB: null, winner: null, labelA: '4°', labelB: '5°', court: 'Cancha 1', time: '21:00', sets: [] },
        sf1: { teamA: null, teamB: null, winner: null, labelA: '1°', labelB: 'Ganador QF1', court: 'Cancha 1', time: '19:30', sets: [] },
        sf2: { teamA: null, teamB: null, winner: null, labelA: 'Ganador QF2', labelB: 'Ganador QF3', court: 'Cancha 2', time: '21:00', sets: [] },
        thirdPlace: { teamA: null, teamB: null, winner: null, labelA: 'Perdedor SF1', labelB: 'Perdedor SF2', court: 'Cancha 2', time: '19:30', sets: [] },
        final: { teamA: null, teamB: null, winner: null, labelA: 'Ganador SF1', labelB: 'Ganador SF2', court: 'Cancha 1', time: '21:00', sets: [] }
      }
    },
    {
      id: 'cat_4ta',
      name: '4ta Categoría',
      badge: 'Ascenso Directo',
      promoteCount: 2,
      relegateCount: 2,
      leagueMode: 'single',
      playoffMode: 'top7',
      teams: [
        { id: 't4_1', name: 'Pareja 4-A', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_2', name: 'Pareja 4-B', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_3', name: 'Pareja 4-C', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_4', name: 'Pareja 4-D', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_5', name: 'Pareja 4-E', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_6', name: 'Pareja 4-F', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_7', name: 'Pareja 4-G', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't4_8', name: 'Pareja 4-H', group: 'A', player1Id: null, player2Id: null, substitutions: [] }
      ],
      matches: [],
      playoffs: {
        mode: 'top7',
        qf1: { teamA: null, teamB: null, winner: null, labelA: '2°', labelB: '7°', court: 'Cancha 1', time: '19:30', sets: [] },
        qf2: { teamA: null, teamB: null, winner: null, labelA: '3°', labelB: '6°', court: 'Cancha 2', time: '19:30', sets: [] },
        qf3: { teamA: null, teamB: null, winner: null, labelA: '4°', labelB: '5°', court: 'Cancha 1', time: '21:00', sets: [] },
        sf1: { teamA: null, teamB: null, winner: null, labelA: '1°', labelB: 'Ganador QF1', court: 'Cancha 1', time: '19:30', sets: [] },
        sf2: { teamA: null, teamB: null, winner: null, labelA: 'Ganador QF2', labelB: 'Ganador QF3', court: 'Cancha 2', time: '21:00', sets: [] },
        thirdPlace: { teamA: null, teamB: null, winner: null, labelA: 'Perdedor SF1', labelB: 'Perdedor SF2', court: 'Cancha 2', time: '19:30', sets: [] },
        final: { teamA: null, teamB: null, winner: null, labelA: 'Ganador SF1', labelB: 'Ganador SF2', court: 'Cancha 1', time: '21:00', sets: [] }
      }
    },
    {
      id: 'cat_5ta',
      name: '5ta Categoría',
      badge: 'Desarrollo',
      promoteCount: 2,
      relegateCount: 0,
      leagueMode: 'single',
      playoffMode: 'top7',
      teams: [
        { id: 't5_1', name: 'Pareja 5-A', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_2', name: 'Pareja 5-B', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_3', name: 'Pareja 5-C', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_4', name: 'Pareja 5-D', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_5', name: 'Pareja 5-E', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_6', name: 'Pareja 5-F', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_7', name: 'Pareja 5-G', group: 'A', player1Id: null, player2Id: null, substitutions: [] },
        { id: 't5_8', name: 'Pareja 5-H', group: 'A', player1Id: null, player2Id: null, substitutions: [] }
      ],
      matches: [],
      playoffs: {
        mode: 'top7',
        qf1: { teamA: null, teamB: null, winner: null, labelA: '2°', labelB: '7°', court: 'Cancha 1', time: '19:30', sets: [] },
        qf2: { teamA: null, teamB: null, winner: null, labelA: '3°', labelB: '6°', court: 'Cancha 2', time: '19:30', sets: [] },
        qf3: { teamA: null, teamB: null, winner: null, labelA: '4°', labelB: '5°', court: 'Cancha 1', time: '21:00', sets: [] },
        sf1: { teamA: null, teamB: null, winner: null, labelA: '1°', labelB: 'Ganador QF1', court: 'Cancha 1', time: '19:30', sets: [] },
        sf2: { teamA: null, teamB: null, winner: null, labelA: 'Ganador QF2', labelB: 'Ganador QF3', court: 'Cancha 2', time: '21:00', sets: [] },
        thirdPlace: { teamA: null, teamB: null, winner: null, labelA: 'Perdedor SF1', labelB: 'Perdedor SF2', court: 'Cancha 2', time: '19:30', sets: [] },
        final: { teamA: null, teamB: null, winner: null, labelA: 'Ganador SF1', labelB: 'Ganador SF2', court: 'Cancha 1', time: '21:00', sets: [] }
      }
    }
  ];

  categories.forEach(cat => {
    cat.matches = generateCategoryMatches(cat);
    syncPlayoffsFromStandings(cat);
  });

  return {
    season: 1,
    viewedSeason: 'current',
    archivedSeasons: [],
    activeCategoryId: 'cat_3honor',
    activeTab: 'standings',
    selectedRound: 'all',
    playerSearch: '',
    playerSortBy: 'points',
    hofSeasonFilter: 'all',
    hofCategoryFilter: 'all',
    players,
    categories
  };
}

function normalizeLoadedState(parsed) {
  const fallback = createInitialData();
  const merged = {
    ...fallback,
    ...parsed,
    players: Array.isArray(parsed.players) ? parsed.players : fallback.players,
    categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : fallback.categories,
    archivedSeasons: Array.isArray(parsed.archivedSeasons) ? parsed.archivedSeasons : []
  };

  merged.players.forEach(p => {
    if (!Array.isArray(p.photos)) p.photos = [];
    if (!p.hand) p.hand = 'Diestro';
  });

  merged.categories.forEach(cat => {
    if (!cat.leagueMode) cat.leagueMode = 'single';
    if (!cat.playoffMode) cat.playoffMode = 'top7';
    if (!Array.isArray(cat.teams)) cat.teams = [];
    cat.teams.forEach(t => {
      if (!Array.isArray(t.substitutions)) t.substitutions = [];
      if (!t.group) t.group = 'A';
    });
    if (!Array.isArray(cat.matches) || !cat.matches.length) {
      cat.matches = generateCategoryMatches(cat);
    }
    if (!cat.playoffs) {
      cat.playoffs = createInitialData().categories[0].playoffs;
    }
    cat.playoffs.mode = cat.playoffMode;
    syncPlayoffsFromStandings(cat);
  });

  if (!merged.categories.some(c => c.id === merged.activeCategoryId)) {
    merged.activeCategoryId = merged.categories[0]?.id || 'cat_3honor';
  }

  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialData();
    return normalizeLoadedState(JSON.parse(raw));
  } catch (e) {
    return createInitialData();
  }
}

async function initStateFromSQLite() {
  if (typeof PadelDB === 'undefined') {
    return loadState();
  }

  await PadelDB.init();

  if (PadelDB.hasAnyData()) {
    const fromDb = PadelDB.loadFullAppState();
    if (fromDb) {
      return normalizeLoadedState(fromDb);
    }
  }

  try {
    const rawLocal = localStorage.getItem(STORAGE_KEY);
    if (rawLocal) {
      const migrated = normalizeLoadedState(JSON.parse(rawLocal));
      PadelDB.saveFullAppState(migrated);
      return migrated;
    }
  } catch (e) {}

  const fresh = createInitialData();
  PadelDB.saveFullAppState(fresh);
  return fresh;
}

function saveState(nextState = state) {
  state = nextState;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}

  if (typeof PadelDB !== 'undefined' && PadelDB.ready) {
    try {
      PadelDB.saveFullAppState(state);
    } catch (e) {
      console.error('Error guardando en SQLite:', e);
    }
  }
}

let state = loadState();

if (typeof isViewingArchive !== 'function') {
  function isViewingArchive() {
    return Boolean(state && state.viewedSeason !== 'current');
  }
}

if (typeof getDisplayedCategories !== 'function') {
  function getDisplayedCategories() {
    if (!state) return [];
    if (!isViewingArchive()) return state.categories || [];
    const arch = (state.archivedSeasons || []).find(
      a => String(a.season) === String(state.viewedSeason)
    );
    return arch && Array.isArray(arch.categories) ? arch.categories : (state.categories || []);
  }
}

if (typeof getActiveCategory !== 'function') {
  function getActiveCategory() {
    const cats = getDisplayedCategories();
    return cats.find(c => c.id === state.activeCategoryId) || cats[0] || null;
  }
}
