if (typeof uid !== 'function') {
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

if (typeof CATEGORY_BASE_POINTS === 'undefined') {
  var CATEGORY_BASE_POINTS = {
    cat_3honor: 120,
    cat_4ta: 40,
    cat_5ta: 15,
    default: 75
  };
}

if (typeof CATEGORY_MULTIPLIERS === 'undefined') {
  var CATEGORY_MULTIPLIERS = {
    cat_3honor: 1.6,
    cat_4ta: 1.1,
    cat_5ta: 1.0,
    default: 1.3
  };
}

if (typeof getTeamPlayerIds !== 'function') {
  function getTeamPlayerIds(category, teamId) {
    if (!category || !teamId || !Array.isArray(category.teams)) return [];
    const team = category.teams.find(t => t.id === teamId);
    if (!team) return [];
    return [team.player1Id, team.player2Id].filter(Boolean);
  }
}

if (typeof getPlayerById !== 'function') {
  function getPlayerById(playerId) {
    if (!playerId || typeof state !== 'object' || !state || !Array.isArray(state.players)) return null;
    return state.players.find(p => p.id === playerId) || null;
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

function getRecommendedFormat(count) {
  if (count <= 9) {
    return {
      leagueMode: 'single',
      playoffMode: 'top7',
      title: 'Liga Única Todos vs Todos + Playoffs Top 7',
      desc: `Con ${count} parejas se juegan ${count % 2 === 0 ? count - 1 : count} fechas en grupo único. El 1° pasa directo a Semis y del 2° al 7° juegan Cuartos.`
    };
  }
  if (count === 10 || count === 11) {
    return {
      leagueMode: 'single',
      playoffMode: 'top6',
      title: 'Liga Única Todos vs Todos + Playoffs Top 6',
      desc: `Con ${count} parejas se juegan ${count % 2 === 0 ? 9 : 11} fechas (5 partidos por fecha). 1° y 2° pasan directo a Semis; 3° vs 6° y 4° vs 5° juegan Cuartos.`
    };
  }
  if (count >= 12 && count <= 14) {
    return {
      leagueMode: 'single',
      playoffMode: 'top8',
      title: 'Liga Única (o 2 Grupos) + Playoffs Top 8',
      desc: `Con ${count} parejas puedes jugar Liga Única (${count % 2 === 0 ? count - 1 : count} fechas) o dividir en 2 Grupos de ${Math.ceil(count/2)} y ${Math.floor(count/2)} con Cuartos de Final Top 8.`
    };
  }
  return {
    leagueMode: 'two_groups',
    playoffMode: 'top8',
    title: `2 Grupos (Zona A: ${Math.ceil(count/2)} / Zona B: ${Math.floor(count/2)}) + Playoffs Top 8`,
    desc: `Ideal para ${count} parejas: todos contra todos dentro de cada zona (7 a 9 fechas) y clasifican los 4 mejores de cada grupo a Cuartos de Final cruzados (1°A vs 4°B, etc.).`
  };
}

function buildRoundRobinSchedule(teamsArray, categoryId, groupLabel = null) {
  const teams = [...teamsArray];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams.push({ id: 'BYE', name: 'LIBRE' });

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const list = [...teams];
  const roundMatches = [];

  for (let r = 0; r < rounds; r++) {
    const currentRoundList = [];
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home.id !== 'BYE' && away.id !== 'BYE') {
        currentRoundList.push({
          round: r + 1,
          group: groupLabel,
          teamAId: r % 2 === 0 ? home.id : away.id,
          teamBId: r % 2 === 0 ? away.id : home.id
        });
      }
    }
    roundMatches.push(currentRoundList);
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list.splice(0, list.length, fixed, ...rest);
  }
  return roundMatches;
}

function generateCategoryMatches(category) {
  const courts = ['Cancha 1', 'Cancha 2', 'Cancha 3', 'Cancha 4'];
  const times = ['19:30', '21:00'];
  const allMatches = [];

  if (category.leagueMode === 'two_groups') {
    category.teams.forEach((t, idx) => {
      if (t.group !== 'A' && t.group !== 'B') {
        t.group = idx % 2 === 0 ? 'A' : 'B';
      }
    });
    let groupA = category.teams.filter(t => t.group === 'A');
    let groupB = category.teams.filter(t => t.group === 'B');
    if (Math.abs(groupA.length - groupB.length) > 1) {
      category.teams.forEach((t, idx) => { t.group = idx % 2 === 0 ? 'A' : 'B'; });
      groupA = category.teams.filter(t => t.group === 'A');
      groupB = category.teams.filter(t => t.group === 'B');
    }

    const roundsA = buildRoundRobinSchedule(groupA, category.id, 'Grupo A');
    const roundsB = buildRoundRobinSchedule(groupB, category.id, 'Grupo B');
    const maxRounds = Math.max(roundsA.length, roundsB.length);

    for (let r = 0; r < maxRounds; r++) {
      const combined = [...(roundsA[r] || []), ...(roundsB[r] || [])];
      combined.forEach((item, idx) => {
        allMatches.push({
          id: uid(`${category.id}_r${r+1}_m${idx+1}`),
          round: r + 1,
          group: item.group,
          dateLabel: `Fecha ${r + 1}`,
          customDate: '',
          time: times[Math.floor(idx / 4) % times.length],
          court: courts[idx % courts.length],
          teamAId: item.teamAId,
          teamBId: item.teamBId,
          playersA: null,
          playersB: null,
          played: false,
          delayed: false,
          delayedNote: '',
          woAbsent: null,
          sets: []
        });
      });
    }
  } else {
    category.teams.forEach(t => { t.group = 'A'; });
    const roundsSingle = buildRoundRobinSchedule(category.teams, category.id, null);
    roundsSingle.forEach((roundList, r) => {
      roundList.forEach((item, idx) => {
        allMatches.push({
          id: uid(`${category.id}_r${r+1}_m${idx+1}`),
          round: r + 1,
          group: null,
          dateLabel: `Fecha ${r + 1}`,
          customDate: '',
          time: times[Math.floor(idx / 4) % times.length],
          court: courts[idx % courts.length],
          teamAId: item.teamAId,
          teamBId: item.teamBId,
          playersA: null,
          playersB: null,
          played: false,
          delayed: false,
          delayedNote: '',
          woAbsent: null,
          sets: []
        });
      });
    });
  }

  return allMatches;
}

function evaluateMatchResult(match) {
  if (!match || !match.played) return null;

  if (match.woAbsent === 'A') {
    return { setsA: 0, setsB: 2, gamesA: 0, gamesB: 12, ptsA: 0, ptsB: 5, winner: 'B', isWO: true, absent: 'A' };
  }
  if (match.woAbsent === 'B') {
    return { setsA: 2, setsB: 0, gamesA: 12, gamesB: 0, ptsA: 5, ptsB: 0, winner: 'A', isWO: true, absent: 'B' };
  }

  if (!match.sets || !match.sets.length) return null;

  let setsA = 0, setsB = 0, gamesA = 0, gamesB = 0;
  match.sets.forEach(([gA, gB]) => {
    gamesA += Number(gA);
    gamesB += Number(gB);
    if (Number(gA) > Number(gB)) setsA++;
    else if (Number(gB) > Number(gA)) setsB++;
  });

  const totalSets = setsA + setsB;
  let ptsA = 0, ptsB = 0, winner = null;

  if (setsA > setsB) {
    winner = 'A';
    if (totalSets === 2) { ptsA = 5; ptsB = 1; }
    else { ptsA = 4; ptsB = 2; }
  } else if (setsB > setsA) {
    winner = 'B';
    if (totalSets === 2) { ptsB = 5; ptsA = 1; }
    else { ptsB = 4; ptsA = 2; }
  }

  return { setsA, setsB, gamesA, gamesB, ptsA, ptsB, winner, isWO: false, absent: null };
}

function computeIndividualRankings() {
  const rankingMap = {};

  (state.players || []).forEach(p => {
    rankingMap[p.id] = {
      playerId: p.id,
      name: p.name,
      basePoints: 0,
      earnedPoints: 0,
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      titles: 0,
      lastCategory: 'Sin categoría'
    };
  });

  const assignBaseFromCategories = (cats, weight = 1.0) => {
    (cats || []).forEach(cat => {
      const catBase = (CATEGORY_BASE_POINTS[cat.id] || 0) * weight;
      (cat.teams || []).forEach(team => {
        [team.player1Id, team.player2Id].forEach(pId => {
          if (!pId || !rankingMap[pId]) return;
          if (catBase > rankingMap[pId].basePoints) {
            rankingMap[pId].basePoints = catBase;
            rankingMap[pId].lastCategory = cat.name;
          }
        });
      });
    });
  };

  (state.archivedSeasons || []).forEach(arch => assignBaseFromCategories(arch.categories, 0.5));
  assignBaseFromCategories(state.categories, 1.0);

  const seasonsToProcess = [
    ...(state.archivedSeasons || []).map(arch => ({
      season: arch.season,
      recencyWeight: 0.5,
      categories: arch.categories
    })),
    {
      season: state.season,
      recencyWeight: 1.0,
      categories: state.categories
    }
  ];

  const addPointsToPlayerIds = (cat, playerIdsList, basePts, isWin, isTitle = false) => {
    if (!playerIdsList || !playerIdsList.length) return;
    const catMult = CATEGORY_MULTIPLIERS[cat.id] || 1.0;

    playerIdsList.forEach(pId => {
      if (!pId || !rankingMap[pId]) return;
      const entry = rankingMap[pId];
      entry.earnedPoints += basePts * catMult;
      entry.matchesPlayed += 1;
      if (isWin) entry.wins += 1;
      if (isTitle) entry.titles += 1;
      if (entry.lastCategory === 'Sin categoría') entry.lastCategory = cat.name;
    });
  };

  seasonsToProcess.forEach(sObj => {
    (sObj.categories || []).forEach(cat => {
      (cat.matches || []).forEach(m => {
        if (!m.played) return;
        const res = evaluateMatchResult(m);
        if (!res) return;

        const pIdsA = Array.isArray(m.playersA) && m.playersA.length ? m.playersA : getTeamPlayerIds(cat, m.teamAId);
        const pIdsB = Array.isArray(m.playersB) && m.playersB.length ? m.playersB : getTeamPlayerIds(cat, m.teamBId);

        addPointsToPlayerIds(cat, pIdsA, res.ptsA * sObj.recencyWeight, res.winner === 'A');
        addPointsToPlayerIds(cat, pIdsB, res.ptsB * sObj.recencyWeight, res.winner === 'B');
      });

      const po = cat.playoffs;
      if (!po) return;

      const getPoWinnerPlayers = (node) => {
        if (!node || !node.winner) return [];
        if (node.winner === node.teamA && Array.isArray(node.playersA) && node.playersA.length) return node.playersA;
        if (node.winner === node.teamB && Array.isArray(node.playersB) && node.playersB.length) return node.playersB;
        return getTeamPlayerIds(cat, node.winner);
      };

      ['qf1', 'qf2', 'qf3', 'qf4'].forEach(k => {
        if (po[k]?.winner) {
          addPointsToPlayerIds(cat, getPoWinnerPlayers(po[k]), 6 * sObj.recencyWeight, true);
        }
      });

      ['sf1', 'sf2'].forEach(k => {
        if (po[k]?.winner) {
          addPointsToPlayerIds(cat, getPoWinnerPlayers(po[k]), 8 * sObj.recencyWeight, true);
        }
      });

      if (po.final?.winner) {
        const champId = po.final.winner;
        const runnerUpId = po.final.teamA === champId ? po.final.teamB : po.final.teamA;
        const champPlayers = getPoWinnerPlayers(po.final);
        const runnerUpPlayers = runnerUpId === po.final.teamA && Array.isArray(po.final.playersA) && po.final.playersA.length
          ? po.final.playersA
          : runnerUpId === po.final.teamB && Array.isArray(po.final.playersB) && po.final.playersB.length
          ? po.final.playersB
          : getTeamPlayerIds(cat, runnerUpId);

        addPointsToPlayerIds(cat, champPlayers, 12 * sObj.recencyWeight, true, true);
        if (runnerUpPlayers.length) {
          addPointsToPlayerIds(cat, runnerUpPlayers, 5 * sObj.recencyWeight, false);
        }
      }
    });
  });

  const sorted = Object.values(rankingMap)
    .map(r => {
      const total = Math.round((r.basePoints + r.earnedPoints) * 10) / 10;
      return {
        ...r,
        basePoints: Math.round(r.basePoints * 10) / 10,
        earnedPoints: Math.round(r.earnedPoints * 10) / 10,
        points: total,
        winRate: r.matchesPlayed ? Math.round((r.wins / r.matchesPlayed) * 100) : 0
      };
    })
    .sort((a, b) => b.points - a.points || b.winRate - a.winRate || a.name.localeCompare(b.name));

  const byId = {};
  sorted.forEach((item, idx) => {
    item.rank = idx + 1;
    byId[item.playerId] = item;
  });

  return { list: sorted, byId };
}

function evaluateNewPairSeeding(player1Id, player2Id) {
  const { byId } = computeIndividualRankings();
  const p1 = byId[player1Id] || { points: 0, name: '' };
  const p2 = byId[player2Id] || { points: 0, name: '' };
  const combinedPoints = Math.round((p1.points + p2.points) * 10) / 10;

  let suggestedCategory = '5ta Categoría';
  if (combinedPoints >= 210) suggestedCategory = '3era de Honor';
  else if (combinedPoints >= 120) suggestedCategory = '3era de Ascenso';
  else if (combinedPoints >= 65) suggestedCategory = '4ta Categoría';

  return {
    p1Points: p1.points,
    p2Points: p2.points,
    combinedPoints,
    suggestedCategory
  };
}

function computeStandings(category, groupFilter = null) {
  const map = {};
  const filteredTeams = groupFilter
    ? category.teams.filter(t => (t.group || 'A') === groupFilter)
    : category.teams;

  filteredTeams.forEach(t => {
    map[t.id] = { id: t.id, name: t.name, group: t.group || 'A', pj: 0, pg: 0, pp: 0, wo: 0, sf: 0, sc: 0, gf: 0, gc: 0, pts: 0 };
  });

  category.matches.forEach(m => {
    if (!m.played) return;
    const tA = map[m.teamAId];
    const tB = map[m.teamBId];
    if (!tA || !tB) return;

    const res = evaluateMatchResult(m);
    if (!res) return;

    tA.pj++; tB.pj++;
    tA.sf += res.setsA; tA.sc += res.setsB;
    tB.sf += res.setsB; tB.sc += res.setsA;
    tA.gf += res.gamesA; tA.gc += res.gamesB;
    tB.gf += res.gamesB; tB.gc += res.gamesA;
    tA.pts += res.ptsA;
    tB.pts += res.ptsB;

    if (res.absent === 'A') tA.wo++;
    if (res.absent === 'B') tB.wo++;

    if (res.winner === 'A') { tA.pg++; tB.pp++; }
    else if (res.winner === 'B') { tB.pg++; tA.pp++; }
  });

  return Object.values(map).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dsA = a.sf - a.sc, dsB = b.sf - b.sc;
    if (dsB !== dsA) return dsB - dsA;
    const dgA = a.gf - a.gc, dgB = b.gf - a.gc;
    if (dgB !== dgA) return dgB - dgA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}

function getAllSeasonChampions() {
  const allSeasons = [
    ...(state.archivedSeasons || []).map(arch => ({
      season: arch.season,
      isCurrent: false,
      closedAt: arch.closedAt || '',
      categories: arch.categories
    })),
    {
      season: state.season,
      isCurrent: true,
      closedAt: 'En curso',
      categories: state.categories
    }
  ];

  const records = [];
  allSeasons.forEach(sObj => {
    (sObj.categories || []).forEach(cat => {
      const champId = cat.playoffs?.final?.winner;
      if (!champId) return;
      const team = cat.teams.find(t => t.id === champId);
      if (!team) return;

      const p1 = getPlayerById(team.player1Id);
      const p2 = getPlayerById(team.player2Id);

      const leagueCampaign = [];
      let pj = 0, pg = 0, pp = 0, sf = 0, sc = 0;

      cat.matches
        .filter(m => m.played && (m.teamAId === champId || m.teamBId === champId))
        .sort((a, b) => a.round - b.round)
        .forEach(m => {
          const isA = m.teamAId === champId;
          const rivalId = isA ? m.teamBId : m.teamAId;
          const rivalName = getTeamName(cat, rivalId);
          const res = evaluateMatchResult(m);
          if (!res) return;

          const won = (isA && res.winner === 'A') || (!isA && res.winner === 'B');
          const mySets = isA ? res.setsA : res.setsB;
          const oppSets = isA ? res.setsB : res.setsA;
          const scoreText = res.isWO
            ? (won ? 'W.O. (Ganado)' : 'W.O. (Perdido)')
            : m.sets.map(s => isA ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`).join(' / ');

          pj++;
          if (won) pg++; else pp++;
          sf += mySets;
          sc += oppSets;

          leagueCampaign.push({
            stageLabel: `${m.dateLabel}${m.group ? ' · ' + m.group : ''}`,
            rivalName,
            won,
            scoreText,
            court: m.court,
            time: m.time
          });
        });

      const playoffCampaign = [];
      const poStageOrder = [
        { key: 'qf1', name: 'Cuartos de Final' },
        { key: 'qf2', name: 'Cuartos de Final' },
        { key: 'qf3', name: 'Cuartos de Final' },
        { key: 'qf4', name: 'Cuartos de Final' },
        { key: 'sf1', name: 'Semifinal' },
        { key: 'sf2', name: 'Semifinal' },
        { key: 'final', name: '🏆 Gran Final' }
      ];

      poStageOrder.forEach(st => {
        const node = cat.playoffs?.[st.key];
        if (!node) return;
        if (node.teamA === champId || node.teamB === champId) {
          const isA = node.teamA === champId;
          const rivalId = isA ? node.teamB : node.teamA;
          const rivalName = getTeamName(cat, rivalId);
          const won = node.winner === champId;
          let scoreText = 'Avance directo';

          if (node.woAbsent) {
            scoreText = 'W.O. (Ganado)';
            pj++; if (won) pg++; else pp++;
            sf += 2;
          } else if (node.sets && node.sets.length) {
            scoreText = node.sets.map(s => isA ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`).join(' / ');
            const res = evaluateMatchResult({ played: true, woAbsent: null, sets: node.sets });
            if (res) {
              pj++; if (won) pg++; else pp++;
              sf += isA ? res.setsA : res.setsB;
              sc += isA ? res.setsB : res.setsA;
            }
          } else if (won) {
            pj++; pg++;
          }

          playoffCampaign.push({
            stageLabel: st.name,
            rivalName,
            won,
            scoreText,
            court: node.court || 'Cancha 1',
            time: node.time || '21:00'
          });
        }
      });

      records.push({
        season: sObj.season,
        isCurrent: sObj.isCurrent,
        closedAt: sObj.closedAt,
        categoryId: cat.id,
        categoryName: cat.name,
        teamId: team.id,
        teamName: team.name,
        p1, p2,
        stats: {
          pj, pg, pp, sf, sc,
          winRate: pj ? Math.round((pg / pj) * 100) : 100
        },
        leagueCampaign,
        playoffCampaign
      });
    });
  });

  return records.sort((a, b) => b.season - a.season);
}

