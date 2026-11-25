if (typeof escapeHTML !== 'function') {
  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

if (typeof getTeamName !== 'function') {
  function getTeamName(category, teamId) {
    if (!teamId) return 'Por definir';
    const cat = category || (typeof getActiveCategory === 'function' ? getActiveCategory() : null);
    const team = cat && Array.isArray(cat.teams) ? cat.teams.find(t => t.id === teamId) : null;
    if (team && team.name) return team.name;
    if (typeof state === 'object' && state && Array.isArray(state.categories)) {
      for (const c of state.categories) {
        const found = (c.teams || []).find(t => t.id === teamId);
        if (found && found.name) return found.name;
      }
    }
    return String(teamId);
  }
}

if (typeof getPlayerById !== 'function') {
  function getPlayerById(playerId) {
    if (!playerId || typeof state !== 'object' || !state || !Array.isArray(state.players)) return null;
    return state.players.find(p => p.id === playerId) || null;
  }
}

if (typeof getAllSeasonChampions !== 'function') {
  function getAllSeasonChampions() {
    const results = [];
    if (typeof state !== 'object' || !state) return results;

    const pushFromSeason = (seasonNum, categories, isCurrent) => {
      (categories || []).forEach(cat => {
        const champId = cat.playoffs?.final?.winner;
        if (!champId) return;
        const team = (cat.teams || []).find(t => t.id === champId);
        const p1 = team?.player1Id ? getPlayerById(team.player1Id) : null;
        const p2 = team?.player2Id ? getPlayerById(team.player2Id) : null;

        let pj = 0, pg = 0, sf = 0, sc = 0;
        const leagueCampaign = [];

        (cat.matches || []).forEach(m => {
          if (!m.played) return;
          const isA = m.teamAId === champId;
          const isB = m.teamBId === champId;
          if (!isA && !isB) return;

          pj++;
          const res = typeof evaluateMatchResult === 'function' ? evaluateMatchResult(m) : null;
          const won = res ? (isA ? res.winner === 'A' : res.winner === 'B') : false;
          if (won) pg++;

          let setsChamp = 0, setsRival = 0;
          const scoreParts = (m.sets || []).map(s => {
            const a = Number(s[0] ?? s.a ?? 0);
            const b = Number(s[1] ?? s.b ?? 0);
            const my = isA ? a : b;
            const opp = isA ? b : a;
            if (my > opp) setsChamp++;
            else if (opp > my) setsRival++;
            return `${my}-${opp}`;
          });
          sf += setsChamp;
          sc += setsRival;

          leagueCampaign.push({
            stageLabel: m.dateLabel || `Fecha ${m.round}`,
            rivalName: getTeamName(cat, isA ? m.teamBId : m.teamAId),
            won,
            scoreText: scoreParts.join(', ') || (won ? 'Victoria' : 'Derrota')
          });
        });

        const playoffCampaign = [];
        const po = cat.playoffs || {};
        ['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'thirdPlace', 'final'].forEach(stageKey => {
          const node = po[stageKey];
          if (!node) return;
          const isA = node.teamA === champId;
          const isB = node.teamB === champId;
          if (!isA && !isB) return;
          const scoreParts = (node.sets || []).map(s => {
            const a = Number(s[0] ?? s.a ?? 0);
            const b = Number(s[1] ?? s.b ?? 0);
            return isA ? `${a}-${b}` : `${b}-${a}`;
          });
          playoffCampaign.push({
            stageLabel: PO_STAGE_NAMES[stageKey] || stageKey,
            rivalName: getTeamName(cat, isA ? node.teamB : node.teamA),
            scoreText: scoreParts.join(', ') || (node.winner === champId ? 'Ganador' : 'Participó')
          });
        });

        const winRate = pj > 0 ? Math.round((pg / pj) * 100) : 0;

        results.push({
          season: seasonNum,
          categoryId: cat.id,
          categoryName: cat.name,
          isCurrent,
          teamId: champId,
          teamName: team?.name || getTeamName(cat, champId),
          p1,
          p2,
          stats: { pj, pg, sf, sc, winRate },
          leagueCampaign,
          playoffCampaign
        });
      });
    };

    (state.archivedSeasons || []).forEach(arch => {
      pushFromSeason(arch.season, arch.categories, false);
    });
    pushFromSeason(state.season, state.categories, true);

    return results.sort((a, b) => b.season - a.season);
  }
}

if (typeof computeStandings !== 'function') {
  function computeStandings(cat, groupFilter = null) {
    if (!cat || !Array.isArray(cat.teams)) return [];
    const teams = groupFilter
      ? cat.teams.filter(t => (t.group || 'A') === groupFilter)
      : cat.teams.slice();

    const map = {};
    teams.forEach(t => {
      map[t.id] = {
        teamId: t.id,
        name: t.name,
        pj: 0,
        pg: 0,
        pp: 0,
        wo: 0,
        sf: 0,
        sc: 0,
        gf: 0,
        gc: 0,
        pts: 0
      };
    });

    (cat.matches || []).forEach(m => {
      if (!m.played) return;
      if (!map[m.teamAId] || !map[m.teamBId]) return;

      const rowA = map[m.teamAId];
      const rowB = map[m.teamBId];
      const res = typeof evaluateMatchResult === 'function' ? evaluateMatchResult(m) : null;

      rowA.pj++;
      rowB.pj++;

      let setsA = 0, setsB = 0;
      (m.sets || []).forEach(s => {
        const a = Number(s[0] ?? s.a ?? 0);
        const b = Number(s[1] ?? s.b ?? 0);
        rowA.gf += a;
        rowA.gc += b;
        rowB.gf += b;
        rowB.gc += a;
        if (a > b) setsA++;
        else if (b > a) setsB++;
      });

      rowA.sf += setsA;
      rowA.sc += setsB;
      rowB.sf += setsB;
      rowB.sc += setsA;

      if (res) {
        rowA.pts += Number(res.ptsA) || 0;
        rowB.pts += Number(res.ptsB) || 0;
        if (res.winner === 'A') {
          rowA.pg++;
          rowB.pp++;
        } else if (res.winner === 'B') {
          rowB.pg++;
          rowA.pp++;
        }
        if (res.absent === 'A') rowA.wo++;
        if (res.absent === 'B') rowB.wo++;
      } else {
        if (setsA > setsB) {
          rowA.pg++;
          rowB.pp++;
          rowA.pts += setsB === 0 ? 5 : 4;
          rowB.pts += setsB === 0 ? 1 : 2;
        } else if (setsB > setsA) {
          rowB.pg++;
          rowA.pp++;
          rowB.pts += setsA === 0 ? 5 : 4;
          rowA.pts += setsA === 0 ? 1 : 2;
        }
      }
    });

    return Object.values(map).sort((a, b) =>
      b.pts - a.pts ||
      (b.sf - b.sc) - (a.sf - a.sc) ||
      (b.gf - b.gc) - (a.gf - a.gc) ||
      b.pg - a.pg ||
      a.name.localeCompare(b.name)
    );
  }
}

if (typeof evaluateMatchResult !== 'function') {
  function evaluateMatchResult(match) {
    if (!match || !match.played) return null;

    if (match.woAbsent === 'A' || match.woAbsent === 'B') {
      const absent = match.woAbsent;
      const winner = absent === 'A' ? 'B' : 'A';
      return {
        winner,
        absent,
        isWO: true,
        ptsA: absent === 'A' ? 0 : 5,
        ptsB: absent === 'B' ? 0 : 5
      };
    }

    let setsA = 0, setsB = 0;
    (match.sets || []).forEach(s => {
      const a = Number(s[0] ?? s.a ?? 0);
      const b = Number(s[1] ?? s.b ?? 0);
      if (a > b) setsA++;
      else if (b > a) setsB++;
    });

    if (setsA === 0 && setsB === 0) return null;

    if (setsA > setsB) {
      return {
        winner: 'A',
        absent: null,
        isWO: false,
        ptsA: setsB === 0 ? 5 : 4,
        ptsB: setsB === 0 ? 1 : 2
      };
    }

    return {
      winner: 'B',
      absent: null,
      isWO: false,
      ptsB: setsA === 0 ? 5 : 4,
      ptsA: setsA === 0 ? 1 : 2
    };
  }
}

