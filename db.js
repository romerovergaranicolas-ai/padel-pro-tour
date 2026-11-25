const SQLITE_STORAGE_KEY = 'padeltour_pro_sqlite_v1';

const SQL_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  season INTEGER NOT NULL,
  viewed_season TEXT NOT NULL DEFAULT 'current',
  active_category_id TEXT NOT NULL,
  active_tab TEXT NOT NULL DEFAULT 'standings',
  selected_round TEXT NOT NULL DEFAULT 'all',
  player_search TEXT NOT NULL DEFAULT '',
  player_sort_by TEXT NOT NULL DEFAULT 'points',
  hof_season_filter TEXT NOT NULL DEFAULT 'all',
  hof_category_filter TEXT NOT NULL DEFAULT 'all'
);

CREATE TABLE IF NOT EXISTS seasons (
  season_num INTEGER PRIMARY KEY,
  is_current INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL,
  season_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  badge TEXT DEFAULT '',
  promote_count INTEGER NOT NULL DEFAULT 0,
  relegate_count INTEGER NOT NULL DEFAULT 0,
  league_mode TEXT NOT NULL DEFAULT 'single',
  playoff_mode TEXT NOT NULL DEFAULT 'top7',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, season_num),
  FOREIGN KEY (season_num) REFERENCES seasons(season_num) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  side TEXT DEFAULT 'Drive',
  hand TEXT DEFAULT 'Diestro',
  racket TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  social TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS player_photos (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  data_url TEXT NOT NULL,
  photo_date TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hof_photos (
  card_key TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,
  updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  season_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  grp TEXT NOT NULL DEFAULT 'A',
  player1_id TEXT,
  player2_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, category_id, season_num),
  FOREIGN KEY (category_id, season_num) REFERENCES categories(id, season_num) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_substitutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  season_num INTEGER NOT NULL,
  out_id TEXT,
  out_name TEXT,
  in_id TEXT,
  in_name TEXT,
  sub_date TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  season_num INTEGER NOT NULL,
  round_num INTEGER NOT NULL,
  grp TEXT,
  date_label TEXT NOT NULL,
  custom_date TEXT DEFAULT '',
  match_time TEXT NOT NULL DEFAULT '19:30',
  court TEXT NOT NULL DEFAULT 'Cancha 1',
  team_a_id TEXT,
  team_b_id TEXT,
  players_a_json TEXT,
  players_b_json TEXT,
  played INTEGER NOT NULL DEFAULT 0,
  delayed INTEGER NOT NULL DEFAULT 0,
  delayed_note TEXT DEFAULT '',
  wo_absent TEXT,
  sets_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, category_id, season_num),
  FOREIGN KEY (category_id, season_num) REFERENCES categories(id, season_num) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playoff_matches (
  stage TEXT NOT NULL,
  category_id TEXT NOT NULL,
  season_num INTEGER NOT NULL,
  team_a_id TEXT,
  team_b_id TEXT,
  players_a_json TEXT,
  players_b_json TEXT,
  winner_id TEXT,
  label_a TEXT DEFAULT '',
  label_b TEXT DEFAULT '',
  court TEXT DEFAULT 'Cancha 1',
  match_time TEXT DEFAULT '19:30',
  custom_date TEXT DEFAULT '',
  sets_json TEXT NOT NULL DEFAULT '[]',
  wo_absent TEXT,
  PRIMARY KEY (stage, category_id, season_num),
  FOREIGN KEY (category_id, season_num) REFERENCES categories(id, season_num) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matches_cat_season ON matches(category_id, season_num, round_num);
CREATE INDEX IF NOT EXISTS idx_teams_cat_season ON teams(category_id, season_num);
`;

const PadelDB = {
  SQL: null,
  db: null,
  ready: false,

  async init() {
    if (this.ready && this.db) return this.db;
    if (typeof initSqlJs !== 'function') {
      throw new Error('sql.js no está cargado. Revisa el <script> de sql-wasm.js en index.html.');
    }

    this.SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });

    const savedBytes = this._loadBytesFromStorage();
    this.db = savedBytes ? new this.SQL.Database(savedBytes) : new this.SQL.Database();
    this.db.run(SQL_SCHEMA);
    this.ready = true;
    return this.db;
  },

  _loadBytesFromStorage() {
    try {
      const b64 = localStorage.getItem(SQLITE_STORAGE_KEY);
      if (!b64) return null;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      return null;
    }
  },

  _saveBytesToStorage() {
    if (!this.db) return;
    const bytes = this.db.export();
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    localStorage.setItem(SQLITE_STORAGE_KEY, btoa(binary));
  },

  query(sql, params = []) {
    if (!this.db) return [];
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  },

  hasAnyData() {
    if (!this.db) return false;
    const rows = this.query('SELECT COUNT(*) AS total FROM meta_state');
    return (rows[0]?.total || 0) > 0;
  },

  saveFullAppState(appState) {
    if (!this.db || !appState) return;

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(`
        DELETE FROM hof_photos;
        DELETE FROM playoff_matches;
        DELETE FROM matches;
        DELETE FROM team_substitutions;
        DELETE FROM teams;
        DELETE FROM categories;
        DELETE FROM seasons;
        DELETE FROM player_photos;
        DELETE FROM players;
        DELETE FROM meta_state;
      `);

      this.db.run(`
        INSERT INTO meta_state (
          id, season, viewed_season, active_category_id, active_tab,
          selected_round, player_search, player_sort_by,
          hof_season_filter, hof_category_filter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        1,
        Number(appState.season) || 1,
        String(appState.viewedSeason ?? 'current'),
        String(appState.activeCategoryId || 'cat_3honor'),
        String(appState.activeTab || 'standings'),
        String(appState.selectedRound ?? 'all'),
        String(appState.playerSearch || ''),
        String(appState.playerSortBy || 'points'),
        String(appState.hofSeasonFilter || 'all'),
        String(appState.hofCategoryFilter || 'all')
      ]);

      (appState.players || []).forEach(p => {
        this.db.run(`
          INSERT INTO players (id, name, side, hand, racket, phone, social, bio, avatar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          p.id, p.name, p.side || 'Drive', p.hand || 'Diestro',
          p.racket || '', p.phone || '', p.social || '', p.bio || '', p.avatar || null
        ]);

        (p.photos || []).forEach((ph, idx) => {
          this.db.run(`
            INSERT INTO player_photos (id, player_id, data_url, photo_date, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `, [ph.id, p.id, ph.dataUrl, ph.date || '', idx]);
        });
      });

      const mergedHofPhotos = {
        ...(typeof window !== 'undefined' && window.__hofPhotoCache ? window.__hofPhotoCache : {}),
        ...(appState.hofPhotos && typeof appState.hofPhotos === 'object' ? appState.hofPhotos : {})
      };
      const nowIso = new Date().toISOString();
      Object.entries(mergedHofPhotos).forEach(([cardKey, dataUrl]) => {
        if (!cardKey || !dataUrl) return;
        this.db.run(`
          INSERT OR REPLACE INTO hof_photos (card_key, data_url, updated_at)
          VALUES (?, ?, ?)
        `, [String(cardKey), String(dataUrl), nowIso]);
      });

      const seasonBundles = [
        ...(appState.archivedSeasons || []).map(arch => ({
          season_num: Number(arch.season),
          is_current: 0,
          closed_at: arch.closedAt || '',
          categories: arch.categories || []
        })),
        {
          season_num: Number(appState.season) || 1,
          is_current: 1,
          closed_at: '',
          categories: appState.categories || []
        }
      ];

      seasonBundles.forEach(sb => {
        this.db.run(`
          INSERT OR REPLACE INTO seasons (season_num, is_current, closed_at)
          VALUES (?, ?, ?)
        `, [sb.season_num, sb.is_current, sb.closed_at]);

        (sb.categories || []).forEach((cat, cIdx) => {
          this.db.run(`
            INSERT INTO categories (
              id, season_num, name, badge, promote_count, relegate_count,
              league_mode, playoff_mode, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            cat.id, sb.season_num, cat.name, cat.badge || '',
            Number(cat.promoteCount) || 0, Number(cat.relegateCount) || 0,
            cat.leagueMode || 'single', cat.playoffMode || 'top7', cIdx
          ]);

          (cat.teams || []).forEach((t, tIdx) => {
            this.db.run(`
              INSERT INTO teams (
                id, category_id, season_num, name, grp, player1_id, player2_id, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              t.id, cat.id, sb.season_num, t.name, t.group || 'A',
              t.player1Id || null, t.player2Id || null, tIdx
            ]);

            (t.substitutions || []).forEach(sub => {
              this.db.run(`
                INSERT INTO team_substitutions (
                  team_id, category_id, season_num, out_id, out_name, in_id, in_name, sub_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                t.id, cat.id, sb.season_num,
                sub.outId || null, sub.outName || '',
                sub.inId || null, sub.inName || '', sub.date || ''
              ]);
            });
          });

          (cat.matches || []).forEach((m, mIdx) => {
            this.db.run(`
              INSERT INTO matches (
                id, category_id, season_num, round_num, grp, date_label, custom_date,
                match_time, court, team_a_id, team_b_id, players_a_json, players_b_json,
                played, delayed, delayed_note, wo_absent, sets_json, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              m.id, cat.id, sb.season_num, Number(m.round) || 1, m.group || null,
              m.dateLabel || `Fecha ${m.round || 1}`, m.customDate || '',
              m.time || '19:30', m.court || 'Cancha 1',
              m.teamAId || null, m.teamBId || null,
              Array.isArray(m.playersA) ? JSON.stringify(m.playersA) : null,
              Array.isArray(m.playersB) ? JSON.stringify(m.playersB) : null,
              m.played ? 1 : 0, m.delayed ? 1 : 0, m.delayedNote || '',
              m.woAbsent || null, JSON.stringify(m.sets || []), mIdx
            ]);
          });

          const po = cat.playoffs || {};
          ['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'thirdPlace', 'final'].forEach(stage => {
            const node = po[stage];
            if (!node) return;
            this.db.run(`
              INSERT INTO playoff_matches (
                stage, category_id, season_num, team_a_id, team_b_id,
                players_a_json, players_b_json, winner_id, label_a, label_b,
                court, match_time, custom_date, sets_json, wo_absent
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              stage, cat.id, sb.season_num,
              node.teamA || null, node.teamB || null,
              Array.isArray(node.playersA) ? JSON.stringify(node.playersA) : null,
              Array.isArray(node.playersB) ? JSON.stringify(node.playersB) : null,
              node.winner || null, node.labelA || '', node.labelB || '',
              node.court || 'Cancha 1', node.time || '19:30', node.customDate || '',
              JSON.stringify(node.sets || []), node.woAbsent || null
            ]);
          });
        });
      });

      this.db.run('COMMIT;');
      this._saveBytesToStorage();
    } catch (err) {
      this.db.run('ROLLBACK;');
      console.error('Error guardando en SQLite:', err);
      throw err;
    }
  },

  loadFullAppState() {
    if (!this.hasAnyData()) return null;

    const meta = this.query('SELECT * FROM meta_state WHERE id = 1')[0];
    if (!meta) return null;

    const photoRows = this.query('SELECT * FROM player_photos ORDER BY sort_order ASC');
    const photosByPlayer = {};
    photoRows.forEach(ph => {
      if (!photosByPlayer[ph.player_id]) photosByPlayer[ph.player_id] = [];
      photosByPlayer[ph.player_id].push({
        id: ph.id,
        dataUrl: ph.data_url,
        date: ph.photo_date
      });
    });

    const players = this.query('SELECT * FROM players ORDER BY rowid ASC').map(p => ({
      id: p.id,
      name: p.name,
      side: p.side || 'Drive',
      hand: p.hand || 'Diestro',
      racket: p.racket || '',
      phone: p.phone || '',
      social: p.social || '',
      bio: p.bio || '',
      avatar: p.avatar || null,
      photos: photosByPlayer[p.id] || []
    }));

    const hofRows = this.query('SELECT card_key, data_url FROM hof_photos');
    const hofPhotos = {};
    hofRows.forEach(row => {
      if (row.card_key && row.data_url) {
        hofPhotos[row.card_key] = row.data_url;
        if (typeof window !== 'undefined') {
          window.__hofPhotoCache = window.__hofPhotoCache || {};
          window.__hofPhotoCache[row.card_key] = row.data_url;
        }
      }
    });

    const buildSeasonCategories = (seasonNum) => {
      const catRows = this.query(
        'SELECT * FROM categories WHERE season_num = ? ORDER BY sort_order ASC',
        [seasonNum]
      );

      return catRows.map(c => {
        const subRows = this.query(
          'SELECT * FROM team_substitutions WHERE category_id = ? AND season_num = ? ORDER BY id ASC',
          [c.id, seasonNum]
        );
        const subsByTeam = {};
        subRows.forEach(s => {
          if (!subsByTeam[s.team_id]) subsByTeam[s.team_id] = [];
          subsByTeam[s.team_id].push({
            outId: s.out_id,
            outName: s.out_name,
            inId: s.in_id,
            inName: s.in_name,
            date: s.sub_date
          });
        });

        const teams = this.query(
          'SELECT * FROM teams WHERE category_id = ? AND season_num = ? ORDER BY sort_order ASC',
          [c.id, seasonNum]
        ).map(t => ({
          id: t.id,
          name: t.name,
          group: t.grp || 'A',
          player1Id: t.player1_id || null,
          player2Id: t.player2_id || null,
          substitutions: subsByTeam[t.id] || []
        }));

        const matches = this.query(
          'SELECT * FROM matches WHERE category_id = ? AND season_num = ? ORDER BY sort_order ASC',
          [c.id, seasonNum]
        ).map(m => ({
          id: m.id,
          round: m.round_num,
          group: m.grp || null,
          dateLabel: m.date_label,
          customDate: m.custom_date || '',
          time: m.match_time || '19:30',
          court: m.court || 'Cancha 1',
          teamAId: m.team_a_id || null,
          teamBId: m.team_b_id || null,
          playersA: m.players_a_json ? JSON.parse(m.players_a_json) : null,
          playersB: m.players_b_json ? JSON.parse(m.players_b_json) : null,
          played: Boolean(m.played),
          delayed: Boolean(m.delayed),
          delayedNote: m.delayed_note || '',
          woAbsent: m.wo_absent || null,
          sets: m.sets_json ? JSON.parse(m.sets_json) : []
        }));

        const playoffs = { mode: c.playoff_mode || 'top7' };
        const poRows = this.query(
          'SELECT * FROM playoff_matches WHERE category_id = ? AND season_num = ?',
          [c.id, seasonNum]
        );
        poRows.forEach(po => {
          playoffs[po.stage] = {
            teamA: po.team_a_id || null,
            teamB: po.team_b_id || null,
            playersA: po.players_a_json ? JSON.parse(po.players_a_json) : null,
            playersB: po.players_b_json ? JSON.parse(po.players_b_json) : null,
            winner: po.winner_id || null,
            labelA: po.label_a || '',
            labelB: po.label_b || '',
            court: po.court || 'Cancha 1',
            time: po.match_time || '19:30',
            customDate: po.custom_date || '',
            sets: po.sets_json ? JSON.parse(po.sets_json) : [],
            woAbsent: po.wo_absent || null
          };
        });

        return {
          id: c.id,
          name: c.name,
          badge: c.badge || '',
          promoteCount: c.promote_count,
          relegateCount: c.relegate_count,
          leagueMode: c.league_mode,
          playoffMode: c.playoff_mode,
          teams,
          matches,
          playoffs
        };
      });
    };

    const archivedSeasons = this.query(
      'SELECT * FROM seasons WHERE is_current = 0 ORDER BY season_num ASC'
    ).map(s => ({
      season: s.season_num,
      closedAt: s.closed_at || '',
      categories: buildSeasonCategories(s.season_num)
    }));

    const currentSeasonNum = Number(meta.season) || 1;
    const categories = buildSeasonCategories(currentSeasonNum);

    return {
      season: currentSeasonNum,
      viewedSeason: meta.viewed_season || 'current',
      archivedSeasons,
      activeCategoryId: meta.active_category_id || (categories[0]?.id || 'cat_3honor'),
      activeTab: meta.active_tab || 'standings',
      selectedRound: meta.selected_round || 'all',
      playerSearch: meta.player_search || '',
      playerSortBy: meta.player_sort_by || 'points',
      hofSeasonFilter: meta.hof_season_filter || 'all',
      hofCategoryFilter: meta.hof_category_filter || 'all',
      hofPhotos,
      players,
      categories
    };
  },

  exportSqliteFile(filename = 'padeltour_pro.sqlite') {
    if (!this.db) return;
    const bytes = this.db.export();
    const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  resetDatabase() {
    try { localStorage.removeItem(SQLITE_STORAGE_KEY); } catch (e) {}
    if (this.SQL) {
      this.db = new this.SQL.Database();
      this.db.run(SQL_SCHEMA);
    }
  }
};