function makePoNode(teamA, teamB, labelA, labelB, court = 'Cancha 1', time = '19:30') {
  return {
    teamA, teamB,
    playersA: null, playersB: null,
    winner: null,
    labelA, labelB,
    court, time, customDate: '',
    sets: [],
    woAbsent: null
  };
}

function buildPlayoffBracketData(cat) {
  const mode = cat.playoffMode || 'top7';
  if (cat.leagueMode === 'two_groups') {
    const stA = computeStandings(cat, 'A');
    const stB = computeStandings(cat, 'B');
    return {
      mode: 'top8',
      qf1: makePoNode(stA[0]?.id || null, stB[3]?.id || null, '1° Grp A', '4° Grp B', 'Cancha 1', '19:30'),
      qf2: makePoNode(stB[1]?.id || null, stA[2]?.id || null, '2° Grp B', '3° Grp A', 'Cancha 2', '19:30'),
      qf3: makePoNode(stB[0]?.id || null, stA[3]?.id || null, '1° Grp B', '4° Grp A', 'Cancha 3', '19:30'),
      qf4: makePoNode(stA[1]?.id || null, stB[2]?.id || null, '2° Grp A', '3° Grp B', 'Cancha 4', '19:30'),
      sf1: makePoNode(null, null, 'Gan. C1', 'Gan. C2', 'Cancha 1', '21:00'),
      sf2: makePoNode(null, null, 'Gan. C3', 'Gan. C4', 'Cancha 2', '21:00'),
      thirdPlace: makePoNode(null, null, 'Perd. SF1', 'Perd. SF2', 'Cancha 2', '19:30'),
      final: makePoNode(null, null, 'Gan. SF1', 'Gan. SF2', 'Cancha 1', '21:00')
    };
  }

  const st = computeStandings(cat);
  if (mode === 'top6') {
    return {
      mode: 'top6',
      qf1: makePoNode(st[2]?.id || null, st[5]?.id || null, '3°', '6°', 'Cancha 1', '19:30'),
      qf2: makePoNode(st[3]?.id || null, st[4]?.id || null, '4°', '5°', 'Cancha 2', '19:30'),
      qf3: null,
      qf4: null,
      sf1: makePoNode(st[0]?.id || null, null, '1° Directo', 'Gan. 4°/5°', 'Cancha 1', '21:00'),
      sf2: makePoNode(st[1]?.id || null, null, '2° Directo', 'Gan. 3°/6°', 'Cancha 2', '21:00'),
      thirdPlace: makePoNode(null, null, 'Perd. SF1', 'Perd. SF2', 'Cancha 2', '19:30'),
      final: makePoNode(null, null, 'Gan. SF1', 'Gan. SF2', 'Cancha 1', '21:00')
    };
  }
  if (mode === 'top8') {
    return {
      mode: 'top8',
      qf1: makePoNode(st[0]?.id || null, st[7]?.id || null, '1°', '8°', 'Cancha 1', '19:30'),
      qf2: makePoNode(st[3]?.id || null, st[4]?.id || null, '4°', '5°', 'Cancha 2', '19:30'),
      qf3: makePoNode(st[1]?.id || null, st[6]?.id || null, '2°', '7°', 'Cancha 3', '19:30'),
      qf4: makePoNode(st[2]?.id || null, st[5]?.id || null, '3°', '6°', 'Cancha 4', '19:30'),
      sf1: makePoNode(null, null, 'Gan. C1', 'Gan. C2', 'Cancha 1', '21:00'),
      sf2: makePoNode(null, null, 'Gan. C3', 'Gan. C4', 'Cancha 2', '21:00'),
      thirdPlace: makePoNode(null, null, 'Perd. SF1', 'Perd. SF2', 'Cancha 2', '19:30'),
      final: makePoNode(null, null, 'Gan. SF1', 'Gan. SF2', 'Cancha 1', '21:00')
    };
  }

  return {
    mode: 'top7',
    qf1: makePoNode(st[1]?.id || null, st[6]?.id || null, '2°', '7°', 'Cancha 1', '19:30'),
    qf2: makePoNode(st[2]?.id || null, st[5]?.id || null, '3°', '6°', 'Cancha 2', '19:30'),
    qf3: makePoNode(st[3]?.id || null, st[4]?.id || null, '4°', '5°', 'Cancha 3', '19:30'),
    qf4: null,
    sf1: makePoNode(st[0]?.id || null, null, '1° Directo', 'Gan. 4°/5°', 'Cancha 1', '21:00'),
    sf2: makePoNode(null, null, 'Gan. 2°/7°', 'Gan. 3°/6°', 'Cancha 2', '21:00'),
    thirdPlace: makePoNode(null, null, 'Perd. SF1', 'Perd. SF2', 'Cancha 2', '19:30'),
    final: makePoNode(null, null, 'Gan. SF1', 'Gan. SF2', 'Cancha 1', '21:00')
  };
}