if (typeof ensurePlayoffBracket !== 'function') {
  function ensurePlayoffBracket(cat) {
    if (!cat.playoffs) {
      cat.playoffs = {
        mode: cat.playoffMode || 'top7',
        qf1: { teamA: null, teamB: null, winner: null, labelA: '2°', labelB: '7°', court: 'Cancha 1', time: '19:30', sets: [] },
        qf2: { teamA: null, teamB: null, winner: null, labelA: '3°', labelB: '6°', court: 'Cancha 2', time: '19:30', sets: [] },
        qf3: { teamA: null, teamB: null, winner: null, labelA: '4°', labelB: '5°', court: 'Cancha 1', time: '21:00', sets: [] },
        sf1: { teamA: null, teamB: null, winner: null, labelA: '1°', labelB: 'Ganador QF1', court: 'Cancha 1', time: '19:30', sets: [] },
        sf2: { teamA: null, teamB: null, winner: null, labelA: 'Ganador QF2', labelB: 'Ganador QF3', court: 'Cancha 2', time: '21:00', sets: [] },
        thirdPlace: { teamA: null, teamB: null, winner: null, labelA: 'Perdedor SF1', labelB: 'Perdedor SF2', court: 'Cancha 2', time: '19:30', sets: [] },
        final: { teamA: null, teamB: null, winner: null, labelA: 'Ganador SF1', labelB: 'Ganador SF2', court: 'Cancha 1', time: '21:00', sets: [] }
      };
    }
    cat.playoffs.mode = cat.playoffMode || cat.playoffs.mode || 'top7';
    return cat.playoffs;
  }
}

if (typeof computeIndividualRankings !== 'function') {
  function computeIndividualRankings() {
    const baseByCatId = {
      cat_3honor: 120,
      cat_4ta: 40,
      cat_5ta: 15
    };
    const multByCatId = {
      cat_3honor: 1.6,
      cat_4ta: 1.1,
      cat_5ta: 1.0
    };

    const byId = {};
    (state.players || []).forEach(p => {
      byId[p.id] = {
        playerId: p.id,
        name: p.name,
        basePoints: 0,
        earnedPoints: 0,
        points: 0,
        rank: 1
      };
    });

    (state.categories || []).forEach(cat => {
      const base = baseByCatId[cat.id] ?? 75;
      const mult = multByCatId[cat.id] ?? 1.3;

      (cat.teams || []).forEach(t => {
        [t.player1Id, t.player2Id].forEach(pid => {
          if (pid && byId[pid] && byId[pid].basePoints < base) {
            byId[pid].basePoints = base;
          }
        });
      });

      (cat.matches || []).forEach(m => {
        if (!m.played) return;
        const res = evaluateMatchResult(m);
        if (!res) return;
        const teamA = (cat.teams || []).find(t => t.id === m.teamAId);
        const teamB = (cat.teams || []).find(t => t.id === m.teamBId);
        const pA = Array.isArray(m.playersA) && m.playersA.length ? m.playersA : [teamA?.player1Id, teamA?.player2Id];
        const pB = Array.isArray(m.playersB) && m.playersB.length ? m.playersB : [teamB?.player1Id, teamB?.player2Id];

        (pA || []).forEach(pid => {
          if (pid && byId[pid]) {
            byId[pid].earnedPoints += (res.ptsA || 0) * mult;
          }
        });
        (pB || []).forEach(pid => {
          if (pid && byId[pid]) {
            byId[pid].earnedPoints += (res.ptsB || 0) * mult;
          }
        });
      });
    });

    const list = Object.values(byId)
      .map(item => {
        const earned = Math.round(item.earnedPoints * 10) / 10;
        const total = Math.round((item.basePoints + earned) * 10) / 10;
        return { ...item, earnedPoints: earned, points: total };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    list.forEach((item, idx) => {
      item.rank = idx + 1;
      byId[item.playerId] = item;
    });

    return { list, byId };
  }
}

if (typeof getPlayerAssignmentInfo !== 'function') {
  function getPlayerAssignmentInfo(playerId) {
    for (const cat of (state.categories || [])) {
      for (const t of (cat.teams || [])) {
        if (t.player1Id === playerId || t.player2Id === playerId) {
          return {
            categoryId: cat.id,
            categoryName: cat.name,
            teamId: t.id,
            teamName: t.name
          };
        }
      }
    }
    return null;
  }
}

if (typeof getRecommendedFormat !== 'function') {
  function getRecommendedFormat(teamCount) {
    if (teamCount >= 12) {
      return {
        title: '2 Grupos (A y B) + Playoffs Top 8',
        desc: 'Ideal para 12 a 20 parejas: reduce la cantidad de fechas por pareja y clasifica a los 4 mejores de cada grupo a Cuartos de Final.'
      };
    }
    if (teamCount >= 10) {
      return {
        title: 'Liga Grupo Único + Playoffs Top 6',
        desc: '1° y 2° avanzan directo a Semifinales; 3° vs 6° y 4° vs 5° juegan Cuartos de Final.'
      };
    }
    return {
      title: 'Liga Grupo Único + Playoffs Top 7',
      desc: '1° avanza directo a Semifinales; 2° al 7° disputan Cuartos de Final.'
    };
  }
}

if (typeof evaluateNewPairSeeding !== 'function') {
  function evaluateNewPairSeeding(p1Id, p2Id) {
    const { byId } = computeIndividualRankings();
    const sum = (p1Id ? (byId[p1Id]?.points || 0) : 0) + (p2Id ? (byId[p2Id]?.points || 0) : 0);
    if (sum >= 320) return { suggestedCategory: '3ra Honor', combinedPoints: sum };
    if (sum >= 130) return { suggestedCategory: '4ta Categoría', combinedPoints: sum };
    return { suggestedCategory: '5ta Categoría', combinedPoints: sum };
  }
}

const PO_STAGE_NAMES = {
  qf1: 'Cuartos de Final 1',
  qf2: 'Cuartos de Final 2',
  qf3: 'Cuartos de Final 3',
  qf4: 'Cuartos de Final 4',
  sf1: 'Semifinal 1',
  sf2: 'Semifinal 2',
  thirdPlace: 'Definición 3er y 4to Lugar',
  final: 'Gran Final'
};

function render() {
  const cats = getDisplayedCategories();
  const cat = getActiveCategory();
  const archivedMode = isViewingArchive();

  const seasonSel = document.getElementById('seasonSelector');
  let seasonOpts = `<option value="current" ${!archivedMode ? 'selected' : ''}>🟢 Temporada ${state.season} (Actual)</option>`;
  (state.archivedSeasons || []).slice().reverse().forEach(arch => {
    seasonOpts += `<option value="${arch.season}" ${String(state.viewedSeason) === String(arch.season) ? 'selected' : ''}>📜 Temporada ${arch.season} (Finalizada)</option>`;
  });
  seasonSel.innerHTML = seasonOpts;

  const banner = document.getElementById('archiveBanner');
  if (archivedMode) banner.classList.remove('hidden');
  else banner.classList.add('hidden');

  let totalDelayedAll = 0;
  cats.forEach(c => {
    totalDelayedAll += c.matches.filter(m => m.delayed && !m.played).length;
  });
  const delayedBadge = document.getElementById('delayedCountBadge');
  if (totalDelayedAll > 0) {
    delayedBadge.textContent = totalDelayedAll;
    delayedBadge.classList.remove('hidden');
  } else {
    delayedBadge.classList.add('hidden');
  }

  const allChampions = getAllSeasonChampions();
  const champBadge = document.getElementById('championsCountBadge');
  if (allChampions.length > 0) {
    champBadge.textContent = allChampions.length;
    champBadge.classList.remove('hidden');
  } else {
    champBadge.classList.add('hidden');
  }

  document.getElementById('categoryTabs').innerHTML = cats.map(c => {
    const active = c.id === cat.id;
    return `<button type="button" onclick="selectCategory('${c.id}')" class="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${active ? 'bg-tennis-400 text-court-900 shadow' : 'text-slate-300 hover:text-white hover:bg-court-700'}">${escapeHTML(c.name)}</button>`;
  }).join('');

  ['standings', 'fixtures', 'delayed', 'playoffs', 'champions', 'players', 'promotions', 'admin'].forEach(tab => {
    const el = document.getElementById(`nav-${tab}`);
    if (el) {
      const isFlex = (tab === 'delayed' || tab === 'champions') ? 'flex items-center gap-1.5 ' : '';
      const extraRightPad = tab === 'admin' ? 'pr-8 ' : '';
      el.className = `${isFlex}py-3 ${extraRightPad}whitespace-nowrap shrink-0 transition ${state.activeTab === tab ? 'tab-active' : 'tab-inactive'}`;
    }
  });

  const standings = computeStandings(cat);
  const playedCount = cat.matches.filter(m => m.played).length;
  const delayedCatCount = cat.matches.filter(m => m.delayed && !m.played).length;
  const totalMatches = cat.matches.length;
  const leader = standings[0] ? escapeHTML(standings[0].name) : '—';
  const modeDesc = cat.leagueMode === 'two_groups' ? '2 Grupos (A y B)' : 'Liga Grupo Único';
  const poDesc = cat.playoffMode === 'top6' ? 'Playoffs Top 6' : cat.playoffMode === 'top8' ? 'Playoffs Top 8' : 'Playoffs Top 7';

  document.getElementById('kpiBar').innerHTML = `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div class="text-xs font-semibold text-slate-400 uppercase">${archivedMode ? 'Archivo Temp. ' + state.viewedSeason : 'Categoría Activa'}</div>
      <div class="text-lg font-extrabold text-slate-900 mt-0.5">${escapeHTML(cat.name)}</div>
      <div class="text-xs text-tennis-600 font-semibold mt-1">${modeDesc} · ${poDesc}</div>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div class="text-xs font-semibold text-slate-400 uppercase">Parejas / Pool</div>
      <div class="text-lg font-extrabold text-slate-900 mt-0.5">${cat.teams.length} Parejas</div>
      <div class="text-xs text-slate-500 mt-1">${(state.players || []).length} jugadores inscritos en pool</div>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div class="text-xs font-semibold text-slate-400 uppercase">Avance Fase Liga</div>
      <div class="text-lg font-extrabold text-slate-900 mt-0.5">${playedCount} / ${totalMatches} Partidos</div>
      <div class="flex items-center justify-between text-[11px] mt-1">
        <span class="text-slate-400">${totalMatches ? Math.round((playedCount/totalMatches)*100) : 0}% jugado</span>
        ${delayedCatCount > 0 ? `<span class="text-orange-600 font-bold">⏳ ${delayedCatCount} retrasado(s)</span>` : ''}
      </div>
    </div>
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div class="text-xs font-semibold text-slate-400 uppercase">Mejor Puntaje</div>
      <div class="text-base font-extrabold text-slate-900 mt-0.5 truncate">${leader}</div>
      <div class="text-xs text-emerald-600 font-semibold mt-1">${standings[0] ? standings[0].pts + ' pts' : 'Sin puntos'}</div>
    </div>
  `;

  const container = document.getElementById('appContent');
  if (state.activeTab === 'standings') container.innerHTML = renderStandingsView(cat);
  else if (state.activeTab === 'fixtures') container.innerHTML = renderFixturesView(cat);
  else if (state.activeTab === 'delayed') container.innerHTML = renderDelayedView();
  else if (state.activeTab === 'playoffs') container.innerHTML = renderPlayoffsView(cat);
  else if (state.activeTab === 'champions') container.innerHTML = renderChampionsHallView(allChampions);
  else if (state.activeTab === 'players') container.innerHTML = renderPlayersView();
  else if (state.activeTab === 'promotions') container.innerHTML = renderPromotionsView();
  else if (state.activeTab === 'admin') {
    container.innerHTML = renderAdminView(cat);
    updatePairBuilderPreview();
  }

  setTimeout(updateNavScrollButtons, 50);
}

function renderChampionsHallView(allChampions) {
  const seasonsList = [...new Set(allChampions.map(c => c.season))].sort((a, b) => b - a);
  const catsList = [...new Set(allChampions.map(c => c.categoryName))];

  const filtered = allChampions.filter(item => {
    const matchS = state.hofSeasonFilter === 'all' || String(item.season) === String(state.hofSeasonFilter);
    const matchC = state.hofCategoryFilter === 'all' || item.categoryName === state.hofCategoryFilter;
    return matchS && matchC;
  });

  const renderPlayerMiniAvatar = (p, fallbackLabel) => {
    if (!p) {
      return `<div class="w-11 h-11 rounded-full bg-court-800 text-tennis-400 font-extrabold flex items-center justify-center text-xs border-2 border-amber-400/60 shrink-0">${fallbackLabel}</div>`;
    }
    const ini = p.name.trim().split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
    return `
      <button type="button" onclick="openPlayerProfile('${p.id}')" title="Ver perfil de ${escapeHTML(p.name)}" class="w-11 h-11 rounded-full bg-court-800 text-tennis-400 font-extrabold flex items-center justify-center text-xs border-2 border-amber-400/70 overflow-hidden shrink-0 hover:scale-105 transition">
        ${p.avatar ? `<img src="${p.avatar}" alt="${escapeHTML(p.name)}" class="w-full h-full object-cover">` : escapeHTML(ini)}
      </button>
    `;
  };

  return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-court-900 via-court-800 to-court-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-2xl">👑</span>
            <h2 class="text-lg sm:text-xl font-extrabold tracking-tight">Salón de la Fama — Campeones Históricos</h2>
          </div>
          <p class="text-xs text-slate-300 mt-1">Registro automático de cada pareja campeona y el detalle completo de su campaña en <strong>Fase Regular</strong> y <strong>Playoffs</strong>.</p>
        </div>

        ${allChampions.length > 0 ? `
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <select onchange="setHofFilter('season', this.value)" class="bg-court-700 text-white border border-white/20 rounded-xl px-3 py-2 font-bold focus:outline-none">
              <option value="all" ${state.hofSeasonFilter === 'all' ? 'selected' : ''}>Todas las Temporadas</option>
              ${seasonsList.map(s => `<option value="${s}" ${String(state.hofSeasonFilter) === String(s) ? 'selected' : ''}>Temporada ${s}</option>`).join('')}
            </select>
            <select onchange="setHofFilter('category', this.value)" class="bg-court-700 text-white border border-white/20 rounded-xl px-3 py-2 font-bold focus:outline-none">
              <option value="all" ${state.hofCategoryFilter === 'all' ? 'selected' : ''}>Todas las Categorías</option>
              ${catsList.map(c => `<option value="${escapeHTML(c)}" ${state.hofCategoryFilter === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      ${allChampions.length === 0 ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <div class="text-4xl">🏆</div>
          <h3 class="text-base font-extrabold text-slate-800">Aún no hay campeones coronados</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">Cuando definas al ganador de la <strong>Gran Final</strong> en la pestaña <strong>🏆 Playoffs y Podio</strong>, aparecerá aquí automáticamente con toda su campaña.</p>
        </div>
      ` : `
        <div class="space-y-6">
          ${filtered.map(champ => `
            <div class="bg-white rounded-2xl border-2 border-amber-300/80 shadow-md overflow-hidden">
              <div class="bg-gradient-to-r from-amber-50 via-yellow-50/70 to-white p-5 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                  <div class="flex -space-x-2">
                    ${renderPlayerMiniAvatar(champ.p1, 'J1')}
                    ${renderPlayerMiniAvatar(champ.p2, 'J2')}
                  </div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-court-900 text-tennis-400">Temporada ${champ.season}</span>
                      <span class="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">${escapeHTML(champ.categoryName)}</span>
                      ${champ.isCurrent ? '<span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Temporada Actual</span>' : ''}
                    </div>
                    <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">🥇 ${escapeHTML(champ.teamName)}</h3>
                    <p class="text-xs text-slate-600 font-medium">
                      ${champ.p1 ? escapeHTML(champ.p1.name) : 'Jugador 1'} &amp; ${champ.p2 ? escapeHTML(champ.p2.name) : 'Jugador 2'}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                  <div class="bg-white border border-amber-200 rounded-xl px-3 py-2">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Jugados</div>
                    <div class="text-sm sm:text-base font-extrabold text-slate-900">${champ.stats.pj}</div>
                  </div>
                  <div class="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <div class="text-[10px] font-bold text-emerald-700 uppercase">Ganados</div>
                    <div class="text-sm sm:text-base font-extrabold text-emerald-800">${champ.stats.pg}</div>
                  </div>
                  <div class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <div class="text-[10px] font-bold text-slate-500 uppercase">Sets</div>
                    <div class="text-sm sm:text-base font-extrabold text-slate-800">${champ.stats.sf}-${champ.stats.sc}</div>
                  </div>
                  <div class="bg-amber-100/70 border border-amber-300 rounded-xl px-3 py-2">
                    <div class="text-[10px] font-bold text-amber-900 uppercase">Efectiv.</div>
                    <div class="text-sm sm:text-base font-extrabold text-amber-950">${champ.stats.winRate}%</div>
                  </div>
                </div>
              </div>

              <div class="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div class="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-3 flex items-center justify-between">
                    <span>📅 Campaña en Fase Regular (${champ.leagueCampaign.length} partidos)</span>
                  </div>
                  ${champ.leagueCampaign.length === 0 ? `
                    <p class="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">Sin partidos registrados en fase regular.</p>
                  ` : `
                    <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      ${champ.leagueCampaign.map(m => `
                        <div class="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50">
                          <div class="min-w-0">
                            <span class="font-bold text-slate-400 mr-1.5">${escapeHTML(m.stageLabel)}:</span>
                            <span class="font-bold text-slate-800">vs ${escapeHTML(m.rivalName)}</span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <span class="font-extrabold px-2 py-0.5 rounded ${m.won ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}">
                              ${m.won ? 'G' : 'P'} · ${escapeHTML(m.scoreText)}
                            </span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>

                <div>
                  <div class="text-xs font-extrabold uppercase tracking-wider text-amber-800 mb-3 flex items-center justify-between">
                    <span>🏆 Camino en Playoffs (${champ.playoffCampaign.length} llaves)</span>
                  </div>
                  ${champ.playoffCampaign.length === 0 ? `
                    <p class="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">Sin llaves registradas.</p>
                  ` : `
                    <div class="divide-y divide-amber-100 border border-amber-200 rounded-xl overflow-hidden text-xs bg-amber-50/20">
                      ${champ.playoffCampaign.map(m => `
                        <div class="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-amber-50/50">
                          <div class="min-w-0">
                            <span class="font-extrabold text-amber-900 mr-1.5">${escapeHTML(m.stageLabel)}:</span>
                            <span class="font-bold text-slate-800">vs ${escapeHTML(m.rivalName)}</span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <span class="font-extrabold px-2 py-0.5 rounded bg-court-900 text-tennis-400">
                              ${escapeHTML(m.scoreText)}
                            </span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderStandingsTableBlock(cat, standings, titleLabel, isGroupMode = false) {
  const total = standings.length;
  const poMode = cat.playoffMode || 'top7';

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base sm:text-lg font-extrabold text-slate-900">${escapeHTML(titleLabel)}</h2>
          <p class="text-xs text-slate-500">Gana 2-0: <strong>5 pts</strong> · Gana 2-1: <strong>4 pts</strong> · Pierde 1-2: <strong>2 pts</strong> · Pierde 0-2: <strong>1 pt</strong> · W.O.: <strong class="text-rose-600">0 pts</strong></p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs font-semibold">
          ${isGroupMode
            ? `<span class="flex items-center gap-1.5 text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200"><span class="w-2 h-2 rounded-full bg-sky-500"></span> Clasifican Top 4 del Grupo a Cuartos</span>`
            : poMode === 'top6'
            ? `<span class="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> 1° y 2° a Semis · 3° al 6° Cuartos</span>`
            : poMode === 'top8'
            ? `<span class="flex items-center gap-1.5 text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200"><span class="w-2 h-2 rounded-full bg-sky-500"></span> Top 8 a Cuartos de Final</span>`
            : `<span class="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> 1° a Semis · 2° al 7° Cuartos</span>`
          }
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
              <th class="py-3 px-4 w-12 text-center">Pos</th>
              <th class="py-3 px-4">Pareja</th>
              <th class="py-3 px-3 text-center">PJ</th>
              <th class="py-3 px-3 text-center">PG</th>
              <th class="py-3 px-3 text-center">PP</th>
              <th class="py-3 px-3 text-center">W.O.</th>
              <th class="py-3 px-3 text-center">Sets</th>
              <th class="py-3 px-3 text-center">Dif S</th>
              <th class="py-3 px-3 text-center">Games</th>
              <th class="py-3 px-3 text-center">Dif G</th>
              <th class="py-3 px-4 text-center bg-slate-100/80 text-slate-800">PTS</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            ${standings.map((row, idx) => {
              const pos = idx + 1;
              const ds = row.sf - row.sc;
              const dg = row.gf - row.gc;

              let rowAccent = 'border-l-4 border-l-transparent';
              let badges = '';

              if (isGroupMode) {
                if (pos <= 4) {
                  rowAccent = 'border-l-4 border-l-sky-500';
                  badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Cuartos</span>';
                }
              } else {
                if (poMode === 'top6') {
                  if (pos <= 2) {
                    rowAccent = 'border-l-4 border-l-indigo-500 bg-indigo-50/15';
                    badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Semis Directo</span>';
                  } else if (pos <= 6) {
                    rowAccent = 'border-l-4 border-l-sky-500';
                    badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Cuartos</span>';
                  }
                } else if (poMode === 'top8') {
                  if (pos <= 8) {
                    rowAccent = 'border-l-4 border-l-sky-500';
                    badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Cuartos</span>';
                  }
                } else {
                  if (pos === 1) {
                    rowAccent = 'border-l-4 border-l-indigo-500 bg-indigo-50/15';
                    badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Semis Directo</span>';
                  } else if (pos >= 2 && pos <= 7) {
                    rowAccent = 'border-l-4 border-l-sky-500';
                    badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Cuartos</span>';
                  }
                }

                if (cat.promoteCount > 0 && pos <= cat.promoteCount) {
                  badges += '<span class="ml-1.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">▲ Sube</span>';
                }
                if (cat.relegateCount > 0 && pos > total - cat.relegateCount) {
                  rowAccent = 'border-l-4 border-l-rose-500 bg-rose-50/20';
                  badges += '<span class="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">▼ Baja</span>';
                }
              }

              return `
                <tr class="hover:bg-slate-50/80 transition ${rowAccent}">
                  <td class="py-3 px-4 text-center font-extrabold text-slate-700">${pos}</td>
                  <td class="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">${escapeHTML(row.name)} ${badges}</td>
                  <td class="py-3 px-3 text-center text-slate-600">${row.pj}</td>
                  <td class="py-3 px-3 text-center font-semibold text-emerald-600">${row.pg}</td>
                  <td class="py-3 px-3 text-center text-rose-500">${row.pp}</td>
                  <td class="py-3 px-3 text-center text-xs font-bold ${row.wo > 0 ? 'text-rose-600' : 'text-slate-300'}">${row.wo}</td>
                  <td class="py-3 px-3 text-center text-slate-600">${row.sf}-${row.sc}</td>
                  <td class="py-3 px-3 text-center font-semibold ${ds >= 0 ? 'text-slate-700' : 'text-rose-500'}">${ds > 0 ? '+'+ds : ds}</td>
                  <td class="py-3 px-3 text-center text-slate-600">${row.gf}-${row.gc}</td>
                  <td class="py-3 px-3 text-center font-semibold ${dg >= 0 ? 'text-slate-700' : 'text-rose-500'}">${dg > 0 ? '+'+dg : dg}</td>
                  <td class="py-3 px-4 text-center font-extrabold text-base bg-slate-50 text-court-900">${row.pts}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderStandingsView(cat) {
  const seasonSuffix = isViewingArchive() ? ` (Temporada ${state.viewedSeason})` : '';
  if (cat.leagueMode === 'two_groups') {
    const stA = computeStandings(cat, 'A');
    const stB = computeStandings(cat, 'B');
    return `
      <div class="space-y-6">
        ${renderStandingsTableBlock(cat, stA, `Grupo A — ${cat.name}${seasonSuffix}`, true)}
        ${renderStandingsTableBlock(cat, stB, `Grupo B — ${cat.name}${seasonSuffix}`, true)}
      </div>
    `;
  }
  const stAll = computeStandings(cat);
  return renderStandingsTableBlock(cat, stAll, `Clasificación General — ${cat.name}${seasonSuffix}`, false);
}

function renderMatchCard(cat, m, showCategoryBadge = false) {
  const nameA = getTeamName(cat, m.teamAId);
  const nameB = getTeamName(cat, m.teamBId);
  const res = evaluateMatchResult(m);
  const winA = res && res.winner === 'A';
  const winB = res && res.winner === 'B';
  const isDelayed = Boolean(m.delayed && !m.played);
  const archivedMode = isViewingArchive();

  const formatSnapshotLineup = (pIds) => {
    if (!Array.isArray(pIds) || !pIds.length) return '';
    const names = pIds.map(id => {
      const p = getPlayerById(id);
      return p ? p.name.trim().split(/\s+/).slice(-1)[0] : '';
    }).filter(Boolean);
    return names.length ? `(${names.join(' / ')})` : '';
  };

  const lineupA = m.played && Array.isArray(m.playersA) ? formatSnapshotLineup(m.playersA) : '';
  const lineupB = m.played && Array.isArray(m.playersB) ? formatSnapshotLineup(m.playersB) : '';

  const cardBorder = m.played
    ? 'border-slate-200'
    : isDelayed
    ? 'border-orange-300 bg-orange-50/20'
    : 'border-dashed border-slate-300';

  return `
    <div class="bg-white rounded-2xl border ${cardBorder} p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 uppercase mb-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${showCategoryBadge ? `<span class="bg-court-900 text-tennis-400 px-2 py-0.5 rounded">${escapeHTML(cat.name)}</span>` : ''}
            ${m.group ? `<span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">${escapeHTML(m.group)}</span>` : ''}
            <span class="text-court-800 bg-slate-100 px-2 py-0.5 rounded">${escapeHTML(m.dateLabel)}${m.customDate ? ' ('+escapeHTML(m.customDate)+')' : ''} · ${escapeHTML(m.time)} hrs</span>
          </div>
          <span class="text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded shrink-0">${escapeHTML(m.court)}</span>
        </div>

        ${isDelayed ? `
          <div class="mb-3 px-2.5 py-1.5 rounded-lg bg-orange-100/80 border border-orange-200 text-orange-900 text-[11px] font-semibold">
            ⏳ Partido Retrasado${m.delayedNote ? ': ' + escapeHTML(m.delayedNote) : ''}
          </div>
        ` : ''}

        <div class="space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm truncate ${winA ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}">${escapeHTML(nameA)} ${winA ? '🏆' : ''}</span>
                ${res && res.absent === 'A' ? '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">Ausente</span>' : ''}
              </div>
              ${lineupA && lineupA !== `(${nameA})` ? `<div class="text-[10px] text-slate-400 truncate">Jugaron: ${escapeHTML(lineupA)}</div>` : ''}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${res ? `<span class="text-[11px] font-bold px-1.5 py-0.5 rounded ${res.ptsA >= 4 ? 'bg-emerald-100 text-emerald-700' : res.ptsA === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">+${res.ptsA} pts</span>` : ''}
              ${m.played ? m.sets.map(s => `<span class="w-6 h-6 rounded flex items-center justify-center text-xs font-extrabold ${s[0] > s[1] ? 'bg-tennis-400 text-court-900' : 'bg-slate-100 text-slate-500'}">${s[0]}</span>`).join('') : '<span class="text-xs text-slate-300 font-bold">-</span>'}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm truncate ${winB ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}">${escapeHTML(nameB)} ${winB ? '🏆' : ''}</span>
                ${res && res.absent === 'B' ? '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">Ausente</span>' : ''}
              </div>
              ${lineupB && lineupB !== `(${nameB})` ? `<div class="text-[10px] text-slate-400 truncate">Jugaron: ${escapeHTML(lineupB)}</div>` : ''}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${res ? `<span class="text-[11px] font-bold px-1.5 py-0.5 rounded ${res.ptsB >= 4 ? 'bg-emerald-100 text-emerald-700' : res.ptsB === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">+${res.ptsB} pts</span>` : ''}
              ${m.played ? m.sets.map(s => `<span class="w-6 h-6 rounded flex items-center justify-center text-xs font-extrabold ${s[1] > s[0] ? 'bg-tennis-400 text-court-900' : 'bg-slate-100 text-slate-500'}">${s[1]}</span>`).join('') : '<span class="text-xs text-slate-300 font-bold">-</span>'}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold ${m.played ? (res && res.isWO ? 'text-amber-600' : 'text-emerald-600') : isDelayed ? 'text-orange-600' : 'text-slate-500'}">
          ${m.played ? (res && res.isWO ? '● Finalizado (W.O.)' : '● Finalizado') : isDelayed ? '⏳ Retrasado' : '○ Programado'}
        </span>
        ${!archivedMode ? `
          <div class="flex items-center gap-1.5">
            ${!m.played ? `
              <button type="button" onclick="toggleQuickDelay('${cat.id}', '${m.id}')" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border ${isDelayed ? 'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-orange-50 hover:text-orange-700'} transition">
                ${isDelayed ? 'Reanudar' : '⏳ Retrasar'}
              </button>
            ` : ''}
            <button type="button" onclick="openMatchModal('${m.id}', '${cat.id}')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-court-700 text-white transition">
              ${m.played ? 'Editar' : 'Gestionar / Anotar'}
            </button>
          </div>
        ` : '<span class="text-[11px] text-slate-400 font-semibold">Archivo</span>'}
      </div>
    </div>
  `;
}

function renderFixturesView(cat) {
  const rounds = [...new Set(cat.matches.map(m => m.round))].sort((a,b) => a - b);
  const filtered = state.selectedRound === 'all'
    ? cat.matches
    : cat.matches.filter(m => String(m.round) === String(state.selectedRound));

  return `
    <div class="space-y-4">
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button type="button" onclick="setRoundFilter('all')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.selectedRound === 'all' ? 'bg-court-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas las Fechas</button>
          ${rounds.map(r => `
            <button type="button" onclick="setRoundFilter('${r}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${String(state.selectedRound) === String(r) ? 'bg-court-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Fecha ${r}</button>
          `).join('')}
        </div>
        <span class="text-xs text-slate-500 font-medium">Canchas 1 a 4 · Turnos 19:30 o 21:00 hrs</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${filtered.map(m => renderMatchCard(cat, m, false)).join('')}
      </div>
    </div>
  `;
}

function renderDelayedView() {
  const allDelayed = [];
  getDisplayedCategories().forEach(cat => {
    cat.matches.forEach(m => {
      if (m.delayed && !m.played) allDelayed.push({ cat, match: m });
    });
  });

  return `
    <div class="space-y-5">
      <div class="bg-white p-5 rounded-2xl border border-orange-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span>⏳ Partidos Retrasados y Pendientes de Reprogramación</span>
            <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">${allDelayed.length}</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Encuentros postergados de <strong>todas las categorías</strong> para reasignar cancha (1 a 4), turno (19:30 o 21:00) o anotar resultado.</p>
        </div>
      </div>

      ${allDelayed.length === 0 ? `
        <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div class="text-4xl mb-2">🎉</div>
          <h3 class="text-base font-extrabold text-slate-800">¡No hay partidos retrasados!</h3>
          <p class="text-xs text-slate-500 mt-1">Todos los encuentros están al día.</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${allDelayed.map(item => renderMatchCard(item.cat, item.match, true)).join('')}
        </div>
      `}
    </div>
  `;
}

function renderPlayoffsView(cat) {
  const po = ensurePlayoffBracket(cat);
  const archivedMode = isViewingArchive();
  const mode = po.mode;

  const renderPoCard = (stage, matchObj, titleText, borderClass = 'border-slate-200 bg-white', headerTextClass = 'text-slate-500', highlightClass = 'bg-tennis-400/20 border-tennis-500') => {
    const nameA = getTeamName(cat, matchObj.teamA);
    const nameB = getTeamName(cat, matchObj.teamB);
    const winA = matchObj.teamA && matchObj.winner === matchObj.teamA;
    const winB = matchObj.teamB && matchObj.winner === matchObj.teamB;
    const hasSets = matchObj.sets && matchObj.sets.length > 0;
    const hasDecision = Boolean(matchObj.winner || hasSets || matchObj.woAbsent);

    return `
      <div class="border ${borderClass} rounded-2xl p-4 space-y-2.5 shadow-sm">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-[11px] font-extrabold uppercase ${headerTextClass}">${escapeHTML(titleText)}</span>
          <div class="flex items-center gap-1.5 text-[10px] font-bold">
            <span class="bg-slate-100 text-court-900 px-2 py-0.5 rounded">${matchObj.customDate ? escapeHTML(matchObj.customDate) + ' · ' : ''}${escapeHTML(matchObj.time || '19:30')} hrs</span>
            <span class="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded">${escapeHTML(matchObj.court || 'Cancha 1')}</span>
          </div>
        </div>

        <div class="flex items-center justify-between p-2.5 rounded-xl border ${winA ? highlightClass + ' font-extrabold' : 'bg-slate-50 border-slate-200'}">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-court-900 text-white shrink-0">${escapeHTML(matchObj.labelA || 'A')}</span>
            <span class="text-xs sm:text-sm truncate ${!matchObj.teamA ? 'text-slate-400 italic' : ''}">${escapeHTML(nameA)} ${winA ? '🏆' : ''}</span>
            ${matchObj.woAbsent === 'A' ? '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">W.O.</span>' : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2">
            ${hasSets ? matchObj.sets.map(s => `<span class="w-5 h-5 rounded flex items-center justify-center text-[11px] font-extrabold ${s[0] > s[1] ? 'bg-tennis-400 text-court-900' : 'bg-slate-200/80 text-slate-600'}">${s[0]}</span>`).join('') : ''}
            ${matchObj.teamA && !archivedMode && !hasSets ? `
              <button type="button" onclick="advancePlayoff('${stage}', '${matchObj.teamA}')" title="Avanzar directo sin marcador" class="text-[10px] font-bold px-2 py-1 rounded-lg ${winA ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 hover:bg-court-900 hover:text-white'} transition">
                ${winA ? 'Ganador ✓' : 'Avanzar'}
              </button>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center justify-between p-2.5 rounded-xl border ${winB ? highlightClass + ' font-extrabold' : 'bg-slate-50 border-slate-200'}">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-court-900 text-white shrink-0">${escapeHTML(matchObj.labelB || 'B')}</span>
            <span class="text-xs sm:text-sm truncate ${!matchObj.teamB ? 'text-slate-400 italic' : ''}">${escapeHTML(nameB)} ${winB ? '🏆' : ''}</span>
            ${matchObj.woAbsent === 'B' ? '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">W.O.</span>' : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2">
            ${hasSets ? matchObj.sets.map(s => `<span class="w-5 h-5 rounded flex items-center justify-center text-[11px] font-extrabold ${s[1] > s[0] ? 'bg-tennis-400 text-court-900' : 'bg-slate-200/80 text-slate-600'}">${s[1]}</span>`).join('') : ''}
            ${matchObj.teamB && !archivedMode && !hasSets ? `
              <button type="button" onclick="advancePlayoff('${stage}', '${matchObj.teamB}')" title="Avanzar directo sin marcador" class="text-[10px] font-bold px-2 py-1 rounded-lg ${winB ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 hover:bg-court-900 hover:text-white'} transition">
                ${winB ? 'Ganador ✓' : 'Avanzar'}
              </button>
            ` : ''}
          </div>
        </div>

        ${!archivedMode ? `
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button type="button" onclick="openPlayoffModal('${stage}')" class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-court-700 text-white transition">
              📝 Resultado / Cancha
            </button>
            ${hasDecision ? `
              <button type="button" onclick="resetPlayoffStage('${stage}')" class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
                ↩ Deshacer
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  const championId = po.final?.winner || null;
  const runnerUpId = championId ? (po.final.teamA === championId ? po.final.teamB : po.final.teamA) : null;
  const thirdId = po.thirdPlace?.winner || null;
  const fourthId = thirdId ? (po.thirdPlace.teamA === thirdId ? po.thirdPlace.teamB : po.thirdPlace.teamA) : null;
  const displayedSeasonNum = archivedMode ? state.viewedSeason : state.season;

  const subtitle = cat.leagueMode === 'two_groups'
    ? 'Cruces de Cuartos entre Grupo A y Grupo B (1°A vs 4°B, 2°B vs 3°A, 1°B vs 4°A, 2°A vs 3°B).'
    : mode === 'top6'
    ? 'Top 6: 1° y 2° directo a Semis · Cuartos: 3° vs 6° y 4° vs 5°.'
    : mode === 'top8'
    ? 'Top 8: Cuartos directos (1° vs 8°, 4° vs 5°, 2° vs 7°, 3° vs 6°).'
    : 'Top 7: 1° directo a Semis (vs Ganador 4°/5°) · Cuartos: 2° vs 7°, 3° vs 6° y 4° vs 5°.';

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 class="text-lg font-extrabold text-slate-900">Fase Eliminatoria (${mode.toUpperCase()}) — ${escapeHTML(cat.name)}</h2>
            <p class="text-xs text-slate-500">${subtitle} Al definir al ganador de la Gran Final, pasará automáticamente al <strong>👑 Salón de la Fama</strong>.</p>
          </div>
          ${!archivedMode ? `
            <button type="button" onclick="syncPlayoffsFromStandings()" class="px-4 py-2 rounded-xl bg-court-900 hover:bg-court-800 text-white text-xs font-bold shadow transition">
              🔄 Cargar Clasificados desde Tabla
            </button>
          ` : ''}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-start">
          <div class="space-y-4">
            <div class="text-xs font-extrabold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200">1. Cuartos de Final</div>
            ${['qf1', 'qf2', 'qf3', 'qf4'].filter(k => po[k]).map((k, idx) =>
              renderPoCard(k, po[k], `Cuartos ${idx + 1} (${po[k].labelA} vs ${po[k].labelB})`)
            ).join('')}
          </div>

          <div class="space-y-4">
            <div class="text-xs font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">2. Semifinales</div>
            ${renderPoCard('sf1', po.sf1, 'Semifinal 1', 'border-indigo-200 bg-indigo-50/20', 'text-indigo-600')}
            ${renderPoCard('sf2', po.sf2, 'Semifinal 2', 'border-indigo-200 bg-indigo-50/20', 'text-indigo-600')}
          </div>

          <div class="space-y-4">
            <div class="text-xs font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">3. Definiciones de Podio</div>
            ${renderPoCard('final', po.final, '🏆 Gran Final (1° y 2° Lugar)', 'border-2 border-court-900 bg-slate-50/70', 'text-court-900')}
            ${renderPoCard('thirdPlace', po.thirdPlace, '🥉 Definición 3er y 4to Lugar', 'border-amber-300 bg-amber-50/30', 'text-amber-800', 'bg-amber-200/50 border-amber-500')}
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-r from-court-900 via-court-800 to-court-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg">
        <div class="text-xs uppercase tracking-widest text-tennis-400 font-extrabold mb-4">Cuadro de Honor — ${escapeHTML(cat.name)} (Temporada ${displayedSeasonNum})</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="bg-white/10 border border-tennis-400/40 rounded-xl p-3.5">
            <div class="text-xs font-bold text-tennis-400">🥇 1° Lugar (Campeón)</div>
            <div class="text-base font-extrabold mt-1 truncate">${escapeHTML(getTeamName(cat, championId))}</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div class="text-xs font-bold text-slate-300">🥈 2° Lugar (Subcampeón)</div>
            <div class="text-base font-extrabold mt-1 truncate">${escapeHTML(getTeamName(cat, runnerUpId))}</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div class="text-xs font-bold text-amber-400">🥉 3° Lugar</div>
            <div class="text-base font-extrabold mt-1 truncate">${escapeHTML(getTeamName(cat, thirdId))}</div>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div class="text-xs font-bold text-slate-400">4° Lugar</div>
            <div class="text-base font-extrabold mt-1 truncate">${escapeHTML(getTeamName(cat, fourthId))}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPlayersView() {
  const q = (state.playerSearch || '').toLowerCase().trim();
  const { byId } = computeIndividualRankings();
  const sortBy = state.playerSortBy || 'points';

  const filteredPlayers = (state.players || [])
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.side || '').toLowerCase().includes(q) ||
      (p.racket || '').toLowerCase().includes(q)
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const rA = byId[a.id]?.points || 0;
      const rB = byId[b.id]?.points || 0;
      return rB - rA || a.name.localeCompare(b.name);
    });

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 class="text-base font-extrabold text-slate-900">📝 Inscripción Individual al Pool de Jugadores</h2>
        <p class="text-xs text-slate-500 mt-0.5 mb-4">Inscribe jugadores nuevos (parten con <strong>0 pts</strong> hasta que se asignen a una categoría). Al ingresar a una división reciben el piso base de esa categoría y suman rendimiento solo en los partidos que jueguen.</p>

        <form onsubmit="registerIndividualPlayer(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div class="lg:col-span-2">
            <label class="block font-bold text-slate-600 mb-1">Nombre y Apellido *</label>
            <input type="text" id="regPlayerName" required placeholder="Ej: Matías Fernández" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-tennis-500 focus:outline-none">
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Posición</label>
            <select id="regPlayerSide" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
              <option value="Drive">Drive (Derecha)</option>
              <option value="Revés">Revés (Izquierda)</option>
              <option value="Ambos lados">Ambos lados</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Mano Hábil</label>
            <select id="regPlayerHand" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
              <option value="Diestro">Diestro</option>
              <option value="Zurdo">Zurdo</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Teléfono / WhatsApp</label>
            <input type="text" id="regPlayerPhone" placeholder="+56 9 ..." class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold">
          </div>
          <div class="flex items-end">
            <button type="submit" class="w-full py-2 px-4 rounded-xl bg-court-900 hover:bg-court-800 text-white font-bold shadow transition">
              + Inscribir Jugador
            </button>
          </div>
        </form>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-extrabold text-slate-900">Ranking y Pool de Jugadores (${filteredPlayers.length})</h3>
            <p class="text-xs text-slate-500">Piso base + rendimiento propio: <strong>Honor 120 pts (×1.6)</strong> · <strong>Ascenso 75 pts (×1.3)</strong> · <strong>4ta 40 pts (×1.1)</strong> · <strong>5ta 15 pts (×1.0)</strong>.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button type="button" onclick="setPlayerSort('points')" class="px-2.5 py-1 rounded-lg transition ${sortBy === 'points' ? 'bg-court-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">⭐ Por Ranking</button>
              <button type="button" onclick="setPlayerSort('name')" class="px-2.5 py-1 rounded-lg transition ${sortBy === 'name' ? 'bg-court-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">🔤 A-Z</button>
            </div>
            <input type="text" value="${escapeHTML(state.playerSearch || '')}" oninput="filterPlayers(this.value)" placeholder="🔍 Buscar jugador..." class="w-full sm:w-60 text-xs border border-slate-300 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-tennis-500 focus:outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${filteredPlayers.map(p => {
            const assign = getPlayerAssignmentInfo(p.id);
            const rankInfo = byId[p.id] || { rank: '-', points: 0, basePoints: 0, earnedPoints: 0 };
            const initials = p.name.trim().split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
            const photoCount = (p.photos || []).length;
            return `
              <div class="border border-slate-200 rounded-2xl p-4 hover:shadow-md transition flex flex-col justify-between bg-slate-50/40 relative">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200/70">
                    <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-court-900 text-tennis-400">
                      #${rankInfo.rank} Ranking
                    </span>
                    <span title="Base: ${rankInfo.basePoints} pts + Ganados: ${rankInfo.earnedPoints} pts" class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      ⭐ ${rankInfo.points} pts
                    </span>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-court-900 text-tennis-400 font-extrabold flex items-center justify-center text-sm shrink-0 overflow-hidden border border-slate-300">
                      ${p.avatar ? `<img src="${p.avatar}" alt="${escapeHTML(p.name)}" class="w-full h-full object-cover">` : escapeHTML(initials)}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="font-extrabold text-sm text-slate-900 truncate">${escapeHTML(p.name)}</h4>
                      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">${escapeHTML(p.side)}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">${escapeHTML(p.hand)}</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 space-y-1 text-xs text-slate-600">
                    <div>📊 <strong>Desglose:</strong> Base ${rankInfo.basePoints} + Cancha ${rankInfo.earnedPoints} pts</div>
                    <div>🎾 <strong>Paleta:</strong> ${escapeHTML(p.racket || 'No especificada')}</div>
                    <div class="pt-1">
                      ${assign
                        ? `<span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">✅ ${escapeHTML(assign.categoryName)} · ${escapeHTML(assign.teamName)}</span>`
                        : `<span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">⏳ Disponible (Sin pareja asignada)</span>`
                      }
                    </div>
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-1.5">
                  <button type="button" onclick="openEditPlayerModal('${p.id}')" class="py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shrink-0" title="Editar datos y fotos">
                    ✏️ Editar
                  </button>
                  <button type="button" onclick="openPlayerProfile('${p.id}')" class="flex-1 py-1.5 px-2.5 rounded-lg bg-court-900 hover:bg-court-800 text-white text-xs font-bold transition text-center truncate">
                    👤 Fotos (${photoCount})
                  </button>
                  <button type="button" onclick="handleDeletePlayer(this, '${p.id}')" title="Borrar perfil" aria-label="Borrar perfil" class="py-1.5 px-2.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition shrink-0">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}


function renderPromotionsView() {
  const archivedMode = isViewingArchive();
  const cats = getDisplayedCategories();
  const seasonNum = archivedMode ? state.viewedSeason : state.season;

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900">Movilidad entre Categorías (Ascensos y Descensos)</h2>
          <p class="text-xs text-slate-500">
            ${archivedMode
              ? `Resultados finales registrados en la Temporada ${seasonNum}.`
              : `Al cerrar la Temporada ${seasonNum}, se archivará una copia completa (incluyendo campeones y campañas) y se iniciará la Temporada ${seasonNum + 1}.`
            }
          </p>
        </div>
        ${!archivedMode ? `
          <button type="button" onclick="handleSeasonRollover(this)" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow transition">
            🚀 Cerrar Temporada ${state.season} e Iniciar Temporada ${state.season + 1}
          </button>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${cats.map((cat, idx) => {
          const st = computeStandings(cat);
          const ascending = cat.promoteCount > 0 ? st.slice(0, cat.promoteCount) : [];
          const descending = cat.relegateCount > 0 ? st.slice(-cat.relegateCount) : [];
          const upperCat = idx > 0 ? cats[idx - 1].name : null;
          const lowerCat = idx < cats.length - 1 ? cats[idx + 1].name : null;

          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-base text-slate-900">${escapeHTML(cat.name)}</h3>
                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${st.length} parejas</span>
              </div>

              <div>
                <div class="text-xs font-bold text-emerald-700 uppercase mb-1.5">
                  ▲ Zona de Ascenso ${upperCat ? `(Suben a ${escapeHTML(upperCat)})` : '(Categoría Máxima)'}
                </div>
                ${ascending.length ? ascending.map((t, i) => `
                  <div class="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-emerald-50/70 text-emerald-950 font-semibold mb-1">
                    <span>${i+1}° ${escapeHTML(t.name)}</span>
                    <span class="text-xs font-bold">${t.pts} pts</span>
                  </div>
                `).join('') : '<p class="text-xs text-slate-400 italic">No hay ascensos desde esta categoría.</p>'}
              </div>

              <div>
                <div class="text-xs font-bold text-rose-700 uppercase mb-1.5">
                  ▼ Zona de Descenso ${lowerCat ? `(Bajan a ${escapeHTML(lowerCat)})` : '(Categoría Base)'}
                </div>
                ${descending.length ? descending.map((t, i) => `
                  <div class="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-rose-50/70 text-rose-950 font-semibold mb-1">
                    <span>${st.length - descending.length + i + 1}° ${escapeHTML(t.name)}</span>
                    <span class="text-xs font-bold">${t.pts} pts</span>
                  </div>
                `).join('') : '<p class="text-xs text-slate-400 italic">No hay descensos en esta categoría.</p>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderAdminView(cat) {
  if (isViewingArchive()) {
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h3 class="text-base font-extrabold text-slate-800">Gestión deshabilitada en Modo Archivo</h3>
        <p class="text-xs text-slate-500 mt-1">Vuelve a la Temporada Actual en el selector superior para armar parejas o cambiar formatos.</p>
      </div>
    `;
  }

  const { list: rankedPlayers, byId } = computeIndividualRankings();
  const rec = getRecommendedFormat(cat.teams.length);

  return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
        <div>
          <h2 class="text-base font-extrabold text-slate-900">🤝 Armar Pareja desde el Pool — ${escapeHTML(cat.name)}</h2>
          <p class="text-xs text-slate-500 mt-0.5">Selecciona dos jugadores inscritos. El sistema suma sus puntajes individuales (base + cancha) para calcular el arrastre y sugerir categoría.</p>
        </div>

        <form onsubmit="createPairFromPool(event)" class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block font-bold text-slate-600 mb-1">Jugador 1</label>
              <select id="poolPlayer1" onchange="updatePairBuilderPreview()" required class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
                <option value="">-- Seleccionar Jugador 1 --</option>
                ${rankedPlayers.map(r => {
                  const p = getPlayerById(r.playerId);
                  const asg = getPlayerAssignmentInfo(r.playerId);
                  return `<option value="${r.playerId}">${escapeHTML(r.name)} [⭐ ${r.points} pts · ${escapeHTML(p?.side || '')}]${asg ? ' (' + escapeHTML(asg.categoryName) + ')' : ' [Libre]'}</option>`;
                }).join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-600 mb-1">Jugador 2</label>
              <select id="poolPlayer2" onchange="updatePairBuilderPreview()" required class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
                <option value="">-- Seleccionar Jugador 2 --</option>
                ${rankedPlayers.map(r => {
                  const p = getPlayerById(r.playerId);
                  const asg = getPlayerAssignmentInfo(r.playerId);
                  return `<option value="${r.playerId}">${escapeHTML(r.name)} [⭐ ${r.points} pts · ${escapeHTML(p?.side || '')}]${asg ? ' (' + escapeHTML(asg.categoryName) + ')' : ' [Libre]'}</option>`;
                }).join('')}
              </select>
            </div>
          </div>

          <div id="pairSeedingPreview" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"></div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <input type="text" id="customPairLabel" placeholder="Nombre de pareja opcional (ej: Tapia / Coello)" class="flex-1 min-w-[200px] text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white">
            <button type="submit" class="px-4 py-2 rounded-xl bg-court-900 hover:bg-court-800 text-white text-xs font-bold shadow">
              + Crear Pareja en ${escapeHTML(cat.name)}
            </button>
          </div>
        </form>

        <div>
          <h3 class="text-sm font-extrabold text-slate-800 mb-2">Parejas Activas en ${escapeHTML(cat.name)} (${cat.teams.length})</h3>
          <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            ${cat.teams.map((t, idx) => {
              const p1 = getPlayerById(t.player1Id);
              const p2 = getPlayerById(t.player2Id);
              const pts1 = p1 ? (byId[p1.id]?.points || 0) : 0;
              const pts2 = p2 ? (byId[p2.id]?.points || 0) : 0;
              const teamCombinedPts = Math.round((pts1 + pts2) * 10) / 10;
              const subs = t.substitutions || [];
              const lastSub = subs.length ? subs[subs.length - 1] : null;

              return `
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white hover:bg-slate-50">
                  <div class="flex items-center gap-2.5">
                    ${cat.leagueMode === 'two_groups' ? `
                      <button type="button" onclick="toggleTeamGroup('${t.id}')" title="Clic para cambiar entre Grupo A y Grupo B" class="text-[11px] font-extrabold px-2 py-0.5 rounded ${t.group === 'B' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'}">
                        Grp ${t.group || 'A'} ⇄
                      </button>
                    ` : ''}
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-slate-800"><span class="text-slate-400 mr-1.5">#${idx+1}</span>${escapeHTML(t.name)}</span>
                        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">⭐ ${teamCombinedPts} pts</span>
                      </div>
                      ${(p1 || p2) ? `
                        <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          ${p1 ? `<button type="button" onclick="openPlayerProfile('${p1.id}')" class="hover:underline text-sky-700 font-semibold">👤 ${escapeHTML(p1.name)} (${pts1})</button>` : ''}
                          ${p1 && p2 ? '<span>+</span>' : ''}
                          ${p2 ? `<button type="button" onclick="openPlayerProfile('${p2.id}')" class="hover:underline text-sky-700 font-semibold">👤 ${escapeHTML(p2.name)} (${pts2})</button>` : ''}
                        </div>
                      ` : ''}
                      ${lastSub ? `
                        <div class="text-[10px] text-amber-700 font-semibold mt-1">
                          🔄 Reemplazo: salió ${escapeHTML(lastSub.outName)} → entró ${escapeHTML(lastSub.inName)} (a contar de partidos pendientes)
                        </div>
                      ` : ''}
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button type="button" onclick="openSwapPlayerModal('${t.id}')" class="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg transition">🔄 Reemplazar</button>
                    <button type="button" onclick="handleRemoveTeam(this, '${t.id}')" class="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition">Disolver</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
        <div>
          <h3 class="text-base font-extrabold text-slate-900">📐 Modalidad de Fixture y Playoffs</h3>
          <p class="text-xs text-slate-500 mt-0.5">Elige el formato según las <strong>${cat.teams.length} parejas</strong> inscritas.</p>
        </div>

        <div class="bg-tennis-400/15 border border-tennis-500/40 rounded-xl p-3 text-xs space-y-1.5">
          <div class="font-extrabold text-court-900">💡 Recomendado para ${cat.teams.length} parejas:</div>
          <div class="font-bold text-tennis-600">${escapeHTML(rec.title)}</div>
          <p class="text-[11px] text-slate-600 leading-relaxed">${escapeHTML(rec.desc)}</p>
          <button type="button" onclick="applyRecommendedFormat()" class="mt-1 w-full py-1.5 px-3 rounded-lg bg-court-900 hover:bg-court-800 text-tennis-400 text-[11px] font-extrabold transition">
            ✨ Aplicar Formato Recomendado y Generar
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-600 mb-1">1. Fase Regular (Todos vs Todos)</label>
            <select id="adminLeagueMode" onchange="updateCatFormat('leagueMode', this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-white">
              <option value="single" ${cat.leagueMode === 'single' ? 'selected' : ''}>Liga Grupo Único (Todos contra Todos)</option>
              <option value="two_groups" ${cat.leagueMode === 'two_groups' ? 'selected' : ''}>2 Grupos (Zona A y Zona B · Ideal 12-20 parejas)</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-600 mb-1">2. Formato de Playoffs</label>
            <select id="adminPlayoffMode" onchange="updateCatFormat('playoffMode', this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold bg-white" ${cat.leagueMode === 'two_groups' ? 'disabled' : ''}>
              <option value="top6" ${cat.playoffMode === 'top6' ? 'selected' : ''}>Top 6 (1° y 2° a Semis · 3° al 6° Cuartos · Ideal 10-11)</option>
              <option value="top7" ${cat.playoffMode === 'top7' ? 'selected' : ''}>Top 7 (1° a Semis · 2° al 7° Cuartos · Ideal 7-9)</option>
              <option value="top8" ${(cat.playoffMode === 'top8' || cat.leagueMode === 'two_groups') ? 'selected' : ''}>Top 8 (4 Cuartos directos · Ideal 12-20 parejas)</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label class="block font-bold text-slate-600 mb-1">Cupos Ascenso</label>
              <input type="number" min="0" max="4" value="${cat.promoteCount}" onchange="updateCatRule('promoteCount', this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold">
            </div>
            <div>
              <label class="block font-bold text-slate-600 mb-1">Cupos Descenso</label>
              <input type="number" min="0" max="4" value="${cat.relegateCount}" onchange="updateCatRule('relegateCount', this.value)" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-bold">
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 space-y-2.5">
          <button type="button" onclick="handleRegenerateFixture(this)" class="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition">
            🔄 Generar / Actualizar Fixture Actual
          </button>
          <button type="button" onclick="exportData()" class="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition">
            💾 Exportar Respaldo JSON
          </button>
          <label class="block w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold text-center cursor-pointer transition">
            📂 Importar Respaldo JSON
            <input type="file" accept=".json,application/json" onchange="importData(event)" class="hidden">
          </label>
          <button type="button" onclick="handleResetDemo(this)" class="w-full py-2.5 px-4 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold transition">
            ⚠️ Reiniciar Demo
          </button>
        </div>
      </div>
    </div>
  `;
}

function updatePairBuilderPreview() {
  const box = document.getElementById('pairSeedingPreview');
  if (!box) return;
  const p1Id = document.getElementById('poolPlayer1')?.value;
  const p2Id = document.getElementById('poolPlayer2')?.value;

  if (!p1Id && !p2Id) {
    box.innerHTML = `<span class="text-slate-400">Selecciona dos jugadores para calcular su puntaje combinado y categoría sugerida.</span>`;
    return;
  }
  if (p1Id && p2Id && p1Id === p2Id) {
    box.innerHTML = `<span class="text-rose-600 font-bold">⚠️ Selecciona dos jugadores diferentes.</span>`;
    return;
  }

  const { byId } = computeIndividualRankings();
  const info1 = p1Id ? byId[p1Id] : null;
  const info2 = p2Id ? byId[p2Id] : null;
  const pts1 = info1 ? info1.points : 0;
  const pts2 = info2 ? info2.points : 0;
  const total = Math.round((pts1 + pts2) * 10) / 10;

  const seeding = evaluateNewPairSeeding(p1Id, p2Id);

  box.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-slate-700">
        <span>${info1 ? `${escapeHTML(info1.name)} (<strong>${pts1} pts</strong>)` : 'J1 (0 pts)'}</span>
        <span class="mx-1 text-slate-400">+</span>
        <span>${info2 ? `${escapeHTML(info2.name)} (<strong>${pts2} pts</strong>)` : 'J2 (0 pts)'}</span>
        <span class="ml-1.5 font-extrabold text-court-900">= ⭐ ${total} pts combinados</span>
      </div>
      ${(p1Id && p2Id) ? `
        <span class="px-2.5 py-0.5 rounded-full bg-tennis-400/30 border border-tennis-600/30 text-court-900 font-extrabold">
          Sugerencia: ${escapeHTML(seeding.suggestedCategory)}
        </span>
      ` : ''}
    </div>
  `;
}

function renderPlayerPhotosGrid(player) {
  const grid = document.getElementById('profPhotosGrid');
  const photos = player.photos || [];
  if (!photos.length) {
    grid.innerHTML = `<div class="col-span-full text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">Aún no hay fotografías en este perfil. Sube la primera arriba.</div>`;
    return;
  }

  grid.innerHTML = photos.map(ph => `
    <div class="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square">
      <img src="${ph.dataUrl}" alt="Foto jugador" class="w-full h-full object-cover">
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 flex items-center justify-between gap-1">
        <button type="button" onclick="setPlayerAvatar('${player.id}', '${ph.id}')" class="text-[10px] font-bold px-2 py-1 rounded bg-tennis-400 text-court-900 hover:bg-tennis-500">
          ${player.avatar === ph.dataUrl ? '★ Perfil' : 'Usar Perfil'}
        </button>
        <button type="button" onclick="deletePlayerPhoto('${player.id}', '${ph.id}')" class="text-[10px] font-bold px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700">
          Borrar
        </button>
      </div>
    </div>
  `).join('');
}

function scrollNavTabs(amount) {
  const container = document.getElementById('navTabsContainer');
  if (container) {
    container.scrollBy({ left: amount, behavior: 'smooth' });
  }
}

function updateNavScrollButtons() {
  const container = document.getElementById('navTabsContainer');
  const btnLeft = document.getElementById('navScrollLeft');
  const btnRight = document.getElementById('navScrollRight');
  if (!container || !btnLeft || !btnRight) return;

  const maxScroll = container.scrollWidth - container.clientWidth;
  if (container.scrollLeft > 8) {
    btnLeft.classList.remove('hidden');
    btnLeft.classList.add('flex');
  } else {
    btnLeft.classList.add('hidden');
    btnLeft.classList.remove('flex');
  }

  if (maxScroll > 8 && container.scrollLeft < maxScroll - 8) {
    btnRight.classList.remove('hidden');
    btnRight.classList.add('flex');
  } else {
    btnRight.classList.add('hidden');
    btnRight.classList.remove('flex');
  }
}