function ensurePlayoffBracket(cat) {
  const expectedMode = cat.leagueMode === 'two_groups' ? 'top8' : (cat.playoffMode || 'top7');
  if (!cat.playoffs || !cat.playoffs.qf1 || cat.playoffs.mode !== expectedMode) {
    cat.playoffs = buildPlayoffBracketData(cat);
  }
  ['qf1','qf2','qf3','qf4','sf1','sf2','thirdPlace','final'].forEach(k => {
    if (cat.playoffs[k]) {
      if (!cat.playoffs[k].court) cat.playoffs[k].court = 'Cancha 1';
      if (!cat.playoffs[k].time) cat.playoffs[k].time = '19:30';
      if (!cat.playoffs[k].sets) cat.playoffs[k].sets = [];
    }
  });
  return cat.playoffs;
}

function computePlayerCareerStats(playerId) {
  let pj = 0, pg = 0;
  const allSeasonsCats = [
    ...state.categories,
    ...(state.archivedSeasons || []).flatMap(a => a.categories)
  ];
  allSeasonsCats.forEach(cat => {
    cat.matches.forEach(m => {
      if (!m.played) return;
      const res = evaluateMatchResult(m);
      if (!res) return;

      const pIdsA = Array.isArray(m.playersA) && m.playersA.length ? m.playersA : getTeamPlayerIds(cat, m.teamAId);
      const pIdsB = Array.isArray(m.playersB) && m.playersB.length ? m.playersB : getTeamPlayerIds(cat, m.teamBId);

      if (pIdsA.includes(playerId)) {
        pj++;
        if (res.winner === 'A') pg++;
      } else if (pIdsB.includes(playerId)) {
        pj++;
        if (res.winner === 'B') pg++;
      }
    });
  });
  return { pj, pg, winRate: pj ? Math.round((pg / pj) * 100) : 0 };
}
