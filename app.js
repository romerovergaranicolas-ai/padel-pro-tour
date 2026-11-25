window.seasonPointsConfig = {
  retentionFactor: 0.7,
  championBonus: 15,
  finalistBonus: 8,
  semifinalBonus: 4
};

window.__selectedFixtureZone = window.__selectedFixtureZone || 'ALL';

if (typeof showToast !== 'function') {
  function showToast(message, type = 'info') {
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-500 text-slate-950',
      info: 'bg-slate-900 text-white'
    };
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold transition ${colors[type] || colors.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }
}

function fixUndefinedSeasonLabels(seasonNum) {
  const targetNum = Number(seasonNum || state?.seasonNumber || state?.currentSeason || state?.season || 2);
  const cleanLabel = `Temporada ${targetNum}`;
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (typeof node.nodeValue === 'string' && /temporada\s+undefined/i.test(node.nodeValue)) {
      node.nodeValue = node.nodeValue.replace(/temporada\s+undefined/gi, cleanLabel);
    }
  }
}

function setActiveSeasonState(targetState, seasonNum) {
  const num = Math.max(1, Number(seasonNum) || 1);
  const label = `Temporada ${num}`;
  targetState.seasonNumber = num;
  targetState.currentSeason = num;
  targetState.season = num;
  targetState.seasonNum = num;
  targetState.seasonName = label;
  targetState.seasonTitle = label;
  targetState.seasonLabel = label;
  targetState.currentSeasonName = label;
  targetState.activeSeasonName = label;
  targetState.viewingSeasonIndex = null;
  targetState.viewingArchiveId = null;
  targetState.archiveIndex = null;
  targetState.isArchiveView = false;
  targetState.isReadOnly = false;
  targetState.readOnly = false;
}

function validateMatchSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) {
    return { ok: false, msg: 'Debes ingresar al menos un set válido.' };
  }
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const a = Number(Array.isArray(s) ? s[0] : s?.a);
    const b = Number(Array.isArray(s) ? s[1] : s?.b);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0 || a > 25 || b > 25) {
      return { ok: false, msg: `Revisa los valores del set ${i + 1}.` };
    }
    if (a === b) {
      return { ok: false, msg: `El set ${i + 1} no puede terminar empatado.` };
    }
  }
  return { ok: true, msg: '' };
}

function evaluateMatch(sets, teamA, teamB) {
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  (sets || []).forEach(s => {
    const a = Number(Array.isArray(s) ? s[0] : (s?.a ?? 0));
    const b = Number(Array.isArray(s) ? s[1] : (s?.b ?? 0));
    gamesA += a;
    gamesB += b;
    if (a > b) setsA++;
    else if (b > a) setsB++;
  });
  return {
    winnerId: setsA >= setsB ? teamA : teamB,
    loserId: setsA >= setsB ? teamB : teamA,
    setsA,
    setsB,
    gamesA,
    gamesB
  };
}

function computeMatchPointsAward(setsA, setsB, isWO = false) {
  if (isWO) {
    return { winnerPts: 5, loserPts: 0 };
  }
  if (setsA > setsB && setsB === 0) {
    return { winnerPts: 5, loserPts: 1 };
  }
  if (setsA > setsB && setsB > 0) {
    return { winnerPts: 4, loserPts: 2 };
  }
  if (setsB > setsA && setsA === 0) {
    return { winnerPts: 5, loserPts: 1 };
  }
  if (setsB > setsA && setsA > 0) {
    return { winnerPts: 4, loserPts: 2 };
  }
  return { winnerPts: 0, loserPts: 0 };
}

function normalizeWoSets(woAbsent) {
  if (!woAbsent) return null;
  const absentSide = String(woAbsent).trim().toUpperCase();
  return absentSide === 'A' ? [[0, 6], [0, 6]] : [[6, 0], [6, 0]];
}

function classifyMatchSetLength(sets, winnerIsA) {
  const arr = Array.isArray(sets) ? sets : [];
  const count = arr.length;
  const isThreeSets = count >= 3;
  return {
    isThreeSets,
    wonIn3: isThreeSets && winnerIsA,
    lostIn3: isThreeSets && !winnerIsA,
    wonIn2: !isThreeSets && count > 0 && winnerIsA,
    lostIn2: !isThreeSets && count > 0 && !winnerIsA
  };
}

function extractMatchSetsList(match) {
  if (!match) return [];
  if (match.woAbsent) {
    return normalizeWoSets(match.woAbsent) || [];
  }

  const candidate =
    match.sets ??
    match.scores ??
    match.games ??
    match.setScores ??
    match.result ??
    match.score ??
    null;

  if (typeof candidate === 'string') {
    return candidate
      .split(/[,;/·|]+/)
      .map(part => {
        const nums = part.match(/\d+/g);
        return nums && nums.length >= 2 ? [Number(nums[0]), Number(nums[1])] : null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(candidate) && candidate.length > 0) {
    return candidate
      .map(s => {
        if (Array.isArray(s) && s.length >= 2) {
          const a = Number(s[0]);
          const b = Number(s[1]);
          return (!Number.isNaN(a) && !Number.isNaN(b)) ? [a, b] : null;
        }
        if (s && typeof s === 'object') {
          const vals = Object.values(s).map(Number).filter(n => !Number.isNaN(n));
          if (vals.length >= 2) return [vals[0], vals[1]];
          const a = Number(s.a ?? s.teamA ?? s.p1 ?? s.g1 ?? s.scoreA);
          const b = Number(s.b ?? s.teamB ?? s.p2 ?? s.g2 ?? s.scoreB);
          return (!Number.isNaN(a) && !Number.isNaN(b)) ? [a, b] : null;
        }
        if (typeof s === 'string') {
          const nums = s.match(/\d+/g);
          return nums && nums.length >= 2 ? [Number(nums[0]), Number(nums[1])] : null;
        }
        return null;
      })
      .filter(Boolean);
  }

  const fallbackSets = [];
  for (let i = 1; i <= 5; i++) {
    const strSet = match[`set${i}`];
    if (typeof strSet === 'string') {
      const nums = strSet.match(/\d+/g);
      if (nums && nums.length >= 2) {
        fallbackSets.push([Number(nums[0]), Number(nums[1])]);
        continue;
      }
    }
    const a = match[`set${i}A`] ?? match[`s${i}A`] ?? match[`g${i}A`];
    const b = match[`set${i}B`] ?? match[`s${i}B`] ?? match[`g${i}B`];
    if (a !== undefined && b !== undefined && a !== '' && b !== '') {
      fallbackSets.push([Number(a), Number(b)]);
    }
  }
  return fallbackSets;
}

function matchHasRecordedResult(match) {
  if (!match) return false;
  if (match.woAbsent) return true;
  const sets = extractMatchSetsList(match);
  return sets.length > 0 || Boolean(match.played) || Boolean(match.winnerId) || Boolean(match.winner);
}

function resolveAbsentTeamId(cat, match) {
  if (!match || !match.woAbsent) return null;
  const raw = String(match.woAbsent).trim();
  const upper = raw.toUpperCase();
  if (upper === 'A') return match.teamAId || null;
  if (upper === 'B') return match.teamBId || null;
  const exists = (Array.isArray(cat?.teams) ? cat.teams : []).some(t => t.id === raw);
  return exists ? raw : null;
}

function sortStandingsByPtsDiffSetsDiffGames(rows) {
  return (Array.isArray(rows) ? rows.slice() : []).sort((a, b) => {
    const ptsA = Number(a.points ?? a.pts ?? 0);
    const ptsB = Number(b.points ?? b.pts ?? 0);
    if (ptsB !== ptsA) return ptsB - ptsA;

    const diffSetsA =
      a.diffSets !== undefined
        ? Number(a.diffSets)
        : Number(a.setsWon ?? 0) - Number(a.setsLost ?? 0);
    const diffSetsB =
      b.diffSets !== undefined
        ? Number(b.diffSets)
        : Number(b.setsWon ?? 0) - Number(b.setsLost ?? 0);
    if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;

    const diffGamesA =
      a.diffGames !== undefined
        ? Number(a.diffGames)
        : Number(a.gamesWon ?? 0) - Number(a.gamesLost ?? 0);
    const diffGamesB =
      b.diffGames !== undefined
        ? Number(b.diffGames)
        : Number(b.gamesWon ?? 0) - Number(b.gamesLost ?? 0);
    if (diffGamesB !== diffGamesA) return diffGamesB - diffGamesA;

    const wonA = Number(a.won ?? a.pg ?? 0);
    const wonB = Number(b.won ?? b.pg ?? 0);
    if (wonB !== wonA) return wonB - wonA;

    return Number(a.seedIndex ?? 0) - Number(b.seedIndex ?? 0);
  });
}

function computeEnhancedZoneStandings(cat, zoneKey = null) {
  const teams = (Array.isArray(cat?.teams) ? cat.teams : []).filter(
    t => !zoneKey || (typeof getTeamZoneKey === 'function' ? getTeamZoneKey(cat, t) === zoneKey : true)
  );
  const teamIds = new Set(teams.map(t => t.id));

  const statsMap = new Map();
  teams.forEach((t, idx) => {
    statsMap.set(t.id, {
      teamId: t.id,
      team: t,
      group: zoneKey || null,
      zone: zoneKey ? (zoneKey === 'A' ? 'Zona A' : 'Zona B') : null,
      seedIndex: idx,
      played: 0,
      won: 0,
      lost: 0,
      woCount: 0,
      won2Sets: 0,
      lost2Sets: 0,
      won3Sets: 0,
      lost3Sets: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0
    });
  });

  const relevantMatches = (Array.isArray(cat?.matches) ? cat.matches : []).filter(m => {
    const inZone = !zoneKey || (typeof getMatchZoneKey === 'function' ? getMatchZoneKey(cat, m) === zoneKey : true);
    const hasBothTeams = teamIds.has(m.teamAId) && teamIds.has(m.teamBId);
    return inZone && hasBothTeams && matchHasRecordedResult(m);
  });

  relevantMatches.forEach(m => {
    const stA = statsMap.get(m.teamAId);
    const stB = statsMap.get(m.teamBId);
    if (!stA || !stB) return;

    const isWO = Boolean(m.woAbsent);
    const absentTeamId = isWO ? resolveAbsentTeamId(cat, m) : null;
    const sets = extractMatchSetsList(m);
    if (!sets.length) return;

    if (isWO) {
      m.sets = sets.map(s => [s[0], s[1]]);
      m.played = true;
    }

    const ev = evaluateMatch(sets, m.teamAId, m.teamBId);
    const award = computeMatchPointsAward(ev.setsA, ev.setsB, isWO);
    const aWon = ev.winnerId === m.teamAId;
    const lenA = classifyMatchSetLength(sets, aWon);
    const lenB = classifyMatchSetLength(sets, !aWon);

    stA.played += 1;
    stB.played += 1;

    if (isWO) {
      if (absentTeamId === m.teamAId && statsMap.has(m.teamAId)) {
        statsMap.get(m.teamAId).woCount += 1;
      } else if (absentTeamId === m.teamBId && statsMap.has(m.teamBId)) {
        statsMap.get(m.teamBId).woCount += 1;
      }
    }

    if (!isWO) {
      if (lenA.wonIn2) stA.won2Sets += 1;
      if (lenA.lostIn2) stA.lost2Sets += 1;
      if (lenA.wonIn3) stA.won3Sets += 1;
      if (lenA.lostIn3) stA.lost3Sets += 1;

      if (lenB.wonIn2) stB.won2Sets += 1;
      if (lenB.lostIn2) stB.lost2Sets += 1;
      if (lenB.wonIn3) stB.won3Sets += 1;
      if (lenB.lostIn3) stB.lost3Sets += 1;
    }

    stA.setsWon += ev.setsA;
    stA.setsLost += ev.setsB;
    stB.setsWon += ev.setsB;
    stB.setsLost += ev.setsA;

    stA.gamesWon += ev.gamesA;
    stA.gamesLost += ev.gamesB;
    stB.gamesWon += ev.gamesB;
    stB.gamesLost += ev.gamesA;

    if (aWon) {
      stA.won += 1;
      stB.lost += 1;
      stA.points += award.winnerPts;
      stB.points += award.loserPts;
    } else {
      stB.won += 1;
      stA.lost += 1;
      stB.points += award.winnerPts;
      stA.points += award.loserPts;
    }
  });

  const sorted = sortStandingsByPtsDiffSetsDiffGames(Array.from(statsMap.values()));
  sorted.forEach((r, idx) => {
    r.diffSets = r.setsWon - r.setsLost;
    r.diffGames = r.gamesWon - r.gamesLost;
    r.position = idx + 1;
    r.rank = idx + 1;
  });
  return sorted;
}

function stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeTeamNameForMatch(rawText) {
  return stripAccents(rawText)
    .replace(/\b(semis directo|cuartos|ascenso|descenso|clasificado|zona [ab])\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildLookupKeysForTeam(cat, team) {
  const keys = new Set();
  if (!team) return keys;

  const pushKey = (val) => {
    const clean = normalizeTeamNameForMatch(val);
    if (clean) keys.add(clean);
  };

  pushKey(team.name);
  if (typeof getTeamDisplayName === 'function') {
    pushKey(getTeamDisplayName(cat, team.id, ''));
  }

  const players = Array.isArray(state?.players) ? state.players : [];
  const p1 = players.find(p => p.id === team.player1Id);
  const p2 = players.find(p => p.id === team.player2Id);

  if (p1?.name && p2?.name) {
    pushKey(`${p1.name} / ${p2.name}`);
    pushKey(`${p1.name} y ${p2.name}`);
    pushKey(`${p1.name} - ${p2.name}`);

    const last1 = p1.name.trim().split(/\s+/).slice(-1)[0];
    const last2 = p2.name.trim().split(/\s+/).slice(-1)[0];
    pushKey(`${last1} / ${last2}`);
    pushKey(`${last1} y ${last2}`);
  }

  return keys;
}

function computeStatsMapFromCategoryMatches(cat, zoneKey = null) {
  const teams = (Array.isArray(cat?.teams) ? cat.teams : []).filter(
    t => !zoneKey || (typeof getTeamZoneKey === 'function' ? getTeamZoneKey(cat, t) === zoneKey : true)
  );
  const teamById = new Map(teams.map(t => [t.id, t]));
  const statsByTeamId = new Map();

  teams.forEach((t, idx) => {
    statsByTeamId.set(t.id, {
      teamId: t.id,
      team: t,
      seedIndex: idx,
      played: 0,
      won: 0,
      lost: 0,
      woCount: 0,
      won2Sets: 0,
      lost2Sets: 0,
      won3Sets: 0,
      lost3Sets: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0
    });
  });

  const matches = (Array.isArray(cat?.matches) ? cat.matches : []).filter(m => {
    const inZone = !zoneKey || (typeof getMatchZoneKey === 'function' ? getMatchZoneKey(cat, m) === zoneKey : true);
    return inZone && matchHasRecordedResult(m) && teamById.has(m.teamAId) && teamById.has(m.teamBId);
  });

  matches.forEach(m => {
    const stA = statsByTeamId.get(m.teamAId);
    const stB = statsByTeamId.get(m.teamBId);
    if (!stA || !stB) return;

    const isWO = Boolean(m.woAbsent);
    const absentTeamId = isWO ? resolveAbsentTeamId(cat, m) : null;
    const sets = extractMatchSetsList(m);
    if (!sets.length) return;

    const ev = evaluateMatch(sets, m.teamAId, m.teamBId);
    const award = computeMatchPointsAward(ev.setsA, ev.setsB, isWO);
    const aWon = ev.winnerId === m.teamAId;

    const lenA = classifyMatchSetLength(sets, aWon);
    const lenB = classifyMatchSetLength(sets, !aWon);

    stA.played += 1;
    stB.played += 1;

    if (isWO) {
      if (absentTeamId === m.teamAId) stA.woCount += 1;
      else if (absentTeamId === m.teamBId) stB.woCount += 1;
    } else {
      if (lenA.wonIn2) stA.won2Sets += 1;
      if (lenA.lostIn2) stA.lost2Sets += 1;
      if (lenA.wonIn3) stA.won3Sets += 1;
      if (lenA.lostIn3) stA.lost3Sets += 1;

      if (lenB.wonIn2) stB.won2Sets += 1;
      if (lenB.lostIn2) stB.lost2Sets += 1;
      if (lenB.wonIn3) stB.won3Sets += 1;
      if (lenB.lostIn3) stB.lost3Sets += 1;
    }

    stA.setsWon += ev.setsA;
    stA.setsLost += ev.setsB;
    stB.setsWon += ev.setsB;
    stB.setsLost += ev.setsA;

    stA.gamesWon += ev.gamesA;
    stA.gamesLost += ev.gamesB;
    stB.gamesWon += ev.gamesB;
    stB.gamesLost += ev.gamesA;

    if (aWon) {
      stA.won += 1;
      stB.lost += 1;
      stA.points += award.winnerPts;
      stB.points += award.loserPts;
    } else {
      stB.won += 1;
      stA.lost += 1;
      stB.points += award.winnerPts;
      stA.points += award.loserPts;
    }
  });

  const statsByLookupKey = new Map();
  teams.forEach(t => {
    const st = statsByTeamId.get(t.id);
    buildLookupKeysForTeam(cat, t).forEach(k => {
      statsByLookupKey.set(k, st);
    });
  });

  return { statsByTeamId, statsByLookupKey };
}

function getTeamPlayerIds(cat, teamId) {
  if (!teamId) return [];
  const team = (cat?.teams || []).find(t => t.id === teamId);
  if (!team) return [];
  return [team.player1Id, team.player2Id].filter(Boolean);
}

function applySeasonRolloverPlayerPointsAlgorithm(targetState, seasonNum) {
  if (!targetState || typeof targetState !== 'object') return;
  const players = Array.isArray(targetState.players) ? targetState.players : [];
  if (!players.length) return;

  const cfg = window.seasonPointsConfig || {
    retentionFactor: 0.7,
    championBonus: 15,
    finalistBonus: 8,
    semifinalBonus: 4
  };

  const existingRankMap = typeof computeIndividualRankings === 'function'
    ? (computeIndividualRankings().byId || {})
    : {};

  const seasonEarnedByPlayer = new Map();
  const playoffBonusByPlayer = new Map();

  players.forEach(p => {
    const fallbackPts = Number(existingRankMap[p.id]?.points ?? p.points ?? p.rankingPoints ?? 0) || 0;
    seasonEarnedByPlayer.set(p.id, fallbackPts);
    playoffBonusByPlayer.set(p.id, 0);
  });

  const hasMatchData = (targetState.categories || []).some(
    cat => Array.isArray(cat.matches) && cat.matches.some(m => matchHasRecordedResult(m))
  );

  if (hasMatchData) {
    const computedFromMatches = new Map();
    players.forEach(p => computedFromMatches.set(p.id, 0));

    (targetState.categories || []).forEach(cat => {
      (cat.matches || []).forEach(m => {
        if (!matchHasRecordedResult(m)) return;
        const isWO = Boolean(m.woAbsent);
        const sets = extractMatchSetsList(m);
        if (!sets.length || !m.teamAId || !m.teamBId) return;

        const evalRes = evaluateMatch(sets, m.teamAId, m.teamBId);
        const award = computeMatchPointsAward(evalRes.setsA, evalRes.setsB, isWO);
        const winnerIds = getTeamPlayerIds(cat, evalRes.winnerId);
        const loserIds = getTeamPlayerIds(cat, evalRes.loserId);

        winnerIds.forEach(pid => {
          computedFromMatches.set(pid, (computedFromMatches.get(pid) || 0) + award.winnerPts);
        });
        loserIds.forEach(pid => {
          computedFromMatches.set(pid, (computedFromMatches.get(pid) || 0) + award.loserPts);
        });
      });

      const po = cat.playoffs;
      if (po) {
        const addBonusForTeam = (teamId, bonus) => {
          getTeamPlayerIds(cat, teamId).forEach(pid => {
            playoffBonusByPlayer.set(pid, (playoffBonusByPlayer.get(pid) || 0) + bonus);
          });
        };

        if (po.final?.winner) {
          const champId = po.final.winner;
          const runnerUpId = champId === po.final.teamA ? po.final.teamB : po.final.teamA;
          addBonusForTeam(champId, cfg.championBonus || 0);
          addBonusForTeam(runnerUpId, cfg.finalistBonus || 0);
        }

        ['sf1', 'sf2'].forEach(sfKey => {
          const sf = po[sfKey];
          if (!sf || !sf.winner) return;
          const loserSf = sf.winner === sf.teamA ? sf.teamB : sf.teamA;
          addBonusForTeam(loserSf, cfg.semifinalBonus || 0);
        });
      }
    });

    players.forEach(p => {
      const fromMatches = computedFromMatches.get(p.id) || 0;
      const prevBase = seasonEarnedByPlayer.get(p.id) || 0;
      seasonEarnedByPlayer.set(p.id, fromMatches > 0 ? fromMatches : prevBase);
    });
  }

  players.forEach(p => {
    const prevSeasonPoints = seasonEarnedByPlayer.get(p.id) || 0;
    const poBonus = playoffBonusByPlayer.get(p.id) || 0;
    const rawTotal = prevSeasonPoints + poBonus;
    const carriedPoints = Math.round(rawTotal * (cfg.retentionFactor ?? 0.7));

    if (!Array.isArray(p.seasonHistory)) p.seasonHistory = [];
    p.seasonHistory.push({
      seasonNumber: seasonNum,
      seasonPoints: prevSeasonPoints,
      playoffBonus: poBonus,
      carriedPoints,
      updatedAt: new Date().toISOString()
    });

    p.points = carriedPoints;
    p.rankingPoints = carriedPoints;
    p.seasonPoints = 0;
  });
}

function buildReadOnlyArchivedSeasonSnapshot(targetState, seasonNum) {
  const safeNum = Math.max(1, Number(seasonNum) || 1);
  const label = `Temporada ${safeNum}`;
  return {
    id: `season_archive_${safeNum}_${Date.now()}`,
    seasonNumber: safeNum,
    currentSeason: safeNum,
    season: safeNum,
    seasonName: targetState.seasonName || label,
    seasonTitle: targetState.seasonTitle || label,
    readOnly: true,
    isReadOnly: true,
    mode: 'readonly',
    status: 'finalized_readonly',
    archivedAt: new Date().toISOString(),
    players: JSON.parse(JSON.stringify(targetState.players || [])),
    categories: JSON.parse(JSON.stringify(targetState.categories || []))
  };
}

function handleSeasonRollover() {
  if (typeof state !== 'object' || !state) return;

  const currentSeasonNum = Math.max(
    1,
    Number(state.seasonNumber || state.currentSeason || state.season || 1)
  );
  const nextSeasonNum = currentSeasonNum + 1;

  const runRollover = () => {
    applySeasonRolloverPlayerPointsAlgorithm(state, currentSeasonNum);

    const readOnlySnapshot = buildReadOnlyArchivedSeasonSnapshot(state, currentSeasonNum);

    if (!Array.isArray(state.archivedSeasons)) state.archivedSeasons = [];
    state.archivedSeasons.push(readOnlySnapshot);

    if (!Array.isArray(state.seasons)) state.seasons = [];
    state.seasons.push(readOnlySnapshot);

    state.categories = normalizeCategoriesCollection(state.categories);
    state.categories.forEach(cat => {
      cat.matches = [];
      cat.playoffs = null;
    });

    setActiveSeasonState(state, nextSeasonNum);
    state.selectedRound = 'all';

    if (typeof saveStateToSQLite === 'function') {
      try { saveStateToSQLite(state); } catch (_e) {}
    }
    if (typeof saveState === 'function') {
      try { saveState(); } catch (_e) {}
    }
    if (typeof render === 'function') {
      try { render(); } catch (_e) {}
    }
    fixUndefinedSeasonLabels(nextSeasonNum);
    if (typeof injectResetAllButton === 'function') {
      injectResetAllButton();
    }
    if (typeof hidePlayoffManualAdvanceButtons === 'function') {
      hidePlayoffManualAdvanceButtons();
    }
    if (typeof showToast === 'function') {
      showToast(
        `Temporada ${currentSeasonNum} guardada en Solo Lectura y puntajes ajustados. ¡Comenzó la Temporada ${nextSeasonNum}!`,
        'success'
      );
    }
  };

  if (typeof requestConfirmAction === 'function') {
    requestConfirmAction(
      `🏁 Cerrar Temporada ${currentSeasonNum} e Iniciar Temporada ${nextSeasonNum}`,
      `La <strong>Temporada ${currentSeasonNum}</strong> quedará archivada en <strong>Modo Solo Lectura</strong>, se aplicará el algoritmo al puntaje individual y se iniciará la <strong>Temporada ${nextSeasonNum}</strong>.`,
      runRollover
    );
  } else {
    runRollover();
  }
}

window.handleSeasonRollover = handleSeasonRollover;
window.applySeasonRolloverPlayerPointsAlgorithm = applySeasonRolloverPlayerPointsAlgorithm;
window.fixUndefinedSeasonLabels = fixUndefinedSeasonLabels;

function injectResetAllButton() {
  if (document.getElementById('btnResetAllEmpty')) return;

  const buttons = Array.from(document.querySelectorAll('button'));
  const demoBtn = buttons.find(b => {
    const txt = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    return txt.includes('reiniciar demo') || txt.includes('reset demo') || oc.includes('resetdemo');
  });

  const btn = document.createElement('button');
  btn.id = 'btnResetAllEmpty';
  btn.type = 'button';
  btn.textContent = '🧹 Reiniciar Todo (Temp. 1)';
  btn.title = 'Borrar todos los jugadores, parejas, partidos y temporadas archivadas para empezar vacío desde Temporada 1';
  btn.className = 'px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer';
  btn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    handleResetAllEmpty();
  };

  if (demoBtn && demoBtn.parentElement) {
    demoBtn.parentElement.insertBefore(btn, demoBtn.nextSibling);
    return;
  }

  const headerTarget =
    document.querySelector('header .flex') ||
    document.querySelector('header') ||
    document.querySelector('nav');

  if (headerTarget) {
    headerTarget.appendChild(btn);
  }
}

function hidePlayoffManualAdvanceButtons() {
  const buttons = Array.from(document.querySelectorAll('button'));
  buttons.forEach(btn => {
    if (btn.closest('#matchModal, #playoffEditorModal, #playerEditorModal, #swapPlayerModal, #confirmActionModal')) {
      return;
    }
    const onclickAttr = (btn.getAttribute('onclick') || '').toLowerCase();
    const label = (btn.textContent || '').trim().toLowerCase();
    const isAdvanceBtn = onclickAttr.includes('advanceplayoff') || label === 'avanzar' || label.includes('avanzar');
    const isUndoPlayoffBtn = onclickAttr.includes('playoff') && (label.includes('deshacer') || onclickAttr.includes('undo'));

    if (isAdvanceBtn || isUndoPlayoffBtn) {
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
    }
  });
}

function getTeamZoneKey(cat, team) {
  if (!cat || !team) return 'A';
  const raw = String(team.group ?? team.zone ?? '').trim().toUpperCase();
  if (raw === 'B' || raw === 'ZONA B' || raw.endsWith('B')) return 'B';
  if (raw === 'A' || raw === 'ZONA A' || raw.endsWith('A')) return 'A';
  const idx = (cat.teams || []).findIndex(t => t.id === team.id);
  const half = Math.ceil((cat.teams || []).length / 2);
  return idx >= 0 && idx >= half ? 'B' : 'A';
}

function getMatchZoneKey(cat, match) {
  if (!cat || !match) return 'A';
  const raw = String(match.group ?? match.zone ?? '').trim().toUpperCase();
  if (raw === 'B' || raw === 'ZONA B' || raw.endsWith('B')) return 'B';
  if (raw === 'A' || raw === 'ZONA A' || raw.endsWith('A')) return 'A';
  const teamA = (cat.teams || []).find(t => t.id === match.teamAId);
  return getTeamZoneKey(cat, teamA);
}

function assignBalancedZonesToTeams(teams) {
  const list = Array.isArray(teams) ? teams : [];
  const half = Math.ceil(list.length / 2);
  list.forEach((team, idx) => {
    const zoneCode = idx < half ? 'A' : 'B';
    team.group = zoneCode;
    team.zone = zoneCode === 'A' ? 'Zona A' : 'Zona B';
  });
}

function clearTeamZones(teams) {
  (Array.isArray(teams) ? teams : []).forEach(team => {
    team.group = null;
    team.zone = null;
  });
}

function sortMatchesByZoneAndRound(cat, matches) {
  const list = Array.isArray(matches) ? matches.slice() : [];
  return list.sort((a, b) => {
    const roundDiff = (Number(a.round) || 1) - (Number(b.round) || 1);
    if (roundDiff !== 0) return roundDiff;

    if (cat?.leagueMode === 'two_groups') {
      const zA = getMatchZoneKey(cat, a);
      const zB = getMatchZoneKey(cat, b);
      if (zA !== zB) return zA.localeCompare(zB);
    }

    const courtCmp = String(a.court || '').localeCompare(String(b.court || ''));
    if (courtCmp !== 0) return courtCmp;
    return String(a.time || '').localeCompare(String(b.time || ''));
  });
}

function computeZoneStandings(cat, zoneKey) {
  return computeEnhancedZoneStandings(cat, zoneKey);
}

function getSelectedZoneFilter() {
  const val = String(window.__selectedFixtureZone || 'ALL').toUpperCase();
  return ['ALL', 'A', 'B'].includes(val) ? val : 'ALL';
}

function setFixtureZoneFilter(zoneCode) {
  const norm = String(zoneCode || 'ALL').toUpperCase();
  window.__selectedFixtureZone = ['ALL', 'A', 'B'].includes(norm) ? norm : 'ALL';
  const activeCat =
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    (Array.isArray(state?.categories)
      ? state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0]
      : null);
  renderTwoGroupsFixtureSection(activeCat);
}

window.setFixtureZoneFilter = setFixtureZoneFilter;

function formatMatchScoreBadge(match, cat = null) {
  if (match?.woAbsent) {
    const absentId = resolveAbsentTeamId(cat, match);
    const absentName = absentId && typeof getTeamDisplayName === 'function'
      ? getTeamDisplayName(cat, absentId, match.woAbsent)
      : `W.O. (${match.woAbsent})`;
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">W.O. · ${absentName}</span>`;
  }
  const sets = extractMatchSetsList(match);
  if (sets.length > 0) {
    const setsTxt = sets.map(s => `${s[0]}-${s[1]}`).join(' · ');
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">${setsTxt}</span>`;
  }
  if (match?.delayed) {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">Retrasado</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Pendiente</span>`;
}

function buildZoneFixtureColumnHtml(cat, zoneKey, zoneTitle, matches) {
  const zoneTeams = (Array.isArray(cat?.teams) ? cat.teams : []).filter(
    t => getTeamZoneKey(cat, t) === zoneKey
  );
  const teamChips = zoneTeams
    .map(t => `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${getTeamDisplayName(cat, t.id, 'Pareja')}</span>`)
    .join('');

  const matchCards = matches.length
    ? matches
        .map(m => {
          const nameA = getTeamDisplayName(cat, m.teamAId, 'Pareja A');
          const nameB = getTeamDisplayName(cat, m.teamBId, 'Pareja B');
          const roundLabel = m.dateLabel || `Fecha ${m.round || 1}`;
          const scheduleTxt = [m.court, m.time].filter(Boolean).join(' · ');
          return `
            <div class="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">${roundLabel}</span>
                  ${scheduleTxt ? `<span>${scheduleTxt}</span>` : ''}
                </div>
                <div class="text-xs font-extrabold text-slate-900">
                  ${nameA} <span class="text-slate-400 font-semibold mx-1">vs</span> ${nameB}
                </div>
              </div>
              <div class="flex items-center gap-2 self-end sm:self-center">
                ${formatMatchScoreBadge(m, cat)}
                <button
                  type="button"
                  onclick="openMatchModal('${m.id}', '${cat.id}')"
                  class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer transition"
                >
                  Anotar
                </button>
              </div>
            </div>
          `;
        })
        .join('')
    : `<div class="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No hay partidos generados en ${zoneTitle}.</div>`;

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
        <span class="text-xs font-extrabold uppercase tracking-wide">${zoneTitle}</span>
        <span class="text-[11px] text-slate-300 font-semibold">${matches.length} partido(s)</span>
      </div>
      <div class="p-3.5 space-y-3">
        <div class="flex flex-wrap gap-1.5">
          ${teamChips || `<span class="text-[11px] text-slate-400">Sin parejas asignadas</span>`}
        </div>
        <div class="space-y-2">
          ${matchCards}
        </div>
      </div>
    </div>
  `;
}

function setLegacyMixedFixtureVisibility(hideMixed) {
  const panel = document.getElementById('twoGroupsFixturePanel');
  const candidates = Array.from(document.querySelectorAll('section, div')).filter(el => {
    if (!el || el === panel || el.closest('#twoGroupsFixturePanel, #twoGroupsStandingsPanel')) return false;
    if (el.dataset.hiddenByTwoGroups === 'true') return true;
    const txt = (el.textContent || '').toLowerCase();
    const hasMatchAction = Boolean(el.querySelector('button[onclick*="openMatchModal"], button[onclick*="toggleQuickDelay"]'));
    return hasMatchAction && txt.includes('fecha') && el.children.length >= 2 && el.children.length <= 20;
  });

  candidates.forEach(el => {
    if (hideMixed) {
      if (el.style.display !== 'none') {
        el.dataset.prevDisplay = el.style.display || '';
      }
      el.dataset.hiddenByTwoGroups = 'true';
      el.style.display = 'none';
    } else if (el.dataset.hiddenByTwoGroups === 'true') {
      el.style.display = el.dataset.prevDisplay || '';
      delete el.dataset.hiddenByTwoGroups;
      delete el.dataset.prevDisplay;
    }
  });
}

function renderTwoGroupsFixtureSection(cat) {
  const existing = document.getElementById('twoGroupsFixturePanel');
  if (!cat || cat.leagueMode !== 'two_groups') {
    if (existing) existing.remove();
    setLegacyMixedFixtureVisibility(false);
    return;
  }

  assignBalancedZonesToTeams(cat.teams);
  cat.matches = sortMatchesByZoneAndRound(cat, cat.matches);

  const selectedZone = getSelectedZoneFilter();
  const matchesA = (cat.matches || []).filter(m => getMatchZoneKey(cat, m) === 'A');
  const matchesB = (cat.matches || []).filter(m => getMatchZoneKey(cat, m) === 'B');

  let panel = existing;
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'twoGroupsFixturePanel';
    panel.className = 'my-4 space-y-3';
  }

  const btnBase = 'px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition';
  const activeStyle = 'bg-slate-900 text-white border-slate-900';
  const idleStyle = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';

  const colsHtml =
    selectedZone === 'A'
      ? `<div class="grid grid-cols-1 gap-4">${buildZoneFixtureColumnHtml(cat, 'A', 'Zona A', matchesA)}</div>`
      : selectedZone === 'B'
        ? `<div class="grid grid-cols-1 gap-4">${buildZoneFixtureColumnHtml(cat, 'B', 'Zona B', matchesB)}</div>`
        : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${buildZoneFixtureColumnHtml(cat, 'A', 'Zona A', matchesA)}
            ${buildZoneFixtureColumnHtml(cat, 'B', 'Zona B', matchesB)}
          </div>`;

  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 class="text-sm font-extrabold text-slate-900">📅 Fixture Separado por Zona · ${cat.name}</h4>
        <p class="text-[11px] text-slate-500">Partidos ordenados por fecha dentro de cada zona (Zona A y Zona B).</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="setFixtureZoneFilter('ALL')" class="${btnBase} ${selectedZone === 'ALL' ? activeStyle : idleStyle}">
          Ambas (${matchesA.length + matchesB.length})
        </button>
        <button type="button" onclick="setFixtureZoneFilter('A')" class="${btnBase} ${selectedZone === 'A' ? activeStyle : idleStyle}">
          Zona A (${matchesA.length})
        </button>
        <button type="button" onclick="setFixtureZoneFilter('B')" class="${btnBase} ${selectedZone === 'B' ? activeStyle : idleStyle}">
          Zona B (${matchesB.length})
        </button>
      </div>
    </div>
    ${colsHtml}
  `;

  const standingsPanel = document.getElementById('twoGroupsStandingsPanel');
  if (standingsPanel && standingsPanel.parentElement) {
    standingsPanel.parentElement.insertBefore(panel, standingsPanel.nextSibling);
  } else {
    const mainEl = document.querySelector('main') || document.body;
    mainEl.appendChild(panel);
  }

  setLegacyMixedFixtureVisibility(true);
}

function renderTwoGroupsDomEnhancement(cat) {
  if (!cat || cat.leagueMode !== 'two_groups') {
    const existingBox = document.getElementById('twoGroupsStandingsPanel');
    if (existingBox) existingBox.remove();
    renderTwoGroupsFixtureSection(cat);
    return;
  }

  assignBalancedZonesToTeams(cat.teams);
  cat.matches = sortMatchesByZoneAndRound(cat, cat.matches);

  const standA = computeEnhancedZoneStandings(cat, 'A');
  const standB = computeEnhancedZoneStandings(cat, 'B');

  const formatRow = (row, idx) => {
    const teamName = getTeamDisplayName(cat, row.teamId, 'Pareja');
    const diffSets = row.setsWon - row.setsLost;
    const diffGames = row.gamesWon - row.gamesLost;
    const badgeClass = idx < 4
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
    return `
      <tr class="border-b border-slate-100 last:border-none hover:bg-slate-50/80">
        <td class="py-2 px-2.5 font-extrabold text-slate-700 w-10">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] border ${badgeClass}">${idx + 1}</span>
        </td>
        <td class="py-2 px-2.5 font-bold text-slate-900">${teamName}</td>
        <td class="py-2 px-2 text-center font-semibold text-slate-600">${row.played}</td>
        <td class="py-2 px-2 text-center font-semibold text-emerald-700">${row.won}</td>
        <td class="py-2 px-2 text-center font-semibold text-rose-600">${row.lost}</td>
        <td class="py-2 px-2 text-center font-semibold ${row.woCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}">${row.woCount}</td>
        <td class="py-2 px-2 text-center font-semibold text-slate-600">${diffSets >= 0 ? `+${diffSets}` : diffSets}</td>
        <td class="py-2 px-2 text-center font-semibold text-slate-600">${diffGames >= 0 ? `+${diffGames}` : diffGames}</td>
        <td class="py-2 px-2 text-center font-semibold text-slate-700 whitespace-nowrap">2S: ${row.won2Sets}G-${row.lost2Sets}P · 3S: ${row.won3Sets}G-${row.lost3Sets}P</td>
        <td class="py-2 px-2.5 text-right font-extrabold text-slate-900">${row.points} pts</td>
      </tr>
    `;
  };

  const buildZoneTableCard = (title, rows) => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
        <span class="text-xs font-extrabold tracking-wide uppercase">${title}</span>
        <span class="text-[11px] text-slate-300 font-semibold">${rows.length} parejas</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase">
              <th class="py-2 px-2.5">#</th>
              <th class="py-2 px-2.5">Pareja</th>
              <th class="py-2 px-2 text-center">PJ</th>
              <th class="py-2 px-2 text-center">PG</th>
              <th class="py-2 px-2 text-center">PP</th>
              <th class="py-2 px-2 text-center">W.O.</th>
              <th class="py-2 px-2 text-center">DS</th>
              <th class="py-2 px-2 text-center">DG</th>
              <th class="py-2 px-2 text-center">2S / 3S</th>
              <th class="py-2 px-2.5 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows.map((r, i) => formatRow(r, i)).join('')
              : `<tr><td colspan="10" class="py-4 text-center text-slate-400">Sin parejas asignadas</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  let panel = document.getElementById('twoGroupsStandingsPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'twoGroupsStandingsPanel';
    panel.className = 'my-4 space-y-2';
  }

  panel.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-extrabold text-slate-900">🏆 Tabla de Posiciones por Grupos · ${cat.name}</h4>
      <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
        Zona A vs Zona B
      </span>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${buildZoneTableCard('Zona A', standA)}
      ${buildZoneTableCard('Zona B', standB)}
    </div>
  `;

  const tables = Array.from(document.querySelectorAll('table'));
  const standingsTable = tables.find(tbl => {
    const txt = (tbl.textContent || '').toLowerCase();
    return (txt.includes('pts') || txt.includes('pj') || txt.includes('pos')) && !tbl.closest('#twoGroupsStandingsPanel');
  });

  if (standingsTable && standingsTable.parentElement) {
    const host = standingsTable.closest('.rounded-2xl, .bg-white, section, div') || standingsTable.parentElement;
    if (host.parentElement) {
      host.parentElement.insertBefore(panel, host.nextSibling);
    }
  } else {
    const mainEl = document.querySelector('main') || document.body;
    mainEl.appendChild(panel);
  }

  renderTwoGroupsFixtureSection(cat);
}

const origComputeStandings = typeof window.computeStandings === 'function' ? window.computeStandings : null;
window.computeStandings = function (cat, group = null) {
  let rows = null;
  if (cat?.leagueMode === 'two_groups') {
    if (group === 'A' || group === 'Zona A') rows = computeEnhancedZoneStandings(cat, 'A');
    else if (group === 'B' || group === 'Zona B') rows = computeEnhancedZoneStandings(cat, 'B');
  }
  if (!rows) {
    rows = origComputeStandings ? origComputeStandings.call(this, cat, group) : computeEnhancedZoneStandings(cat, group);
  }
  if (!Array.isArray(rows)) return rows;

  const detailed = computeEnhancedZoneStandings(cat, group);
  const byId = new Map(detailed.map(d => [d.teamId, d]));

  const merged = rows.map(r => {
    const det = byId.get(r.teamId) || {};
    return {
      ...r,
      woCount: det.woCount ?? 0,
      won2Sets: det.won2Sets ?? 0,
      lost2Sets: det.lost2Sets ?? 0,
      won3Sets: det.won3Sets ?? 0,
      lost3Sets: det.lost3Sets ?? 0,
      diffSets: (r.setsWon ?? 0) - (r.setsLost ?? 0),
      diffGames: (r.gamesWon ?? 0) - (r.gamesLost ?? 0)
    };
  });

  const sorted = sortStandingsByPtsDiffSetsDiffGames(merged);
  sorted.forEach((r, idx) => {
    r.position = idx + 1;
    r.rank = idx + 1;
  });
  return sorted;
};

let __isTransformingStandings = false;

function compute2S3SAndWoByTeamId(cat) {
  const result = new Map();
  const teams = Array.isArray(cat?.teams) ? cat.teams : [];
  const matches = Array.isArray(cat?.matches) ? cat.matches : [];

  teams.forEach(t => {
    result.set(t.id, { won2Sets: 0, lost2Sets: 0, won3Sets: 0, lost3Sets: 0, woCount: 0 });
  });

  matches.forEach(m => {
    if (!m) return;

    const isWO = Boolean(m.woAbsent);
    if (isWO) {
      const absentTeamId = resolveAbsentTeamId(cat, m);
      if (absentTeamId && result.has(absentTeamId)) {
        result.get(absentTeamId).woCount += 1;
      }
      return;
    }

    if (!m.played && !Array.isArray(m.sets)) return;
    const sets = extractMatchSetsList(m);
    if (!sets.length) return;

    let setsA = 0;
    let setsB = 0;
    sets.forEach(([a, b]) => {
      if (a > b) setsA += 1;
      else if (b > a) setsB += 1;
    });

    if (setsA === setsB) return;

    const aWon = setsA > setsB;
    const totalSets = sets.length;
    const isTwoSets = totalSets === 2;
    const isThreeSets = totalSets >= 3;

    const stA = result.get(m.teamAId);
    const stB = result.get(m.teamBId);

    if (stA) {
      if (aWon && isTwoSets) stA.won2Sets += 1;
      else if (!aWon && isTwoSets) stA.lost2Sets += 1;
      else if (aWon && isThreeSets) stA.won3Sets += 1;
      else if (!aWon && isThreeSets) stA.lost3Sets += 1;
    }

    if (stB) {
      if (!aWon && isTwoSets) stB.won2Sets += 1;
      else if (aWon && isTwoSets) stB.lost2Sets += 1;
      else if (!aWon && isThreeSets) stB.won3Sets += 1;
      else if (aWon && isThreeSets) stB.lost3Sets += 1;
    }
  });

  return result;
}

function transformDomStandingsTables(cat) {
  if (__isTransformingStandings) return;
  __isTransformingStandings = true;

  try {
    const activeCat =
      cat ||
      (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
      (typeof state === 'object' && Array.isArray(state?.categories)
        ? state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0]
        : null);

    if (!activeCat) return;

    const extraByTeamId = compute2S3SAndWoByTeamId(activeCat);
    const { statsByLookupKey } = computeStatsMapFromCategoryMatches(activeCat, null);

    const lookupExtra = new Map();
    for (const [key, st] of statsByLookupKey.entries()) {
      if (st?.teamId && extraByTeamId.has(st.teamId)) {
        lookupExtra.set(key, extraByTeamId.get(st.teamId));
      }
    }

    const tables = Array.from(document.querySelectorAll('table'));

    tables.forEach(tbl => {
      if (tbl.closest('#twoGroupsStandingsPanel')) return;

      const theadRow = tbl.querySelector('thead tr');
      const tbody = tbl.querySelector('tbody');
      if (!theadRow || !tbody) return;

      let ths = Array.from(theadRow.children);
      const headersUpper = ths.map(th =>
        (th.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase()
      );

      const idxTeam = headersUpper.findIndex(h => h === 'PAREJA');
      const idxPts = headersUpper.findIndex(h => h === 'PTS');
      if (idxTeam === -1 || idxPts === -1) return;

      let idx23 = headersUpper.findIndex(h => h.includes('2S') && h.includes('3S'));
      const idxWo = headersUpper.findIndex(h => h.replace(/\./g, '').trim() === 'WO');

      if (idx23 === -1) {
        const th23 = document.createElement('th');
        th23.className = 'py-2 px-2 text-center text-[11px] uppercase';
        th23.dataset.colTag = '2s3s';
        th23.textContent = '2S / 3S';

        const anchorTh = idxWo >= 0 ? ths[idxWo]?.nextSibling : ths[idxPts];
        theadRow.insertBefore(th23, anchorTh || null);

        ths = Array.from(theadRow.children);
        idx23 = ths.indexOf(th23);
      }

      Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
        const cells = Array.from(tr.children);
        if (!cells.length) return;

        let cell23 = cells[idx23];
        if (!cell23 || cell23.dataset?.colTag !== '2s3s') {
          const existingTagged = Array.from(tr.children).find(c => c.dataset?.colTag === '2s3s');
          if (existingTagged) {
            cell23 = existingTagged;
          } else {
            const td23 = document.createElement('td');
            td23.className = 'py-2 px-2 text-center text-[11px] font-semibold text-slate-700 whitespace-nowrap';
            td23.dataset.colTag = '2s3s';
            td23.textContent = '2S: 0G-0P · 3S: 0G-0P';

            const anchorTd = idxWo >= 0 && cells[idxWo] ? cells[idxWo].nextSibling : cells[idxPts];
            tr.insertBefore(td23, anchorTd || null);
            cell23 = td23;
          }
        }

        const currentCells = Array.from(tr.children);
        const teamCell = currentCells[idxTeam];
        if (!teamCell) return;

        const rawCellText = teamCell.textContent || '';
        const cleanedCellText = rawCellText
          .replace(/\b(SEMIS DIRECTO|CUARTOS|ASCENSO|DESCENSO|CLASIFICADO|ZONA [AB])\b/gi, '')
          .trim();
        const normName = normalizeTeamNameForMatch(cleanedCellText);

        let matchedExtra = lookupExtra.get(normName) || null;
        if (!matchedExtra && normName) {
          for (const [key, val] of lookupExtra.entries()) {
            if (normName === key || normName.startsWith(key) || key.startsWith(normName)) {
              matchedExtra = val;
              break;
            }
          }
        }

        const s = matchedExtra || { won2Sets: 0, lost2Sets: 0, won3Sets: 0, lost3Sets: 0, woCount: 0 };
        cell23.textContent = `2S: ${s.won2Sets}G-${s.lost2Sets}P · 3S: ${s.won3Sets}G-${s.lost3Sets}P`;

        if (idxWo >= 0 && currentCells[idxWo]) {
          currentCells[idxWo].textContent = String(s.woCount);
          currentCells[idxWo].classList.toggle('text-rose-600', s.woCount > 0);
          currentCells[idxWo].classList.toggle('font-bold', s.woCount > 0);
        }
      });
    });
  } finally {
    __isTransformingStandings = false;
  }
}

window.transformDomStandingsTables = transformDomStandingsTables;
function syncPublicPlayerCardProfileButtons() {
  if (window.__isLeagueAdmin) return;

  const cards = document.querySelectorAll('div, article, li');
  cards.forEach(card => {
    const hasRankingBadge = /#\d+\s*ranking/i.test(card.textContent || '');
    const hasPtsBadge = /\d+(\.\d+)?\s*pts/i.test(card.textContent || '');
    if (!hasRankingBadge || !hasPtsBadge) return;

    const buttons = Array.from(card.querySelectorAll('button'));
    const targetBtn = buttons.find(btn => /^\s*(?:👤|📸)?\s*fotos\b/i.test((btn.textContent || '').trim()));
    if (!targetBtn) return;

    const hasIconSpan = targetBtn.querySelector('span');
    if (hasIconSpan && targetBtn.children.length >= 2) {
      targetBtn.children[targetBtn.children.length - 1].textContent = 'Perfil';
    } else {
      targetBtn.textContent = '👤 Perfil';
    }
  });
}


function runPostRenderEnhancements() {
  if (typeof state === 'object' && state) {
    fixUndefinedSeasonLabels(state?.seasonNumber || state?.currentSeason || state?.season || 1);
  }
  injectResetAllButton();
  hidePlayoffManualAdvanceButtons();
  const activeCat =
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    (typeof state === 'object' && Array.isArray(state?.categories)
      ? state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0]
      : null);
  syncFormatControlsFromCategory(activeCat);
  renderTwoGroupsDomEnhancement(activeCat);
  transformDomStandingsTables(activeCat);
  setupScoreboardZigzagNavigation();
  bindModalWoAutoFill();
  syncPublicPlayerCardProfileButtons();
}

function wrapRenderIfAvailable() {
  if (typeof window.render === 'function' && !window.render.__standingsWrapped) {
    const baseRender = window.render;
    const wrappedRender = function (...args) {
      const out = baseRender.apply(this, args);
      runPostRenderEnhancements();
      return out;
    };
    wrappedRender.__standingsWrapped = true;
    window.render = wrappedRender;
  }
}

wrapRenderIfAvailable();

let __domObserverTimer = null;
if (typeof MutationObserver === 'function' && !window.__standingsObserverInstalled) {
  window.__standingsObserverInstalled = true;
  const startObserver = () => {
    if (!document.body) return;
    const obs = new MutationObserver(() => {
      if (__isTransformingStandings) return;
      clearTimeout(__domObserverTimer);
      __domObserverTimer = setTimeout(() => {
        wrapRenderIfAvailable();
        transformDomStandingsTables();
        applyReadOnlyRestrictions();
      }, 80);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) startObserver();
  else window.addEventListener('DOMContentLoaded', startObserver, { once: true });
}

function propagatePlayoffs(cat) {
  if (!cat || !cat.playoffs) return;
  const po = cat.playoffs;

  const setSlot = (targetNode, slotKey, nextTeamId) => {
    if (!targetNode) return;
    const prevTeamId = targetNode[slotKey] || null;
    targetNode[slotKey] = nextTeamId || null;
    if (prevTeamId && prevTeamId !== targetNode[slotKey] && targetNode.winner === prevTeamId) {
      targetNode.winner = null;
    }
  };

  if (cat.leagueMode === 'two_groups' || po.mode === 'top8') {
    setSlot(po.sf1, 'teamA', po.qf1?.winner || null);
    setSlot(po.sf1, 'teamB', po.qf2?.winner || null);
    setSlot(po.sf2, 'teamA', po.qf3?.winner || null);
    setSlot(po.sf2, 'teamB', po.qf4?.winner || null);
  } else if (po.mode === 'top6') {
    setSlot(po.sf1, 'teamB', po.qf2?.winner || null);
    setSlot(po.sf2, 'teamB', po.qf1?.winner || null);
  } else {
    setSlot(po.sf1, 'teamB', po.qf3?.winner || null);
    setSlot(po.sf2, 'teamA', po.qf1?.winner || null);
    setSlot(po.sf2, 'teamB', po.qf2?.winner || null);
  }

  if (po.thirdPlace && po.sf1 && po.sf2) {
    const loser1 = po.sf1.winner ? (po.sf1.winner === po.sf1.teamA ? po.sf1.teamB : po.sf1.teamA) : null;
    const loser2 = po.sf2.winner ? (po.sf2.winner === po.sf2.teamA ? po.sf2.teamB : po.sf2.teamA) : null;
    setSlot(po.thirdPlace, 'teamA', loser1);
    setSlot(po.thirdPlace, 'teamB', loser2);
  }

  if (po.final && po.sf1 && po.sf2) {
    setSlot(po.final, 'teamA', po.sf1.winner || null);
    setSlot(po.final, 'teamB', po.sf2.winner || null);
  }
}

window.propagatePlayoffs = propagatePlayoffs;

function resolveWinnerForPlayoffNode(node) {
  if (!node) return null;
  if (node.winner && (node.winner === node.teamA || node.winner === node.teamB)) {
    return node.winner;
  }
  if (Array.isArray(node.sets) && node.sets.length > 0 && node.teamA && node.teamB) {
    const res = evaluateMatch(node.sets, node.teamA, node.teamB);
    return res.winnerId;
  }
  return null;
}

function advancePlayoff(stageKey, categoryId = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede avanzar en playoffs.', 'info');
    return;
  }

  const cats = Array.isArray(state?.categories) ? state.categories : [];
  const cat =
    (categoryId ? cats.find(c => c.id === categoryId) : null) ||
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    cats[0];

  if (!cat) {
    showToast('No hay categoría activa para avanzar en playoffs.', 'error');
    return;
  }

  const po = typeof ensurePlayoffBracket === 'function'
    ? ensurePlayoffBracket(cat)
    : (cat.playoffs = cat.playoffs || {});

  const key = stageKey || 'qf1';
  const node = po[key];

  if (!node) {
    showToast(`No se encontró la llave "${key}" en ${cat.name}.`, 'warning');
    return;
  }

  const winnerId = resolveWinnerForPlayoffNode(node);
  if (!winnerId) {
    showToast('Anota el resultado del partido para que el ganador avance automáticamente.', 'warning');
    return;
  }

  node.winner = winnerId;
  propagatePlayoffs(cat);

  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  fixUndefinedSeasonLabels(state?.seasonNumber || 1);
  injectResetAllButton();
  hidePlayoffManualAdvanceButtons();

  const winnerName = getTeamDisplayName(cat, winnerId, 'Ganador');
  showToast(`Avanzó ${winnerName} en ${key.toUpperCase()} (${cat.name}).`, 'success');
}

window.advancePlayoff = advancePlayoff;

function normalizeLeagueModeValue(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (
    v === 'two_groups' ||
    v === 'grupos' ||
    v === '2_grupos' ||
    v === 'zone_ab' ||
    v.includes('2 grupos') ||
    v.includes('zona a') ||
    v.includes('grupo')
  ) {
    return 'two_groups';
  }
  if (
    v === 'double' ||
    v === 'round_trip' ||
    v === 'ida_vuelta' ||
    v.includes('ida y vuelta') ||
    v.includes('vuelta')
  ) {
    return 'ida_vuelta';
  }
  return 'single';
}

function normalizePlayoffModeValue(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'top6' || v === '6' || v.includes('top 6') || v.includes('6 clasif')) return 'top6';
  if (v === 'top8' || v === '8' || v.includes('top 8') || v.includes('8 cuartos') || v.includes('cuartos')) return 'top8';
  return 'top7';
}

function getFormatControlsInPanel() {
  const buttons = Array.from(document.querySelectorAll('button'));
  const genBtn = buttons.find(b => {
    const t = (b.textContent || '').toLowerCase();
    return t.includes('generar') && t.includes('fixture');
  });
  const recBtn = buttons.find(b => (b.textContent || '').toLowerCase().includes('formato recomendado'));
  const anchor = genBtn || recBtn || null;

  let panel = null;
  if (anchor) {
    let curr = anchor.parentElement;
    for (let i = 0; i < 6 && curr; i++) {
      if (curr.querySelectorAll('select').length >= 2) {
        panel = curr;
        break;
      }
      curr = curr.parentElement;
    }
  }

  const selects = panel ? Array.from(panel.querySelectorAll('select')) : Array.from(document.querySelectorAll('select'));
  const numbers = panel ? Array.from(panel.querySelectorAll('input[type="number"]')) : Array.from(document.querySelectorAll('input[type="number"]'));

  let leagueSelect = null;
  let playoffSelect = null;

  selects.forEach(sel => {
    const combinedText = [
      sel.id || '',
      sel.name || '',
      sel.getAttribute('aria-label') || '',
      ...Array.from(sel.options || []).map(o => `${o.value} ${o.textContent || ''}`)
    ].join(' ').toLowerCase();

    if (
      combinedText.includes('grupo único') ||
      combinedText.includes('zona a') ||
      combinedText.includes('two_groups') ||
      combinedText.includes('leaguemode') ||
      combinedText.includes('fase regular')
    ) {
      if (!leagueSelect) leagueSelect = sel;
    } else if (
      combinedText.includes('top 8') ||
      combinedText.includes('top 7') ||
      combinedText.includes('top 6') ||
      combinedText.includes('playoffmode') ||
      combinedText.includes('playoffs')
    ) {
      if (!playoffSelect) playoffSelect = sel;
    }
  });

  if (!leagueSelect && selects[0]) leagueSelect = selects[0];
  if (!playoffSelect && selects[1] && selects[1] !== leagueSelect) playoffSelect = selects[1];

  let promoteInput = null;
  let relegateInput = null;
  numbers.forEach(inp => {
    const labelText = [
      inp.id || '',
      inp.name || '',
      inp.closest('label')?.textContent || '',
      inp.parentElement?.textContent || ''
    ].join(' ').toLowerCase();

    if (labelText.includes('ascenso') || labelText.includes('promote')) {
      promoteInput = inp;
    } else if (labelText.includes('descenso') || labelText.includes('relegate')) {
      relegateInput = inp;
    }
  });

  if (!promoteInput && numbers[0]) promoteInput = numbers[0];
  if (!relegateInput && numbers[1] && numbers[1] !== promoteInput) relegateInput = numbers[1];

  return { leagueSelect, playoffSelect, promoteInput, relegateInput, recBtn };
}

function applyFormatValuesToCategory(cat, explicitPayload = null) {
  if (!cat) return;

  const { leagueSelect, playoffSelect, promoteInput, relegateInput } = getFormatControlsInPanel();

  if (leagueSelect) {
    const rawLeague = leagueSelect.value || leagueSelect.options?.[leagueSelect.selectedIndex]?.text || '';
    if (String(rawLeague).trim() !== '') {
      cat.leagueMode = normalizeLeagueModeValue(rawLeague);
    }
  }

  if (playoffSelect) {
    const rawPlayoff = playoffSelect.value || playoffSelect.options?.[playoffSelect.selectedIndex]?.text || '';
    if (String(rawPlayoff).trim() !== '') {
      cat.playoffMode = normalizePlayoffModeValue(rawPlayoff);
    }
  }

  if (promoteInput && String(promoteInput.value ?? '').trim() !== '') {
    cat.promoteCount = Math.max(0, Number(promoteInput.value) || 0);
  }
  if (relegateInput && String(relegateInput.value ?? '').trim() !== '') {
    cat.relegateCount = Math.max(0, Number(relegateInput.value) || 0);
  }

  if (explicitPayload && typeof explicitPayload === 'object') {
    if (explicitPayload.leagueMode !== undefined) {
      cat.leagueMode = normalizeLeagueModeValue(explicitPayload.leagueMode);
    }
    if (explicitPayload.playoffMode !== undefined) {
      cat.playoffMode = normalizePlayoffModeValue(explicitPayload.playoffMode);
    }
    if (explicitPayload.promoteCount !== undefined) {
      cat.promoteCount = Math.max(0, Number(explicitPayload.promoteCount) || 0);
    }
    if (explicitPayload.relegateCount !== undefined) {
      cat.relegateCount = Math.max(0, Number(explicitPayload.relegateCount) || 0);
    }
  }

  if (!cat.leagueMode) cat.leagueMode = 'single';
  if (!cat.playoffMode) cat.playoffMode = 'top7';
  if (cat.promoteCount === undefined || Number(cat.promoteCount) === 6) cat.promoteCount = 2;
  if (cat.relegateCount === undefined || Number(cat.relegateCount) === 6) cat.relegateCount = 2;

  if (cat.leagueMode === 'two_groups') {
    assignBalancedZonesToTeams(cat.teams);
  } else {
    clearTeamZones(cat.teams);
  }

  cat.playoffs = cat.playoffs || {};
  cat.playoffs.mode = cat.playoffMode;
  cat.playoffs.leagueMode = cat.leagueMode;
  cat.playoffs.promoteCount = cat.promoteCount ?? 2;
  cat.playoffs.relegateCount = cat.relegateCount ?? 2;
}

function syncFormatControlsFromCategory(cat) {
  if (!cat) return;
  const { leagueSelect, playoffSelect, promoteInput, relegateInput } = getFormatControlsInPanel();

  if (leagueSelect) {
    const targetMode = normalizeLeagueModeValue(cat.leagueMode);
    const matchedOpt = Array.from(leagueSelect.options || []).find(opt => {
      const valMatch = normalizeLeagueModeValue(opt.value) === targetMode;
      const txtMatch = normalizeLeagueModeValue(opt.textContent || '') === targetMode;
      return valMatch || txtMatch;
    });
    if (matchedOpt) leagueSelect.value = matchedOpt.value;
  }

  if (playoffSelect) {
    const targetPo = normalizePlayoffModeValue(cat.playoffMode);
    const matchedPo = Array.from(playoffSelect.options || []).find(opt => {
      const valMatch = normalizePlayoffModeValue(opt.value) === targetPo;
      const txtMatch = normalizePlayoffModeValue(opt.textContent || '') === targetPo;
      return valMatch || txtMatch;
    });
    if (matchedPo) playoffSelect.value = matchedPo.value;
  }

  if (cat.promoteCount === undefined || Number(cat.promoteCount) === 6) cat.promoteCount = 2;
  if (cat.relegateCount === undefined || Number(cat.relegateCount) === 6) cat.relegateCount = 2;

  if (promoteInput) {
    promoteInput.value = String(cat.promoteCount);
  }
  if (relegateInput) {
    relegateInput.value = String(cat.relegateCount);
  }
}

function updateCatFormat(arg1 = null, arg2 = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede cambiar el formato.', 'info');
    return;
  }
  if (typeof state !== 'object' || !state) return;
  if (typeof ensureDefaultCategories === 'function') ensureDefaultCategories();

  const cats = Array.isArray(state.categories) ? state.categories : [];
  const cat =
    (arg2 ? cats.find(c => c.id === arg2) : null) ||
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    cats[0];

  if (!cat) return;

  const isElem = arg1 && typeof arg1 === 'object' && ('value' in arg1 || 'tagName' in arg1);
  const explicit = !isElem && arg1 && typeof arg1 === 'object' ? arg1 : null;

  applyFormatValuesToCategory(cat, explicit);

  if (typeof saveState === 'function') saveState();
  syncFormatControlsFromCategory(cat);
  if (typeof render === 'function') render();
  if (typeof showToast === 'function') {
    const modeLabel = cat.leagueMode === 'two_groups'
      ? '2 Grupos (Zona A y Zona B)'
      : cat.leagueMode === 'ida_vuelta'
        ? 'Ida y Vuelta'
        : 'Liga Grupo Único';
    showToast(
      `Formato seleccionado: ${modeLabel} · ${cat.playoffMode.toUpperCase()}. Pulsa "Generar / Actualizar Fixture Actual" para aplicarlo.`,
      'info'
    );
  }
}

window.updateCatFormat = updateCatFormat;

function exportJSON() {
  try {
    const payload = typeof state === 'object' && state ? state : { categories: [], players: [] };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `liga-padel-respaldo-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Archivo JSON exportado correctamente.', 'success');
  } catch (err) {
    console.error('Error exportando JSON:', err);
    showToast(`No se pudo exportar JSON: ${err.message}`, 'error');
  }
}

function importJSON(inputOrEvent) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede importar datos.', 'info');
    return;
  }
  const input = inputOrEvent?.target || inputOrEvent;
  const file = input?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(String(e.target?.result || '{}'));
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('El archivo JSON no tiene un objeto válido.');
      }

      if (typeof state !== 'object' || !state) {
        window.state = {};
        state = window.state;
      }

      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, parsed);
      ensureDefaultCategories();

      if (typeof saveStateToSQLite === 'function') {
        try { saveStateToSQLite(state); } catch (_err) {}
      }
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
      fixUndefinedSeasonLabels(state?.seasonNumber || state?.currentSeason || state?.season || 1);
      injectResetAllButton();
      hidePlayoffManualAdvanceButtons();
      showToast('Respaldo JSON importado correctamente.', 'success');
    } catch (err) {
      console.error('Error importando JSON:', err);
      showToast(`No se pudo importar el JSON: ${err.message}`, 'error');
    } finally {
      if (input) input.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

window.exportJSON = exportJSON;
window.exportData = exportJSON;
window.exportDataJSON = exportJSON;
window.handleExportJSON = exportJSON;

window.importJSON = importJSON;
window.importData = importJSON;
window.importDataJSON = importJSON;
window.handleImportJSON = importJSON;

function getCategorySlotKey(cat) {
  const id = String(cat?.id || '').toLowerCase().trim();
  const name = String(cat?.name || '').toLowerCase().trim();

  if (id === 'cat_3honor' || id.includes('honor') || name.includes('honor')) return 'honor';
  if (id === 'cat_3ascenso' || id.includes('ascenso') || name.includes('ascenso')) return 'ascenso';
  if (id === 'cat_4ta' || id.includes('4ta') || name.includes('4ta')) return '4ta';
  if (id === 'cat_5ta' || id.includes('5ta') || name.includes('5ta')) return '5ta';
  return null;
}

function normalizeCategoriesCollection(rawCats) {
  const defs = [
    { key: 'honor', id: 'cat_3honor', name: '3era de Honor', promoteCount: 2, relegateCount: 2 },
    { key: 'ascenso', id: 'cat_3ascenso', name: '3era de Ascenso', promoteCount: 2, relegateCount: 2 },
    { key: '4ta', id: 'cat_4ta', name: '4ta Categoría', promoteCount: 2, relegateCount: 2 },
    { key: '5ta', id: 'cat_5ta', name: '5ta Categoría', promoteCount: 2, relegateCount: 2 }
  ];

  const byKey = new Map();
  const extras = [];

  (Array.isArray(rawCats) ? rawCats : []).forEach(cat => {
    const slot = getCategorySlotKey(cat);
    if (slot && !byKey.has(slot)) {
      byKey.set(slot, cat);
    } else if (!slot) {
      extras.push(cat);
    }
  });

  const ordered = defs.map(def => {
    const existing = byKey.get(def.key);
    if (!existing) {
      return {
        id: def.id,
        name: def.name,
        leagueMode: 'single',
        playoffMode: 'top7',
        promoteCount: 2,
        relegateCount: 2,
        teams: [],
        matches: [],
        playoffs: null
      };
    }
    if (!existing.id) existing.id = def.id;
    if (!existing.name || !existing.name.trim()) existing.name = def.name;
    if (existing.promoteCount === undefined || Number(existing.promoteCount) === 6) {
      existing.promoteCount = 2;
    }
    if (existing.relegateCount === undefined || Number(existing.relegateCount) === 6) {
      existing.relegateCount = 2;
    }
    return existing;
  });

  return [...ordered, ...extras];
}

function ensureDefaultCategories() {
  if (typeof state !== 'object' || !state) return;
  state.categories = normalizeCategoriesCollection(state.categories);
  if (!state.activeCategoryId && state.categories.length) {
    state.activeCategoryId = state.categories[0].id;
  }
}

async function clearSQLiteIfAvailable(emptyState) {
  try {
    if (typeof resetSQLiteState === 'function') {
      await resetSQLiteState(emptyState);
    } else if (typeof saveStateToSQLite === 'function') {
      await saveStateToSQLite(emptyState);
    } else if (typeof sqliteDb !== 'undefined' && sqliteDb && typeof sqliteDb.exec === 'function') {
      try { sqliteDb.exec('DELETE FROM app_state;'); } catch (_e) {}
      try { sqliteDb.exec('DELETE FROM state;'); } catch (_e) {}
    }
  } catch (err) {
    console.warn('No se pudo limpiar SQLite directamente:', err);
  }
}

function executeResetAllEmptyNow() {
  if (typeof state !== 'object' || !state) {
    window.state = {};
    state = window.state;
  }

  const baseEmpty = (typeof defaultState === 'object' && defaultState)
    ? JSON.parse(JSON.stringify(defaultState))
    : {};

  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, baseEmpty);

  state.players = [];
  state.categories = normalizeCategoriesCollection([]);
  state.categories.forEach(cat => {
    cat.teams = [];
    cat.matches = [];
    cat.playoffs = null;
  });
  state.activeCategoryId = state.categories[0]?.id || 'cat_3honor';
  state.selectedRound = 'all';
  setActiveSeasonState(state, 1);
  state.viewingHistoryId = null;
  state.archivedSeasons = [];
  state.seasons = [];
  state.history = [];

  if (typeof localStorage !== 'undefined') {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        const lk = key.toLowerCase();
        if (
          lk.includes('padel') ||
          lk.includes('liga') ||
          lk.includes('season') ||
          lk.includes('archive') ||
          lk.includes('state') ||
          lk.includes('tour')
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (_e) {}
  }

  clearSQLiteIfAvailable(state);

  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  fixUndefinedSeasonLabels(1);
  injectResetAllButton();
  hidePlayoffManualAdvanceButtons();
  showToast('Todo borrado: sistema vacío desde la Temporada 1.', 'success');
}

function handleResetAllEmpty() {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede reiniciar datos.', 'info');
    return;
  }
  if (typeof requestConfirmAction === 'function') {
    requestConfirmAction(
      '🧹 Reiniciar Todo desde Temporada 1',
      '¿Seguro que deseas borrar <strong>todo</strong> (temporadas archivadas, jugadores, parejas, partidos y playoffs) para dejar el sistema completamente vacío desde la <strong>Temporada 1</strong>?',
      executeResetAllEmptyNow
    );
  } else {
    executeResetAllEmptyNow();
  }
}

window.handleResetAllEmpty = handleResetAllEmpty;
window.resetAllEmpty = handleResetAllEmpty;
window.resetEverythingFromSeason1 = handleResetAllEmpty;

function buildSimulatedSetsForMatch(seedNum, aWins) {
  const straightSetPatterns = [
    [[6, 3], [6, 4]],
    [[6, 2], [6, 4]],
    [[7, 5], [6, 3]],
    [[6, 4], [7, 5]],
    [[6, 1], [6, 3]]
  ];
  const threeSetPatterns = [
    [[6, 4], [3, 6], [6, 2]],
    [[4, 6], [6, 3], [7, 5]],
    [[7, 6], [4, 6], [6, 4]]
  ];

  const useThreeSets = seedNum % 4 === 0;
  const pattern = useThreeSets
    ? threeSetPatterns[seedNum % threeSetPatterns.length]
    : straightSetPatterns[seedNum % straightSetPatterns.length];

  return pattern.map(([g1, g2]) => (aWins ? [g1, g2] : [g2, g1]));
}

function simulateSeasonEndForCategory(cat, catIndex = 0) {
  if (!cat) return;
  generateFixtureForCategory(cat, { forceRebuild: true });

  const teams = Array.isArray(cat.teams) ? cat.teams : [];
  const teamIndexById = new Map(teams.map((t, idx) => [t.id, idx]));

  (cat.matches || []).forEach((m, mIdx) => {
    const idxA = teamIndexById.get(m.teamAId) ?? 0;
    const idxB = teamIndexById.get(m.teamBId) ?? 1;
    const scoreA = (teams.length - idxA) * 3 + ((mIdx * 7 + catIndex * 11) % 5);
    const scoreB = (teams.length - idxB) * 3 + ((mIdx * 5 + catIndex * 13 + 2) % 5);
    const aWins = scoreA >= scoreB;

    m.sets = buildSimulatedSetsForMatch(catIndex * 100 + mIdx + 1, aWins);
    m.played = true;
    m.delayed = false;
    m.delayedNote = '';
    m.woAbsent = null;
  });

  if (teams.length >= 2) {
    syncPlayoffsFromStandings(cat);
    const po = cat.playoffs;
    if (po) {
      const resolveNode = (nodeKey, seedBase) => {
        const node = po[nodeKey];
        if (!node || !node.teamA || !node.teamB) return;
        const aWins = (seedBase % 2) === 0;
        node.sets = buildSimulatedSetsForMatch(seedBase, aWins);
        node.winner = aWins ? node.teamA : node.teamB;
      };

      ['qf1', 'qf2', 'qf3', 'qf4'].forEach((k, i) => resolveNode(k, catIndex * 50 + i + 1));
      propagatePlayoffs(cat);

      resolveNode('sf1', catIndex * 50 + 11);
      resolveNode('sf2', catIndex * 50 + 12);
      propagatePlayoffs(cat);

      resolveNode('thirdPlace', catIndex * 50 + 21);
      resolveNode('final', catIndex * 50 + 22);
      propagatePlayoffs(cat);
    }
  }
}

function seedDemoPlayersAndTeams(targetState, simulateEndOfSeason = false) {
  if (!targetState || typeof targetState !== 'object') return;
  targetState.categories = normalizeCategoriesCollection(targetState.categories);

  const firstNames = [
    'Matías', 'Sebastián', 'Tomás', 'Nicolás', 'Cristóbal', 'Felipe', 'Diego', 'Ignacio',
    'Vicente', 'Martín', 'Joaquín', 'Benjamín', 'Andrés', 'Rodrigo', 'Gonzalo', 'Javier',
    'Pablo', 'Alejandro', 'Franco', 'Lucas', 'Daniel', 'Camilo', 'Eduardo', 'Esteban',
    'Álvaro', 'Maximiliano', 'Agustín', 'Gabriel', 'Mauricio', 'Patricio', 'Claudio', 'Marcelo',
    'Carlos', 'Jorge', 'Héctor', 'Sergio', 'Raúl', 'Guillermo', 'Fernando', 'Enrique',
    'Valentina', 'Sofía', 'Camila', 'Javiera', 'Francisca', 'Constanza', 'Catalina', 'Fernanda',
    'Antonia', 'Isidora', 'Martina', 'Daniela', 'Carolina', 'Paola', 'Macarena', 'Valeria',
    'Bárbara', 'Belén', 'Natalia', 'Alejandra', 'Rocío', 'Florencia', 'Paulina', 'Consuelo',
    'Lorena', 'Claudia', 'Andrea', 'María', 'Paula', 'Gabriela', 'Vanessa', 'Pilar'
  ];

  const lastNames = [
    'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
    'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres',
    'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Orellana', 'Tapia', 'Reyes',
    'Gutiérrez', 'Castro', 'Pizarro', 'Vargas', 'Núñez', 'Jara', 'Vergara', 'Rivera',
    'Figueroa', 'Riquelme', 'García', 'Miranda', 'Carrasco', 'Alarcón', 'Sandoval', 'Zúñiga',
    'Bravo', 'Bustos', 'Cárdenas', 'Vega', 'Naranjo', 'Molina', 'Leiva', 'Aravena',
    'Maldonado', 'Ortega', 'Navarro', 'Cortés', 'Garrido', 'Medina', 'Ríos', 'Salazar',
    'Domínguez', 'Peña', 'Valdivia', 'Acuña', 'Poblete', 'Farías', 'Henríquez', 'Osorio',
    'Toro', 'Hidalgo', 'Cifuentes', 'Lagos', 'Alvarado', 'Barrios', 'Saavedra', 'Pacheco'
  ];

  const totalPairsTarget = 14 + 16 + 20 + 15;
  const totalPlayersNeeded = totalPairsTarget * 2;
  const usedFullNames = new Set();
  const players = [];
  const sides = ['Drive', 'Revés', 'Ambos lados'];
  const hands = ['Diestro', 'Zurdo'];
  const rackets = ['Bullpadel Vertex', 'Nox ML10', 'Adidas Metalbone', 'Babolat Viper', 'Head Gravity', 'StarVie Metheora'];

  let fnIdx = 0;
  let lnIdx = 0;
  let guard = 0;

  while (players.length < totalPlayersNeeded && guard < 8000) {
    guard++;
    const fn = firstNames[(fnIdx + Math.floor(guard / firstNames.length)) % firstNames.length];
    const ln1 = lastNames[lnIdx % lastNames.length];
    const ln2 = lastNames[(lnIdx + 17 + Math.floor(guard / lastNames.length)) % lastNames.length];
    lnIdx++;
    fnIdx++;

    const fullName = `${fn} ${ln1} ${ln2}`;
    if (usedFullNames.has(fullName)) continue;
    usedFullNames.add(fullName);

    const idx = players.length;
    players.push({
      id: `ply_demo_${String(idx + 1).padStart(3, '0')}`,
      name: fullName,
      side: sides[idx % sides.length],
      hand: hands[idx % hands.length],
      phone: `+56 9 ${String(40000000 + idx * 7319).slice(0, 8)}`,
      racket: rackets[idx % rackets.length],
      social: `@${fn.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${ln1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${idx + 1}`,
      bio: 'Jugador demo generado automáticamente',
      points: 0,
      rankingPoints: 0,
      seasonHistory: [],
      avatar: null,
      photos: []
    });
  }

  targetState.players = players;

  const quotas = [
    { key: 'honor', count: 14 },
    { key: 'ascenso', count: 16 },
    { key: '4ta', count: 20 },
    { key: '5ta', count: 15 }
  ];

  const categories = Array.isArray(targetState.categories) ? targetState.categories : [];
  const usedPlayerIds = new Set();
  const usedPairSignatures = new Set();
  let cursor = 0;

  quotas.forEach((q, qIdx) => {
    const cat = categories.find(c => getCategorySlotKey(c) === q.key) || categories[qIdx];
    if (!cat) return;

    const teams = [];
    for (let i = 0; i < q.count; i++) {
      while (cursor < players.length && usedPlayerIds.has(players[cursor].id)) cursor++;
      const p1 = players[cursor++];
      while (cursor < players.length && usedPlayerIds.has(players[cursor].id)) cursor++;
      const p2 = players[cursor++];
      if (!p1 || !p2) break;

      const pairSig = [p1.id, p2.id].sort().join('__');
      if (usedPairSignatures.has(pairSig)) continue;

      usedPlayerIds.add(p1.id);
      usedPlayerIds.add(p2.id);
      usedPairSignatures.add(pairSig);

      const last1 = p1.name.trim().split(/\s+/)[1] || p1.name;
      const last2 = p2.name.trim().split(/\s+/)[1] || p2.name;

      teams.push({
        id: `tm_demo_${qIdx + 1}_${String(i + 1).padStart(2, '0')}`,
        name: `${last1} / ${last2}`,
        player1Id: p1.id,
        player2Id: p2.id,
        group: cat.leagueMode === 'two_groups' ? (i % 2 === 0 ? 'A' : 'B') : null,
        zone: cat.leagueMode === 'two_groups' ? (i % 2 === 0 ? 'Zona A' : 'Zona B') : null,
        createdAt: new Date().toISOString()
      });
    }

    cat.teams = teams;
    cat.matches = [];
    cat.playoffs = null;

    if (simulateEndOfSeason) {
      simulateSeasonEndForCategory(cat, qIdx);
    }
  });

  if (!targetState.activeCategoryId && targetState.categories.length) {
    targetState.activeCategoryId = targetState.categories[0].id;
  }
}

window.seedDemoPlayersAndTeams = seedDemoPlayersAndTeams;

function handleResetDemo() {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede reiniciar la demo.', 'info');
    return;
  }
  requestConfirmAction(
    '🔄 Reiniciar Demo / Simular Fin de Temporada',
    '¿Seguro que deseas reiniciar la demo? Se crearán 130 jugadores únicos y 65 parejas (14 Honor, 16 Ascenso, 20 4ta, 15 5ta) y se completarán todos los partidos de liga y playoffs para simular el cierre de temporada.',
    () => {
      if (typeof state !== 'object' || !state) return;

      if (typeof defaultState === 'object' && defaultState) {
        const fresh = JSON.parse(JSON.stringify(defaultState));
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, fresh);
      } else {
        state.players = [];
        state.categories = [];
        state.selectedRound = 'all';
      }

      setActiveSeasonState(state, 1);
      seedDemoPlayersAndTeams(state, true);

      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
      fixUndefinedSeasonLabels(1);
      injectResetAllButton();
      hidePlayoffManualAdvanceButtons();
      showToast('Fin de temporada simulado: todos los partidos y llaves cargados en las 4 categorías.', 'success');
    }
  );
}

window.handleResetDemo = handleResetDemo;
window.resetDemo = handleResetDemo;

function getStandingsOrFallback(cat, group = null) {
  const raw = typeof computeStandings === 'function' ? computeStandings(cat, group) : [];
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(item => item.teamId || item.id).filter(Boolean);
  }
  const teams = Array.isArray(cat?.teams) ? cat.teams : [];
  const filtered = group ? teams.filter(t => getTeamZoneKey(cat, t) === (String(group).toUpperCase().endsWith('B') ? 'B' : 'A')) : teams;
  return filtered.map(t => t.id).filter(Boolean);
}

function syncPlayoffsFromStandings(targetCat = null) {
  const isManualClick = !targetCat;
  if (isManualClick && !window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede cargar clasificados.', 'info');
    return;
  }

  const cat =
    targetCat ||
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    (Array.isArray(state?.categories) ? state.categories[0] : null);

  if (!cat) {
    if (isManualClick) showToast('No hay categoría activa para cargar clasificados.', 'error');
    return;
  }

  applyFormatValuesToCategory(cat);

  const teams = Array.isArray(cat.teams) ? cat.teams : [];
  if (teams.length < 2) {
    if (isManualClick) {
      showToast(`Se necesitan al menos 2 parejas en ${cat.name} para armar llaves.`, 'warning');
    }
    return;
  }

  const po = typeof ensurePlayoffBracket === 'function'
    ? ensurePlayoffBracket(cat)
    : (cat.playoffs = cat.playoffs || {});

  po.promoteCount = Math.max(0, Number(cat.promoteCount) || 0);
  po.relegateCount = Math.max(0, Number(cat.relegateCount) || 0);

  const getIdAt = (ids, pos1Based) => ids[pos1Based - 1] || null;

  if (cat.leagueMode === 'two_groups') {
    const idsA = getStandingsOrFallback(cat, 'A');
    const idsB = getStandingsOrFallback(cat, 'B');

    po.mode = 'top8';
    po.qf1 = { ...(po.qf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(idsA, 1), teamB: getIdAt(idsB, 4), labelA: '1°A', labelB: '4°B' };
    po.qf2 = { ...(po.qf2 || { winner: null, court: 'Cancha 2', time: '19:30', sets: [] }), teamA: getIdAt(idsB, 2), teamB: getIdAt(idsA, 3), labelA: '2°B', labelB: '3°A' };
    po.qf3 = { ...(po.qf3 || { winner: null, court: 'Cancha 1', time: '21:00', sets: [] }), teamA: getIdAt(idsB, 1), teamB: getIdAt(idsA, 4), labelA: '1°B', labelB: '4°A' };
    po.qf4 = { ...(po.qf4 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: getIdAt(idsA, 2), teamB: getIdAt(idsB, 3), labelA: '2°A', labelB: '3°B' };
    po.sf1 = { ...(po.sf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: po.qf1.winner || null, teamB: po.qf2.winner || null, labelA: 'Ganador QF1', labelB: 'Ganador QF2' };
    po.sf2 = { ...(po.sf2 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: po.qf3.winner || null, teamB: po.qf4.winner || null, labelA: 'Ganador QF3', labelB: 'Ganador QF4' };
  } else {
    const ids = getStandingsOrFallback(cat);
    const mode = normalizePlayoffModeValue(cat.playoffMode || po.mode || 'top7');
    cat.playoffMode = mode;
    po.mode = mode;

    if (mode === 'top6') {
      po.qf1 = { ...(po.qf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(ids, 3), teamB: getIdAt(ids, 6), labelA: '3°', labelB: '6°' };
      po.qf2 = { ...(po.qf2 || { winner: null, court: 'Cancha 2', time: '19:30', sets: [] }), teamA: getIdAt(ids, 4), teamB: getIdAt(ids, 5), labelA: '4°', labelB: '5°' };
      delete po.qf3;
      delete po.qf4;
      po.sf1 = { ...(po.sf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(ids, 1), teamB: po.qf2.winner || null, labelA: '1°', labelB: 'Ganador QF2' };
      po.sf2 = { ...(po.sf2 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: getIdAt(ids, 2), teamB: po.qf1.winner || null, labelA: '2°', labelB: 'Ganador QF1' };
    } else if (mode === 'top8') {
      po.qf1 = { ...(po.qf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(ids, 1), teamB: getIdAt(ids, 8), labelA: '1°', labelB: '8°' };
      po.qf2 = { ...(po.qf2 || { winner: null, court: 'Cancha 2', time: '19:30', sets: [] }), teamA: getIdAt(ids, 4), teamB: getIdAt(ids, 5), labelA: '4°', labelB: '5°' };
      po.qf3 = { ...(po.qf3 || { winner: null, court: 'Cancha 1', time: '21:00', sets: [] }), teamA: getIdAt(ids, 2), teamB: getIdAt(ids, 7), labelA: '2°', labelB: '7°' };
      po.qf4 = { ...(po.qf4 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: getIdAt(ids, 3), teamB: getIdAt(ids, 6), labelA: '3°', labelB: '6°' };
      po.sf1 = { ...(po.sf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: po.qf1.winner || null, teamB: po.qf2.winner || null, labelA: 'Ganador QF1', labelB: 'Ganador QF2' };
      po.sf2 = { ...(po.sf2 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: po.qf3.winner || null, teamB: po.qf4.winner || null, labelA: 'Ganador QF3', labelB: 'Ganador QF4' };
    } else {
      po.qf1 = { ...(po.qf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(ids, 2), teamB: getIdAt(ids, 7), labelA: '2°', labelB: '7°' };
      po.qf2 = { ...(po.qf2 || { winner: null, court: 'Cancha 2', time: '19:30', sets: [] }), teamA: getIdAt(ids, 3), teamB: getIdAt(ids, 6), labelA: '3°', labelB: '6°' };
      po.qf3 = { ...(po.qf3 || { winner: null, court: 'Cancha 1', time: '21:00', sets: [] }), teamA: getIdAt(ids, 4), teamB: getIdAt(ids, 5), labelA: '4°', labelB: '5°' };
      delete po.qf4;
      po.sf1 = { ...(po.sf1 || { winner: null, court: 'Cancha 1', time: '19:30', sets: [] }), teamA: getIdAt(ids, 1), teamB: po.qf3.winner || null, labelA: '1°', labelB: 'Ganador QF3' };
      po.sf2 = { ...(po.sf2 || { winner: null, court: 'Cancha 2', time: '21:00', sets: [] }), teamA: po.qf1.winner || null, teamB: po.qf2.winner || null, labelA: 'Ganador QF1', labelB: 'Ganador QF2' };
    }
  }

  if (!po.thirdPlace) {
    po.thirdPlace = { teamA: null, teamB: null, winner: null, labelA: 'Perdedor SF1', labelB: 'Perdedor SF2', court: 'Cancha 2', time: '19:30', sets: [] };
  }
  if (!po.final) {
    po.final = { teamA: null, teamB: null, winner: null, labelA: 'Ganador SF1', labelB: 'Ganador SF2', court: 'Cancha 1', time: '21:00', sets: [] };
  }

  propagatePlayoffs(cat);

  if (isManualClick) {
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    syncFormatControlsFromCategory(cat);
    injectResetAllButton();
    hidePlayoffManualAdvanceButtons();
    showToast(
      `Clasificados cargados en Playoffs (${cat.name} · ${po.mode.toUpperCase()} · Asc:${po.promoteCount}/Desc:${po.relegateCount}).`,
      'success'
    );
  }
}

window.syncPlayoffsFromStandings = syncPlayoffsFromStandings;

if (typeof selectCategory !== 'function') {
  function selectCategory(categoryId) {
    if (!categoryId || typeof state !== 'object' || !state) return;
    ensureDefaultCategories();
    const exists = (state.categories || []).some(c => c.id === categoryId);
    if (exists) {
      state.activeCategoryId = categoryId;
    }
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    const current = (state.categories || []).find(c => c.id === state.activeCategoryId);
    syncFormatControlsFromCategory(current);
    injectResetAllButton();
  }
}

if (typeof setRoundFilter !== 'function') {
  function setRoundFilter(roundValue) {
    if (typeof state !== 'object' || !state) return;
    state.selectedRound = roundValue ?? 'all';
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
  }
}

if (typeof toggleQuickDelay !== 'function') {
  function toggleQuickDelay(arg1, arg2 = null) {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede modificar partidos.', 'info');
      return;
    }
    const cats = typeof getDisplayedCategories === 'function' ? getDisplayedCategories() : (state?.categories || []);
    let cat = cats.find(c => c.id === arg1 || c.id === arg2);
    let match = null;

    if (cat) {
      const targetMatchId = arg1 === cat.id ? arg2 : arg1;
      match = (cat.matches || []).find(m => m.id === targetMatchId);
    }
    if (!match) {
      for (const c of cats) {
        const found = (c.matches || []).find(m => m.id === arg1 || m.id === arg2);
        if (found) {
          cat = c;
          match = found;
          break;
        }
      }
    }

    if (!cat || !match) {
      showToast('No se encontró el partido para marcar/desmarcar retraso.', 'error');
      return;
    }

    const nextDelayed = !Boolean(match.delayed);
    match.delayed = nextDelayed;
    if (nextDelayed) {
      match.played = false;
      if (!match.delayedNote) {
        match.delayedNote = 'Partido retrasado / reprogramado';
      }
    } else {
      match.delayedNote = '';
    }

    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
    showToast(
      nextDelayed ? `Partido marcado como retrasado en ${cat.name}.` : `Estado de retraso retirado en ${cat.name}.`,
      nextDelayed ? 'warning' : 'success'
    );
  }
}

if (typeof handleBackdropClick !== 'function') {
  function handleBackdropClick(event, modalId = null) {
    const backdrop = event?.currentTarget || event?.target;
    if (!backdrop) return;
    if (event.target === backdrop) {
      if (modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('hidden');
      } else {
        backdrop.classList.add('hidden');
      }
    }
  }
}

function getTeamDisplayName(cat, teamId, fallback = 'Pareja') {
  if (!teamId) return fallback;
  const team = (cat?.teams || []).find(t => t.id === teamId);
  if (team?.name) return team.name;
  const players = state?.players || [];
  if (team) {
    const p1 = players.find(p => p.id === team.player1Id)?.name;
    const p2 = players.find(p => p.id === team.player2Id)?.name;
    if (p1 || p2) return [p1, p2].filter(Boolean).join(' / ');
  }
  return fallback;
}

function getSetInputPair(root, index) {
  const elA =
    root.querySelector(`#set${index}A`) ||
    root.querySelector(`#set${index}_a`) ||
    root.querySelector(`#set-${index}-a`) ||
    root.querySelector(`#scoreA${index}`) ||
    root.querySelector(`#matchSet${index}A`) ||
    root.querySelector(`[name="set${index}A"]`) ||
    root.querySelector(`[name="set${index}_a"]`) ||
    root.querySelector(`[data-set="${index}"][data-side="A"]`) ||
    root.querySelector(`[data-set="${index}"][data-side="a"]`);

  const elB =
    root.querySelector(`#set${index}B`) ||
    root.querySelector(`#set${index}_b`) ||
    root.querySelector(`#set-${index}-b`) ||
    root.querySelector(`#scoreB${index}`) ||
    root.querySelector(`#matchSet${index}B`) ||
    root.querySelector(`[name="set${index}B"]`) ||
    root.querySelector(`[name="set${index}_b"]`) ||
    root.querySelector(`[data-set="${index}"][data-side="B"]`) ||
    root.querySelector(`[data-set="${index}"][data-side="b"]`);

  return { elA, elB };
}

function getScoreboardNumericInputs(root) {
  const scope = root || document;
  const allNums = Array.from(scope.querySelectorAll('input[type="number"], input[inputmode="numeric"]')).filter(inp => {
    if (inp.type === 'checkbox' || inp.type === 'radio') return false;
    const id = (inp.id || '').toLowerCase();
    const name = (inp.name || '').toLowerCase();
    if (id.includes('court') || id.includes('promote') || id.includes('relegate') || name.includes('promote') || name.includes('relegate')) {
      return false;
    }
    return true;
  });

  if (allNums.length === 6) {
    return {
      mode: 'columns3x2',
      pairs: [
        [allNums[0], allNums[3]],
        [allNums[1], allNums[4]],
        [allNums[2], allNums[5]]
      ]
    };
  }

  const pairs = [];
  for (let i = 0; i + 1 < allNums.length; i += 2) {
    pairs.push([allNums[i], allNums[i + 1]]);
  }
  return { mode: 'consecutive', pairs };
}

function collectModalSetInputs(modal) {
  const sets = [];
  const root = modal || document;
  let foundNamedPair = false;

  for (let i = 1; i <= 5; i++) {
    const { elA, elB } = getSetInputPair(root, i);
    if (elA || elB) foundNamedPair = true;
    const rawA = elA ? String(elA.value).trim() : '';
    const rawB = elB ? String(elB.value).trim() : '';
    if (rawA !== '' && rawB !== '') {
      sets.push([Number(rawA), Number(rawB)]);
    }
  }

  if (foundNamedPair) return sets;

  const { pairs } = getScoreboardNumericInputs(root);
  pairs.forEach(([inpA, inpB]) => {
    const rawA = inpA ? String(inpA.value ?? '').trim() : '';
    const rawB = inpB ? String(inpB.value ?? '').trim() : '';
    if (rawA !== '' && rawB !== '') {
      sets.push([Number(rawA), Number(rawB)]);
    }
  });

  return sets;
}

function getModalWoAbsentSide(modal, match = null) {
  const sel =
    document.getElementById('modalWOAbsent') ||
    document.getElementById('woAbsentTeamSelect') ||
    (modal
      ? Array.from(modal.querySelectorAll('select')).find(s => {
          const txt = (s.id || s.name || s.closest('label')?.textContent || '').toLowerCase();
          return txt.includes('wo') || txt.includes('ausente') || txt.includes('walkover') || txt.includes('pareja');
        })
      : null);

  if (sel && (sel.value === 'A' || sel.value === 'B')) {
    return sel.value;
  }
  if (match?.woAbsent === 'A' || match?.woAbsent === 'B') {
    return match.woAbsent;
  }
  return 'A';
}

function ensureWoTeamSelectorInModal(modal, cat, match) {
  if (!modal) return null;

  const woCheckbox =
    document.getElementById('modalIsWO') ||
    Array.from(modal.querySelectorAll('input[type="checkbox"]')).find(cb => {
      const txt = (cb.closest('label, div')?.textContent || '').toUpperCase();
      return txt.includes('WALKOVER') || txt.includes('W.O.') || txt.includes('NO SE PRESENT');
    });

  if (!woCheckbox) return null;

  const nameA = getTeamDisplayName(cat, match?.teamAId, 'Pareja A');
  const nameB = getTeamDisplayName(cat, match?.teamBId, 'Pareja B');

  let box = document.getElementById('modalWoAbsentBox');
  let sel = document.getElementById('modalWOAbsent');

  if (!box) {
    box = document.createElement('div');
    box.id = 'modalWoAbsentBox';
    box.className =
      'mt-2.5 pt-2.5 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2';

    const lbl = document.createElement('label');
    lbl.htmlFor = 'modalWOAbsent';
    lbl.className = 'text-xs font-semibold text-amber-900';
    lbl.textContent = 'Pareja que no se presentó (W.O.):';

    sel = document.createElement('select');
    sel.id = 'modalWOAbsent';
    sel.className =
      'text-xs font-semibold bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400';

    sel.addEventListener('change', () => {
      if (!window.__isLeagueAdmin) return;
      if (!woCheckbox.checked) {
        woCheckbox.checked = true;
        woCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncModalWoVisualState();
    });

    box.appendChild(lbl);
    box.appendChild(sel);

    const container =
      woCheckbox.closest('div.rounded-xl, div.border, div.bg-amber-50, div.p-3, div.p-4') ||
      woCheckbox.parentElement;
    if (container) {
      container.appendChild(box);
    }
  } else {
    sel = document.getElementById('modalWOAbsent');
  }

  if (sel) {
    const prevSide =
      match?.woAbsent === 'B' || match?.woAbsent === 'A'
        ? match.woAbsent
        : (sel.value === 'B' ? 'B' : 'A');

    sel.innerHTML = '';

    const optA = document.createElement('option');
    optA.value = 'A';
    optA.textContent = nameA;

    const optB = document.createElement('option');
    optB.value = 'B';
    optB.textContent = nameB;

    sel.appendChild(optA);
    sel.appendChild(optB);
    sel.value = prevSide;
  }

  box.style.display = woCheckbox.checked ? 'flex' : 'none';
  return sel;
}

if (typeof updatePointsPreview !== 'function') {
  function updatePointsPreview() {
    const modal = document.getElementById('matchModal');
    if (!modal) return;

    const matchId = document.getElementById('modalMatchId')?.value || modal.dataset.activeMatchId;
    const { cat, match } = findMatchAndCategory(matchId);

    const nameA = getTeamDisplayName(cat, match?.teamAId, 'Pareja A');
    const nameB = getTeamDisplayName(cat, match?.teamBId, 'Pareja B');

    const woCheckbox =
      document.getElementById('modalIsWO') ||
      Array.from(modal.querySelectorAll('input[type="checkbox"]')).find(cb => {
        const txt = (cb.closest('label, div')?.textContent || '').toUpperCase();
        return txt.includes('WALKOVER') || txt.includes('W.O.') || txt.includes('NO SE PRESENT');
      });

    const isWO = Boolean(woCheckbox?.checked);
    const woAbsent = getModalWoAbsentSide(modal, match);

    let sets = [];
    if (isWO) {
      sets = normalizeWoSets(woAbsent) || [];
    } else {
      sets = collectModalSetInputs(modal);
    }

    let summaryText = `${nameA} +0 pts (0–0) · ${nameB} +0 pts`;
    if (sets.length > 0) {
      const res = evaluateMatch(sets, 'A', 'B');
      const award = computeMatchPointsAward(res.setsA, res.setsB, isWO);
      const winnerName = res.winnerId === 'A' ? nameA : nameB;
      const loserName = res.winnerId === 'A' ? nameB : nameA;
      summaryText = `${winnerName} +${award.winnerPts} pts (${res.setsA}–${res.setsB}) · ${loserName} +${award.loserPts} pts`;
    }

    const previewEl = document.getElementById('pointsPreview') || document.getElementById('modalPointsPreview');
    if (previewEl) {
      previewEl.textContent = summaryText;
    }

    const allLeafNodes = Array.from(modal.querySelectorAll('span, div, p, strong'));
    allLeafNodes.forEach(el => {
      if (el.children.length > 0) return;
      const txt = (el.textContent || '').trim();
      if (
        txt === 'Sin marcador ingresado' ||
        txt.startsWith('Ganador:') ||
        (txt.includes('+') && txt.includes('pts'))
      ) {
        el.textContent = summaryText;
      }
    });
  }
}

function applyTeamLabelsToMatchModal(modal, cat, match) {
  if (!modal || !match) return;
  const nameA = getTeamDisplayName(cat, match.teamAId, 'Pareja A');
  const nameB = getTeamDisplayName(cat, match.teamBId, 'Pareja B');

  const labelA = document.getElementById('modalTeamAName') || document.getElementById('labelTeamA');
  const labelB = document.getElementById('modalTeamBName') || document.getElementById('labelTeamB');

  if (labelA) labelA.textContent = nameA;
  if (labelB) labelB.textContent = nameB;

  const elements = Array.from(modal.querySelectorAll('td, th, label, div, span, p'));
  elements.forEach(el => {
    if (el.children.length > 0) return;
    const raw = (el.textContent || '').trim();
    if (raw === 'Pareja A') {
      el.dataset.origPairLabel = 'A';
      el.textContent = nameA;
    } else if (raw === 'Pareja B') {
      el.dataset.origPairLabel = 'B';
      el.textContent = nameB;
    } else if (el.dataset.origPairLabel === 'A') {
      el.textContent = nameA;
    } else if (el.dataset.origPairLabel === 'B') {
      el.textContent = nameB;
    }
  });
}

function findMatchAndCategory(matchId) {
  const cats = typeof getDisplayedCategories === 'function'
    ? getDisplayedCategories()
    : (Array.isArray(state?.categories) ? state.categories : []);

  if (matchId) {
    for (const c of cats) {
      const m = (c.matches || []).find(item => item.id === matchId);
      if (m) return { cat: c, match: m };
    }
  }
  const modal = document.getElementById('matchModal');
  const fallbackId = modal?.dataset?.activeMatchId;
  if (fallbackId) {
    for (const c of cats) {
      const m = (c.matches || []).find(item => item.id === fallbackId);
      if (m) return { cat: c, match: m };
    }
  }
  const activeCat = typeof getActiveCategory === 'function' ? getActiveCategory() : cats[0];
  const m = (activeCat?.matches || []).find(item => item.id === matchId) || null;
  return { cat: activeCat || null, match: m };
}

function saveMatchFromModal(matchId = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede guardar resultados.', 'info');
    return;
  }

  const modal = document.getElementById('matchModal');
  const resolvedId = matchId || document.getElementById('modalMatchId')?.value || modal?.dataset?.activeMatchId;
  const { cat, match } = findMatchAndCategory(resolvedId);

  if (!cat || !match) {
    showToast('No se encontró el partido para guardar.', 'error');
    return;
  }

  const woCheckbox =
    document.getElementById('modalIsWO') ||
    (modal
      ? Array.from(modal.querySelectorAll('input[type="checkbox"]')).find(cb => {
          const txt = (cb.closest('label, div')?.textContent || '').toUpperCase();
          return txt.includes('WALKOVER') || txt.includes('W.O.') || txt.includes('NO SE PRESENT');
        })
      : null);

  const isWO = Boolean(woCheckbox?.checked);
  const woAbsent = getModalWoAbsentSide(modal, match);
  const isDelayed = Boolean(document.getElementById('modalIsDelayed')?.checked);
  const delayedNote = (document.getElementById('modalDelayedNote')?.value || '').trim();

  const courtEl = document.getElementById('modalCourt');
  const timeEl = document.getElementById('modalTime');
  const dateEl = document.getElementById('modalDate');

  if (courtEl && courtEl.value) match.court = courtEl.value;
  if (timeEl && timeEl.value) match.time = timeEl.value;
  if (dateEl) match.customDate = dateEl.value || '';

  const pA1El = document.getElementById('modalPlayerA1');
  const pA2El = document.getElementById('modalPlayerA2');
  const pB1El = document.getElementById('modalPlayerB1');
  const pB2El = document.getElementById('modalPlayerB2');

  if (pA1El || pA2El) match.playersA = [pA1El?.value || null, pA2El?.value || null];
  if (pB1El || pB2El) match.playersB = [pB1El?.value || null, pB2El?.value || null];

  if (isWO) {
    match.played = true;
    match.delayed = false;
    match.delayedNote = '';
    match.woAbsent = woAbsent;
    match.sets = (normalizeWoSets(woAbsent) || [[6, 0], [6, 0]]).map(s => [s[0], s[1]]);
  } else {
    match.woAbsent = null;
    const sets = collectModalSetInputs(modal);

    if (sets.length > 0) {
      const valid = validateMatchSets(sets);
      if (!valid.ok) {
        showToast(valid.msg, 'error');
        return;
      }
      match.sets = sets;
      match.played = true;
      match.delayed = false;
      match.delayedNote = '';
    } else {
      match.sets = [];
      match.played = false;
      match.delayed = isDelayed;
      match.delayedNote = isDelayed ? (delayedNote || 'Partido retrasado / reprogramado') : '';
    }
  }

  if (typeof saveState === 'function') saveState();
  closeMatchModal();
  if (typeof render === 'function') render();
  transformDomStandingsTables(cat);
  fixUndefinedSeasonLabels(state?.seasonNumber || 1);
  injectResetAllButton();
  showToast('Resultado guardado y tabla/ranking actualizados.', 'success');
}

function clearMatchResultFromModal(matchId = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede borrar marcadores.', 'info');
    return;
  }

  const modal = document.getElementById('matchModal');
  const resolvedId = matchId || document.getElementById('modalMatchId')?.value || modal?.dataset?.activeMatchId;
  const { cat, match } = findMatchAndCategory(resolvedId);
  if (!cat || !match) return;

  match.sets = [];
  match.played = false;
  match.woAbsent = null;

  if (typeof saveState === 'function') saveState();
  closeMatchModal();
  if (typeof render === 'function') render();
  transformDomStandingsTables(cat);
  fixUndefinedSeasonLabels(state?.seasonNumber || 1);
  injectResetAllButton();
  showToast('Marcador borrado y tabla/ranking actualizados.', 'info');
}

if (typeof registerIndividualPlayer !== 'function') {
  function registerIndividualPlayer(event) {
    if (event) event.preventDefault();
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede inscribir jugadores.', 'info');
      return;
    }
    if (typeof state !== 'object' || !state) return;
    if (!Array.isArray(state.players)) state.players = [];

    const nameInput = document.getElementById('regPlayerName');
    const sideInput = document.getElementById('regPlayerSide');
    const handInput = document.getElementById('regPlayerHand');
    const phoneInput = document.getElementById('regPlayerPhone');

    const name = (nameInput?.value || '').trim();
    if (!name) {
      showToast('Ingresa el nombre y apellido del jugador.', 'error');
      return;
    }

    const newPlayer = {
      id: typeof uid === 'function' ? uid('ply') : `ply_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      side: sideInput?.value || 'Drive',
      hand: handInput?.value || 'Diestro',
      phone: (phoneInput?.value || '').trim(),
      racket: '',
      social: '',
      bio: '',
      points: 0,
      rankingPoints: 0,
      seasonHistory: [],
      avatar: null,
      photos: []
    };

    state.players.push(newPlayer);
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (sideInput) sideInput.selectedIndex = 0;
    if (handInput) handInput.selectedIndex = 0;

    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
    showToast(`Jugador "${name}" inscrito correctamente.`, 'success');
  }
}

if (typeof createTeamFromPool !== 'function') {
  function createTeamFromPool(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede crear parejas.', 'info');
      return;
    }
    if (typeof state !== 'object' || !state) return;
    ensureDefaultCategories();

    const cat =
      (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
      (state.categories || []).find(c => c.id === state.activeCategoryId) ||
      (state.categories || [])[0];

    if (!cat) {
      showToast('No hay una categoría activa seleccionada.', 'error');
      return;
    }

    if (!Array.isArray(cat.teams)) cat.teams = [];
    if (!Array.isArray(state.players)) state.players = [];

    const triggerEl = event?.target || document.activeElement || null;
    const formEl = triggerEl?.closest ? triggerEl.closest('form') : null;
    const containerEl =
      formEl ||
      triggerEl?.closest?.('[data-pool-team-builder], .pool-team-builder, section, div') ||
      document;

    const selects = Array.from(containerEl.querySelectorAll('select'));

    const p1Select =
      document.getElementById('poolPlayer1') ||
      document.getElementById('teamPlayer1') ||
      document.getElementById('newTeamP1') ||
      selects[0] ||
      null;

    const p2Select =
      document.getElementById('poolPlayer2') ||
      document.getElementById('teamPlayer2') ||
      document.getElementById('newTeamP2') ||
      selects[1] ||
      null;

    const customNameInput =
      document.getElementById('customPairLabel') ||
      document.getElementById('poolTeamName') ||
      document.getElementById('newTeamName') ||
      document.getElementById('teamCustomName') ||
      containerEl.querySelector('input[type="text"]') ||
      null;

    const player1Id = p1Select?.value || null;
    const player2Id = p2Select?.value || null;

    if (!player1Id || !player2Id) {
      showToast('Selecciona ambos jugadores (Jugador 1 y Jugador 2).', 'error');
      return;
    }
    if (player1Id === player2Id) {
      showToast('Debes elegir dos jugadores distintos para armar la pareja.', 'error');
      return;
    }

    const p1 = state.players.find(p => p.id === player1Id);
    const p2 = state.players.find(p => p.id === player2Id);

    const typedName = (customNameInput?.value || '').trim();
    const last1 = p1?.name?.trim().split(/\s+/).slice(-1)[0] || 'Jugador 1';
    const last2 = p2?.name?.trim().split(/\s+/).slice(-1)[0] || 'Jugador 2';
    const teamName = typedName || `${last1} / ${last2}`;

    const newTeam = {
      id: typeof uid === 'function' ? uid('tm') : `tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: teamName,
      player1Id,
      player2Id,
      createdAt: new Date().toISOString()
    };

    cat.teams.push(newTeam);
    if (cat.leagueMode === 'two_groups') assignBalancedZonesToTeams(cat.teams);

    if (p1Select) p1Select.value = '';
    if (p2Select) p2Select.value = '';
    if (customNameInput) customNameInput.value = '';

    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
    showToast(`Pareja "${teamName}" creada en ${cat.name}.`, 'success');
  }
}

if (typeof createPairFromPool !== 'function') {
  function createPairFromPool(event) { return createTeamFromPool(event); }
}
if (typeof addTeamFromPool !== 'function') {
  function addTeamFromPool(event) { return createTeamFromPool(event); }
}
if (typeof handleCreateTeam !== 'function') {
  function handleCreateTeam(event) { return createTeamFromPool(event); }
}

function confirmFixtureAction(title, message, onAccepted) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede ejecutar esta acción.', 'info');
    return;
  }
  if (typeof requestConfirmAction === 'function') {
    requestConfirmAction(title, message, onAccepted);
  } else if (window.confirm(`${title}\n\n${message.replace(/<[^>]+>/g, '')}`)) {
    onAccepted();
  }
}

document.addEventListener(
  'click',
  function (e) {
    if (!window.__isLeagueAdmin) return;
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    const btn = target.closest('button, a, [role="button"]');
    if (!btn) return;

    const label = (btn.innerText || btn.textContent || '').trim().toLowerCase();

    if (label.includes('aplicar formato recomendado')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const cat =
        (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
        (Array.isArray(state?.categories) ? state.categories[0] : null);

      const pairCount = (cat?.teams || []).length;
      const recommendedLeague = pairCount >= 8 ? 'two_groups' : 'single';
      const recommendedPlayoff = pairCount >= 12 ? 'top8' : pairCount >= 7 ? 'top7' : 'top6';
      const catName = cat?.name || 'la categoría activa';

      confirmFixtureAction(
        '✨ Aplicar Formato Recomendado y Generar',
        `¿Seguro que deseas aplicar el formato recomendado (<strong>${recommendedLeague === 'two_groups' ? '2 Grupos' : 'Liga Única'}</strong> + <strong>${recommendedPlayoff.toUpperCase()}</strong>) y regenerar el fixture de <strong>${catName}</strong>? Esto puede sobrescribir partidos o llaves actuales.`,
        () => {
          handleRegenerateFixture({
            leagueMode: recommendedLeague,
            playoffMode: recommendedPlayoff,
            forceRebuild: true,
            skipConfirm: true
          });
        }
      );
      return;
    }

    if ((label.includes('generar') || label.includes('actualizar')) && label.includes('fixture')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const cat =
        (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
        (Array.isArray(state?.categories) ? state.categories[0] : null);
      const catName = cat?.name || 'la categoría activa';

      confirmFixtureAction(
        '🔄 Generar / Actualizar Fixture Actual',
        `¿Seguro que deseas generar o actualizar el fixture de <strong>${catName}</strong> con los ajustes actuales?`,
        () => {
          handleRegenerateFixture({ forceRebuild: true, skipConfirm: true });
        }
      );
      return;
    }

    if (label.includes('cargar clasificados')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      try {
        syncPlayoffsFromStandings();
      } catch (err) {
        console.error('[Playoffs] Error al cargar clasificados:', err);
        if (typeof showToast === 'function') {
          showToast(`Error al cargar clasificados: ${err.message}`, 'error');
        }
      }
    }
  },
  true
);

document.addEventListener('input', function (e) {
  if (!window.__isLeagueAdmin) return;
  if (e.target?.closest?.('#matchModal')) {
    updatePointsPreview();
  }
});

document.addEventListener('change', function (e) {
  if (!window.__isLeagueAdmin) return;
  if (e.target?.closest?.('#matchModal')) {
    updatePointsPreview();
    return;
  }

  const target = e.target;
  if (!target || !('value' in target)) return;
  const id = (target.id || '').toLowerCase();
  const name = (target.name || '').toLowerCase();
  const val = String(target.value ?? '').toLowerCase();

  if (
    id.includes('leaguemode') ||
    name.includes('leaguemode') ||
    id.includes('playoffmode') ||
    name.includes('playoffmode') ||
    id.includes('promote') ||
    name.includes('promote') ||
    id.includes('relegate') ||
    name.includes('relegate') ||
    id.includes('ascenso') ||
    id.includes('descenso') ||
    ['single', 'two_groups', 'ida_vuelta', 'top6', 'top7', 'top8'].includes(val)
  ) {
    if (!target.hasAttribute('onchange')) {
      updateCatFormat(target);
    }
  }
});

document.addEventListener('click', function (e) {
  if (!window.__isLeagueAdmin) return;
  const btn = e.target?.closest ? e.target.closest('button, a, [role="button"]') : null;
  if (!btn) return;
  const txt = (btn.textContent || '').trim().toLowerCase();
  const hasInlineOnclick = btn.hasAttribute('onclick');

  if (!hasInlineOnclick && (txt.includes('cerrar temporada') || txt.includes('iniciar temporada'))) {
    e.preventDefault();
    handleSeasonRollover();
    return;
  }
  if (!hasInlineOnclick && (txt.includes('reiniciar todo') || txt.includes('vaciar todo') || txt.includes('desde cero'))) {
    e.preventDefault();
    handleResetAllEmpty();
    return;
  }
  if (!hasInlineOnclick && (txt.includes('generar') || txt.includes('actualizar')) && txt.includes('fixture')) {
    e.preventDefault();
    handleRegenerateFixture({ forceRebuild: true });
    return;
  }
  if (!hasInlineOnclick && txt.includes('exportar') && txt.includes('json')) {
    e.preventDefault();
    exportJSON();
    return;
  }
  if (!hasInlineOnclick && (txt.includes('reiniciar demo') || txt.includes('reset demo'))) {
    e.preventDefault();
    handleResetDemo();
    return;
  }
  if (txt.includes('crear pareja')) {
    const inForm = Boolean(btn.closest('form'));
    if (!hasInlineOnclick && !inForm) createTeamFromPool(e);
    return;
  }

  const modal = btn.closest('#matchModal');
  if (modal) {
    if (txt.includes('guardar cambios') || txt.includes('guardar marcador') || txt === 'guardar' || txt.includes('guardar resultado')) {
      e.preventDefault();
      saveMatchFromModal();
      return;
    }
    if (txt.includes('borrar marcador')) {
      e.preventDefault();
      clearMatchResultFromModal();
      return;
    }
  }
});

document.addEventListener('submit', function (e) {
  const form = e.target;
  if (!form) return;

  if (!window.__isLeagueAdmin) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (typeof showToast === 'function') {
      showToast('Modo solo lectura: solo el administrador puede guardar cambios.', 'info');
    }
    return;
  }

  if (form.id === 'matchForm' || form.closest('#matchModal')) {
    e.preventDefault();
    saveMatchFromModal();
    return;
  }
  if (form.id === 'playoffForm' || form.id === 'editPlayerForm') return;
  const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
  const txt = (submitBtn?.textContent || '').trim().toLowerCase();
  if (txt.includes('crear pareja') || form.id?.toLowerCase().includes('team')) {
    createTeamFromPool(e);
  }
});

function buildRoundRobinMatchesForGroup(teams, groupName, startRound = 1, legSuffix = '', swapHomeAway = false) {
  const list = (teams || []).slice();
  if (list.length < 2) return { matches: [], nextRound: startRound };

  const hasBye = list.length % 2 !== 0;
  if (hasBye) {
    list.push({ id: '__BYE__', name: 'BYE' });
  }

  const n = list.length;
  const roundsCount = n - 1;
  const matchesPerRound = n / 2;
  const courts = ['Cancha 1', 'Cancha 2', 'Cancha 3', 'Cancha 4'];
  const times = ['19:30', '21:00'];

  const rotating = list.slice(1);
  const fixed = list[0];
  const matches = [];
  let matchIdx = 0;

  for (let r = 0; r < roundsCount; r++) {
    const roundNum = startRound + r;
    const roundArr = [fixed, ...rotating];

    for (let i = 0; i < matchesPerRound; i++) {
      const a = roundArr[i];
      const b = roundArr[n - 1 - i];
      if (!a || !b || a.id === '__BYE__' || b.id === '__BYE__') continue;

      const swapSides = ((r + i) % 2 === 1) ? !swapHomeAway : swapHomeAway;
      const teamA = swapSides ? b : a;
      const teamB = swapSides ? a : b;

      matches.push({
        id: typeof uid === 'function' ? uid('mch') : `mch_${roundNum}_${matchIdx}_${Math.random().toString(36).slice(2, 6)}`,
        round: roundNum,
        dateLabel: `Fecha ${roundNum}${legSuffix ? ` (${legSuffix})` : ''}`,
        group: groupName || null,
        zone: groupName || null,
        teamAId: teamA.id,
        teamBId: teamB.id,
        playersA: [teamA.player1Id || null, teamA.player2Id || null],
        playersB: [teamB.player1Id || null, teamB.player2Id || null],
        court: courts[matchIdx % courts.length],
        time: times[Math.floor(matchIdx / courts.length) % times.length],
        customDate: '',
        sets: [],
        played: false,
        delayed: false,
        delayedNote: '',
        woAbsent: null
      });
      matchIdx++;
    }

    rotating.unshift(rotating.pop());
  }

  return { matches, nextRound: startRound + roundsCount };
}

function generateFixtureForCategory(cat, opts = {}) {
  if (!cat) return;
  applyFormatValuesToCategory(cat, opts);

  const teams = Array.isArray(cat.teams) ? cat.teams : [];
  const forceRebuild = opts?.forceRebuild !== undefined ? Boolean(opts.forceRebuild) : true;

  let generated = [];
  if (cat.leagueMode === 'two_groups') {
    assignBalancedZonesToTeams(teams);
    const grpA = teams.filter(t => getTeamZoneKey(cat, t) === 'A');
    const grpB = teams.filter(t => getTeamZoneKey(cat, t) === 'B');
    const resA = buildRoundRobinMatchesForGroup(grpA, 'Zona A', 1);
    const resB = buildRoundRobinMatchesForGroup(grpB, 'Zona B', 1);
    generated = sortMatchesByZoneAndRound(cat, [...resA.matches, ...resB.matches]);
  } else if (cat.leagueMode === 'ida_vuelta') {
    clearTeamZones(teams);
    const leg1 = buildRoundRobinMatchesForGroup(teams, null, 1, 'Ida', false);
    const leg2 = buildRoundRobinMatchesForGroup(teams, null, leg1.nextRound, 'Vuelta', true);
    generated = [...leg1.matches, ...leg2.matches];
  } else {
    clearTeamZones(teams);
    const res = buildRoundRobinMatchesForGroup(teams, null, 1);
    generated = res.matches;
  }

  if (forceRebuild) {
    cat.matches = generated;
    cat.playoffs = null;
    return;
  }

  const validTeamIds = new Set(teams.map(t => t.id));
  const keptPlayed = (cat.matches || []).filter(
    m => matchHasRecordedResult(m) &&
      validTeamIds.has(m.teamAId) &&
      validTeamIds.has(m.teamBId)
  );

  const merged = [...keptPlayed];
  generated.forEach(gm => {
    const existsSame = keptPlayed.some(
      pm =>
        pm.round === gm.round &&
        ((pm.teamAId === gm.teamAId && pm.teamBId === gm.teamBId) ||
          (pm.teamAId === gm.teamBId && pm.teamBId === gm.teamAId))
    );
    if (!existsSame) {
      merged.push(gm);
    }
  });

  cat.matches = sortMatchesByZoneAndRound(cat, merged);
}

function executeRegenerateFixtureNow(cat, opts) {
  applyFormatValuesToCategory(cat, opts);

  if (!Array.isArray(cat.teams) || cat.teams.length < 2) {
    showToast(`Necesitas al menos 2 parejas en ${cat.name} para generar el fixture.`, 'warning');
    return;
  }

  generateFixtureForCategory(cat, { forceRebuild: opts.forceRebuild !== false });
  syncPlayoffsFromStandings(cat);

  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  fixUndefinedSeasonLabels(state?.seasonNumber || 1);
  syncFormatControlsFromCategory(cat);
  injectResetAllButton();
  hidePlayoffManualAdvanceButtons();

  const formatoTxt = cat.leagueMode === 'two_groups'
    ? '2 Grupos (Zona A / Zona B)'
    : cat.leagueMode === 'ida_vuelta'
      ? 'Liga Ida y Vuelta'
      : 'Liga Grupo Único';

  showToast(
    `Fixture generado en ${cat.name}: ${formatoTxt} · ${cat.playoffMode.toUpperCase()} (${cat.matches.length} partidos).`,
    'success'
  );
}

function handleRegenerateFixture(btnOrOpts = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede generar fixture.', 'info');
    return;
  }
  if (typeof state !== 'object' || !state) return;
  ensureDefaultCategories();

  const cats = Array.isArray(state.categories) ? state.categories : [];
  const cat =
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    cats.find(c => c.id === state.activeCategoryId) ||
    cats[0];

  if (!cat) {
    showToast('No hay categoría activa para generar fixture.', 'error');
    return;
  }

  const opts = btnOrOpts && typeof btnOrOpts === 'object' && !('tagName' in btnOrOpts)
    ? btnOrOpts
    : { forceRebuild: true };

  if (opts.skipConfirm) {
    executeRegenerateFixtureNow(cat, opts);
    return;
  }

  confirmFixtureAction(
    '🔄 Generar / Actualizar Fixture Actual',
    `¿Seguro que deseas generar o actualizar el fixture de <strong>${cat.name}</strong>?`,
    () => executeRegenerateFixtureNow(cat, { ...opts, skipConfirm: true })
  );
}

window.handleRegenerateFixture = handleRegenerateFixture;

if (typeof setPlayerSort !== 'function') {
  function setPlayerSort(mode) {
    if (typeof state !== 'object' || !state) return;
    state.playerSortBy = mode;
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
  }
}

if (typeof filterPlayers !== 'function') {
  function filterPlayers(query) {
    if (typeof state !== 'object' || !state) return;
    state.playerSearch = query || '';
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
  }
}

function ensureFallbackModal(id, title, bodyHtml) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 class="text-base font-extrabold text-slate-900">${title}</h3>
        <button type="button" onclick="document.getElementById('${id}').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">&times;</button>
      </div>
      <div class="text-xs text-slate-600 space-y-2">${bodyHtml}</div>
      <div class="flex justify-end pt-2">
        <button type="button" onclick="document.getElementById('${id}').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Cerrar</button>
      </div>
    </div>
  `;
}

if (typeof closeMatchModal !== 'function') {
  function closeMatchModal() {
    const m = document.getElementById('matchModal') || document.getElementById('fallbackMatchModal');
    if (m) m.classList.add('hidden');
  }
}

if (typeof closePlayoffModal !== 'function') {
  function closePlayoffModal() {
    const m = document.getElementById('playoffModal') || document.getElementById('fallbackPlayoffModal') || document.getElementById('playoffEditorModal');
    if (m) m.classList.add('hidden');
  }
}

function requestConfirmAction(title, message, onConfirm) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: acción no permitida para visitantes.', 'info');
    return;
  }

  let modal = document.getElementById('confirmActionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmActionModal';
    modal.className = 'fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 hidden';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
      <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 class="text-base font-extrabold text-slate-900">${title}</h3>
        <button type="button" id="cancelConfirmBtnX" class="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">&times;</button>
      </div>
      <p class="text-xs text-slate-600 leading-relaxed">${message}</p>
      <div class="flex items-center justify-end gap-2 pt-2">
        <button type="button" id="cancelConfirmBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition">
          Cancelar
        </button>
        <button type="button" id="acceptConfirmBtn" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition">
          Confirmar
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  const closeModal = () => modal.classList.add('hidden');
  modal.querySelector('#cancelConfirmBtn').onclick = closeModal;
  modal.querySelector('#cancelConfirmBtnX').onclick = closeModal;
  modal.querySelector('#acceptConfirmBtn').onclick = () => {
    closeModal();
    if (typeof onConfirm === 'function') onConfirm();
  };
}

function readFilesAsDataUrls(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(
    files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: typeof uid === 'function' ? uid('ph') : `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        dataUrl: reader.result
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))
  );
}

function renderPlayerGalleryHtml(player) {
  const photos = Array.isArray(player.photos) ? player.photos : [];
  if (!photos.length) {
    return `<div class="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">Este jugador aún no tiene fotos guardadas.</div>`;
  }

  const isAdmin = Boolean(window.__isLeagueAdmin);

  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
      ${photos.map(ph => {
        const isAvatar = player.avatar === ph.dataUrl;
        return `
          <div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex flex-col">
            <div class="aspect-square bg-slate-200 overflow-hidden">
              <img src="${ph.dataUrl}" alt="${ph.name || 'Foto jugador'}" class="w-full h-full object-cover">
            </div>
            ${isAdmin ? `
              <div class="p-2 bg-white flex items-center justify-between gap-1">
                <button type="button" onclick="setPlayerAvatar('${player.id}', '${ph.id}')" class="text-[10px] font-bold px-2 py-1 rounded ${isAvatar ? 'bg-amber-300 text-slate-950' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} transition">
                  ${isAvatar ? '★ Perfil' : 'Hacer Perfil'}
                </button>
                <button type="button" onclick="deletePlayerPhoto('${player.id}', '${ph.id}')" class="text-[10px] font-bold px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
                  🗑️
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}


function refreshPlayerEditorModal(playerId) {
  const modal = document.getElementById('playerEditorModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const player = (state?.players || []).find(p => p.id === playerId);
  if (!player) return;

  const galleryBox = document.getElementById('editPlayerGalleryBox');
  if (galleryBox) galleryBox.innerHTML = renderPlayerGalleryHtml(player);
  const avatarPreview = document.getElementById('editPlayerAvatarPreview');
  if (avatarPreview) {
    avatarPreview.innerHTML = player.avatar
      ? `<img src="${player.avatar}" alt="Avatar" class="w-full h-full object-cover">`
      : `<span class="text-sm font-extrabold text-tennis-400">${player.name.trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span>`;
  }
}

function openEditPlayerModal(playerId, focusPhotos = false) {
  const player = (state?.players || []).find(p => p.id === playerId);
  if (!player) return;
  if (!Array.isArray(player.photos)) player.photos = [];

  const isAdmin = Boolean(window.__isLeagueAdmin);

  let modal = document.getElementById('playerEditorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'playerEditorModal';
    modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto hidden';
    document.body.appendChild(modal);
  }

  const initials = player.name.trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const disabledAttr = isAdmin ? '' : 'disabled';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="flex items-center gap-3">
          <div id="editPlayerAvatarPreview" class="w-12 h-12 rounded-full bg-court-900 flex items-center justify-center overflow-hidden border border-slate-300 shrink-0">
            ${player.avatar
              ? `<img src="${player.avatar}" alt="Avatar" class="w-full h-full object-cover">`
              : `<span class="text-sm font-extrabold text-tennis-400">${initials}</span>`
            }
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900">${isAdmin ? 'Editar Perfil de Jugador' : 'Perfil de Jugador'}</h3>
              ${!isAdmin ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Solo lectura</span>` : ''}
            </div>
            <p class="text-xs text-slate-500">${isAdmin ? 'Modifica los datos de inscripción y gestiona foto de perfil o galería.' : 'Consulta los datos del jugador y las fotos subidas.'}</p>
          </div>
        </div>
        <button type="button" onclick="document.getElementById('playerEditorModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 font-bold text-xl leading-none">&times;</button>
      </div>

      <form id="editPlayerForm" class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-600 mb-1">Nombre y Apellido *</label>
            <input type="text" id="editPlayerName" required ${disabledAttr} value="${(player.name || '').replace(/"/g, '&quot;')}" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold disabled:bg-slate-50 disabled:text-slate-700">
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Teléfono / WhatsApp</label>
            <input type="text" id="editPlayerPhone" ${disabledAttr} value="${(player.phone || '').replace(/"/g, '&quot;')}" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold disabled:bg-slate-50 disabled:text-slate-700">
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Posición</label>
            <select id="editPlayerSide" ${disabledAttr} class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white disabled:bg-slate-50 disabled:text-slate-700">
              <option value="Drive" ${player.side === 'Drive' ? 'selected' : ''}>Drive (Derecha)</option>
              <option value="Revés" ${player.side === 'Revés' ? 'selected' : ''}>Revés (Izquierda)</option>
              <option value="Ambos lados" ${player.side === 'Ambos lados' ? 'selected' : ''}>Ambos lados</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Mano Hábil</label>
            <select id="editPlayerHand" ${disabledAttr} class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white disabled:bg-slate-50 disabled:text-slate-700">
              <option value="Diestro" ${player.hand === 'Diestro' ? 'selected' : ''}>Diestro</option>
              <option value="Zurdo" ${player.hand === 'Zurdo' ? 'selected' : ''}>Zurdo</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Paleta</label>
            <input type="text" id="editPlayerRacket" ${disabledAttr} value="${(player.racket || '').replace(/"/g, '&quot;')}" placeholder="Ej: Bullpadel Vertex 04" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold disabled:bg-slate-50 disabled:text-slate-700">
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Red Social / Alias</label>
            <input type="text" id="editPlayerSocial" ${disabledAttr} value="${(player.social || '').replace(/"/g, '&quot;')}" placeholder="@usuario" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold disabled:bg-slate-50 disabled:text-slate-700">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-600 mb-1">Nota / Bio del Jugador</label>
          <textarea id="editPlayerBio" rows="2" ${disabledAttr} class="w-full border border-slate-300 rounded-xl px-3 py-2 font-medium disabled:bg-slate-50 disabled:text-slate-700" placeholder="Estilo de juego, disponibilidad...">${player.bio || ''}</textarea>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-extrabold text-slate-800">📸 Foto de Perfil y Galería de Fotos</div>
              <div class="text-[11px] text-slate-500">${isAdmin ? 'Puedes subir una foto directa de perfil o seleccionar varias imágenes a la vez.' : 'Galería de fotos cargadas del jugador.'}</div>
            </div>
            ${isAdmin ? `
              <div class="flex flex-wrap items-center gap-2">
                <label class="px-3 py-1.5 rounded-lg bg-court-900 hover:bg-court-800 text-white font-bold cursor-pointer transition">
                  🖼️ Foto Perfil
                  <input type="file" id="editAvatarFileInput" accept="image/*" class="hidden">
                </label>
                <label class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer transition">
                  ➕ Subir Varias Fotos
                  <input type="file" id="editGalleryFilesInput" accept="image/*" multiple class="hidden">
                </label>
              </div>
            ` : ''}
          </div>

          <div id="editPlayerGalleryBox">
            ${renderPlayerGalleryHtml(player)}
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div>
            ${isAdmin ? `
              <button type="button" onclick="handleDeletePlayer(this, '${player.id}')" class="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold transition">
                🗑️ Borrar Perfil
              </button>
            ` : ''}
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="document.getElementById('playerEditorModal').classList.add('hidden')" class="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold">
              ${isAdmin ? 'Cancelar' : 'Cerrar'}
            </button>
            ${isAdmin ? `
              <button type="submit" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow transition">
                💾 Guardar Cambios
              </button>
            ` : ''}
          </div>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');

  const avatarInput = modal.querySelector('#editAvatarFileInput');
  if (avatarInput) {
    avatarInput.onchange = async (e) => {
      if (!window.__isLeagueAdmin) return;
      const uploaded = await readFilesAsDataUrls(e.target.files);
      if (!uploaded.length) return;
      player.avatar = uploaded[0].dataUrl;
      player.photos.unshift(uploaded[0]);
      if (typeof saveState === 'function') saveState();
      refreshPlayerEditorModal(player.id);
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast('Foto de perfil actualizada.', 'success');
    };
  }

  const galleryInput = modal.querySelector('#editGalleryFilesInput');
  if (galleryInput) {
    galleryInput.onchange = async (e) => {
      if (!window.__isLeagueAdmin) return;
      const uploaded = await readFilesAsDataUrls(e.target.files);
      if (!uploaded.length) return;
      player.photos.push(...uploaded);
      if (!player.avatar && uploaded[0]) player.avatar = uploaded[0].dataUrl;
      if (typeof saveState === 'function') saveState();
      refreshPlayerEditorModal(player.id);
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast(`${uploaded.length} foto(s) agregada(s) a la galería.`, 'success');
    };
  }

  modal.querySelector('#editPlayerForm').onsubmit = (e) => {
    e.preventDefault();
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede guardar cambios.', 'info');
      return;
    }
    const newName = (document.getElementById('editPlayerName')?.value || '').trim();
    if (!newName) {
      showToast('El nombre del jugador es obligatorio.', 'error');
      return;
    }
    player.name = newName;
    player.phone = (document.getElementById('editPlayerPhone')?.value || '').trim();
    player.side = document.getElementById('editPlayerSide')?.value || 'Drive';
    player.hand = document.getElementById('editPlayerHand')?.value || 'Diestro';
    player.racket = (document.getElementById('editPlayerRacket')?.value || '').trim();
    player.social = (document.getElementById('editPlayerSocial')?.value || '').trim();
    player.bio = (document.getElementById('editPlayerBio')?.value || '').trim();

    if (typeof saveState === 'function') saveState();
    modal.classList.add('hidden');
    if (typeof render === 'function') render();
    injectResetAllButton();
    showToast('Datos del jugador actualizados.', 'success');
  };

  if (focusPhotos) {
    modal.querySelector('#editPlayerGalleryBox')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

window.openEditPlayerModal = openEditPlayerModal;


function openPlayerProfile(playerId) {
  openEditPlayerModal(playerId, true);
}

window.openPlayerProfile = openPlayerProfile;

function setPlayerAvatar(playerId, photoId) {
  if (!window.__isLeagueAdmin) return;
  const player = (state?.players || []).find(p => p.id === playerId);
  if (!player) return;
  const photo = (player.photos || []).find(ph => ph.id === photoId);
  if (!photo) return;
  player.avatar = photo.dataUrl;
  if (typeof saveState === 'function') saveState();
  refreshPlayerEditorModal(player.id);
  if (typeof render === 'function') render();
  injectResetAllButton();
  showToast('Foto establecida como imagen de perfil.', 'success');
}

function deletePlayerPhoto(playerId, photoId) {
  if (!window.__isLeagueAdmin) return;
  const player = (state?.players || []).find(p => p.id === playerId);
  if (!player) return;
  const photo = (player.photos || []).find(ph => ph.id === photoId);
  if (!photo) return;

  requestConfirmAction(
    '🗑️ Borrar fotografía',
    `¿Seguro que deseas borrar esta fotografía de <strong>${player.name}</strong>? Esta acción no se puede deshacer.`,
    () => {
      player.photos = (player.photos || []).filter(ph => ph.id !== photoId);
      if (player.avatar === photo.dataUrl) player.avatar = player.photos[0]?.dataUrl || null;
      if (typeof saveState === 'function') saveState();
      refreshPlayerEditorModal(player.id);
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast('Fotografía eliminada.', 'info');
    }
  );
}

function handleDeletePlayer(_btn, playerId) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede borrar jugadores.', 'info');
    return;
  }
  const player = (state?.players || []).find(p => p.id === playerId);
  if (!player) return;

  requestConfirmAction(
    '🗑️ Borrar perfil de jugador',
    `¿Estás seguro de que quieres borrar el perfil de <strong>${player.name}</strong>? Se quitará del pool y de las parejas asignadas.`,
    () => {
      state.players = (state.players || []).filter(p => p.id !== playerId);
      (state.categories || []).forEach(cat => {
        (cat.teams || []).forEach(team => {
          if (team.player1Id === playerId) team.player1Id = null;
          if (team.player2Id === playerId) team.player2Id = null;
        });
      });

      const editorModal = document.getElementById('playerEditorModal');
      if (editorModal) editorModal.classList.add('hidden');

      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast(`Perfil de ${player.name} eliminado.`, 'info');
    }
  );
}

if (typeof openSwapPlayerModal !== 'function') {
  function openSwapPlayerModal(teamId) {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede reemplazar jugadores.', 'info');
      return;
    }

    const cats = state?.categories || [];
    let targetCat = typeof getActiveCategory === 'function' ? getActiveCategory() : null;
    let team = targetCat?.teams?.find(t => t.id === teamId) || null;

    if (!team) {
      for (const c of cats) {
        const found = (c.teams || []).find(t => t.id === teamId);
        if (found) {
          targetCat = c;
          team = found;
          break;
        }
      }
    }

    if (!team || !targetCat) {
      ensureFallbackModal(
        'fallbackSwapModal',
        '🔄 Reemplazar Jugador en Pareja',
        `<p>No se encontró la pareja con ID: <code>${teamId}</code>.</p>`
      );
      return;
    }

    let modal = document.getElementById('swapPlayerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'swapPlayerModal';
      modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 hidden';
      document.body.appendChild(modal);
    }

    const players = state?.players || [];
    const rankMap = typeof computeIndividualRankings === 'function' ? computeIndividualRankings().byId : {};

    const p1 = players.find(p => p.id === team.player1Id);
    const p2 = players.find(p => p.id === team.player2Id);

    const p1Label = p1 ? `${p1.name} (${rankMap[p1.id]?.points ?? 0} pts)` : 'Jugador 1 (Vacante)';
    const p2Label = p2 ? `${p2.name} (${rankMap[p2.id]?.points ?? 0} pts)` : 'Jugador 2 (Vacante)';

    const playerOptions = players
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => {
        const pts = rankMap[p.id]?.points ?? 0;
        const assign = typeof getPlayerAssignmentInfo === 'function' ? getPlayerAssignmentInfo(p.id) : null;
        const suffix = assign ? ` · En ${assign.categoryName}` : ' · Disponible';
        return `<option value="${p.id}">${p.name} (${pts} pts${suffix})</option>`;
      })
      .join('');

    modal.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-extrabold text-slate-900">🔄 Reemplazar Jugador en Pareja</h3>
            <p class="text-xs text-slate-500">${targetCat.name} · <strong>${team.name}</strong></p>
          </div>
          <button type="button" id="closeSwapModalX" class="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">&times;</button>
        </div>

        <form id="swapPlayerForm" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-bold text-slate-600 mb-1">¿A quién deseas reemplazar?</label>
            <select id="swapSlotSelect" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
              <option value="player1Id">Posición 1: ${p1Label}</option>
              <option value="player2Id">Posición 2: ${p2Label}</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-600 mb-1">Nuevo jugador del pool</label>
            <select id="swapNewPlayerSelect" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
              <option value="">— Dejar vacante —</option>
              ${playerOptions}
            </select>
          </div>

          <label class="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input type="checkbox" id="swapAutoRenameTeam" checked class="rounded border-slate-300">
            <span class="text-slate-700 font-semibold">Actualizar nombre de pareja automáticamente (Apellido / Apellido)</span>
          </label>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" id="cancelSwapModalBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold">
              Cancelar
            </button>
            <button type="submit" class="px-4 py-2 rounded-xl bg-court-900 hover:bg-court-800 text-white font-bold shadow transition">
              Confirmar Reemplazo
            </button>
          </div>
        </form>
      </div>
    `;

    modal.classList.remove('hidden');

    const hideModal = () => modal.classList.add('hidden');
    modal.querySelector('#closeSwapModalX').onclick = hideModal;
    modal.querySelector('#cancelSwapModalBtn').onclick = hideModal;

    modal.querySelector('#swapPlayerForm').onsubmit = (e) => {
      e.preventDefault();
      if (!window.__isLeagueAdmin) {
        showToast('Modo solo lectura: solo el administrador puede guardar cambios.', 'info');
        return;
      }
      const slot = document.getElementById('swapSlotSelect')?.value;
      const newPlayerId = document.getElementById('swapNewPlayerSelect')?.value || null;
      const autoRename = Boolean(document.getElementById('swapAutoRenameTeam')?.checked);

      if (!slot) return;
      team[slot] = newPlayerId;

      if (autoRename) {
        const np1 = players.find(p => p.id === team.player1Id);
        const np2 = players.find(p => p.id === team.player2Id);
        const last1 = np1?.name?.trim().split(/\s+/).slice(-1)[0] || 'Jugador 1';
        const last2 = np2?.name?.trim().split(/\s+/).slice(-1)[0] || 'Jugador 2';
        team.name = `${last1} / ${last2}`;
      }

      if (typeof saveState === 'function') saveState();
      hideModal();
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast('Jugador reemplazado en la pareja.', 'success');
    };
  }
}

function resolveTeamAndCategory(teamId, categoryId = null) {
  const cats = state?.categories || [];
  if (categoryId) {
    const specificCat = cats.find(c => c.id === categoryId);
    const foundTeam = (specificCat?.teams || []).find(t => t.id === teamId);
    if (foundTeam && specificCat) return { targetCat: specificCat, team: foundTeam };
  }

  const activeCat = typeof getActiveCategory === 'function' ? getActiveCategory() : null;
  const activeTeam = (activeCat?.teams || []).find(t => t.id === teamId);
  if (activeTeam && activeCat) return { targetCat: activeCat, team: activeTeam };

  for (const c of cats) {
    const found = (c.teams || []).find(t => t.id === teamId);
    if (found) return { targetCat: c, team: found };
  }

  return { targetCat: null, team: null };
}

if (typeof dissolveTeam !== 'function') {
  function dissolveTeam(teamId, categoryId = null) {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede disolver parejas.', 'info');
      return;
    }

    const { targetCat, team } = resolveTeamAndCategory(teamId, categoryId);
    if (!team || !targetCat) {
      showToast('No se encontró la pareja para disolver.', 'error');
      return;
    }

    const executeDissolve = () => {
      targetCat.teams = (targetCat.teams || []).filter(t => t.id !== team.id);
      targetCat.matches = (targetCat.matches || []).filter(m => m.teamAId !== team.id && m.teamBId !== team.id);
      if (targetCat.playoffs) {
        Object.keys(targetCat.playoffs).forEach(stageKey => {
          const node = targetCat.playoffs[stageKey];
          if (!node) return;
          if (node.teamA === team.id) node.teamA = null;
          if (node.teamB === team.id) node.teamB = null;
          if (node.winner === team.id) node.winner = null;
        });
      }
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
      injectResetAllButton();
      showToast(`Pareja "${team.name}" disuelta en ${targetCat.name}.`, 'info');
    };

    requestConfirmAction(
      '💥 Disolver pareja',
      `¿Seguro que deseas disolver la pareja <strong>${team.name}</strong> en <strong>${targetCat.name}</strong>? Se eliminarán sus partidos asociados.`,
      executeDissolve
    );
  }
}

if (typeof handleRemoveTeam !== 'function') {
  function handleRemoveTeam(_btn, teamId, categoryId = null) { return dissolveTeam(teamId, categoryId); }
}
if (typeof deleteTeam !== 'function') {
  function deleteTeam(teamId, categoryId = null) { return dissolveTeam(teamId, categoryId); }
}
if (typeof removeTeam !== 'function') {
  function removeTeam(teamId, categoryId = null) { return dissolveTeam(teamId, categoryId); }
}
if (typeof dissolvePair !== 'function') {
  function dissolvePair(teamId, categoryId = null) { return dissolveTeam(teamId, categoryId); }
}
if (typeof handleDissolveTeam !== 'function') {
  function handleDissolveTeam(teamId, categoryId = null) { return dissolveTeam(teamId, categoryId); }
}

function openPlayoffModal(stageKey, categoryId = null) {
  if (!window.__isLeagueAdmin) {
    showToast('Modo solo lectura: solo el administrador puede editar resultados de playoffs.', 'info');
    return;
  }

  const cats = Array.isArray(state?.categories) ? state.categories : [];
  const cat =
    (categoryId ? cats.find(c => c.id === categoryId) : null) ||
    (typeof getActiveCategory === 'function' ? getActiveCategory() : null) ||
    cats[0];

  if (!cat) {
    showToast('No hay categoría activa.', 'error');
    return;
  }

  const po = typeof ensurePlayoffBracket === 'function'
    ? ensurePlayoffBracket(cat)
    : (cat.playoffs = cat.playoffs || {});

  const node = po[stageKey];
  if (!node) {
    ensureFallbackModal(
      'fallbackPlayoffModal',
      `🏆 Partido de Playoffs (${stageKey})`,
      `<p>No existe configuración de llave para <strong>${stageKey}</strong> en ${cat.name}.</p>`
    );
    return;
  }

  let modal = document.getElementById('playoffEditorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'playoffEditorModal';
    modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 hidden';
    document.body.appendChild(modal);
  }

  const nameA = getTeamDisplayName(cat, node.teamA, node.labelA || 'Pareja A');
  const nameB = getTeamDisplayName(cat, node.teamB, node.labelB || 'Pareja B');
  const sets = Array.isArray(node.sets) ? node.sets : [];

  const getSetVal = (idx, side) => {
    const s = sets[idx];
    if (!s) return '';
    return side === 'A' ? (Array.isArray(s) ? s[0] : (s.a ?? '')) : (Array.isArray(s) ? s[1] : (s.b ?? ''));
  };

  modal.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 class="text-base font-extrabold text-slate-900">🏆 Resultado / Cancha (${stageKey.toUpperCase()})</h3>
          <p class="text-xs text-slate-500">${cat.name} · <strong>${nameA}</strong> vs <strong>${nameB}</strong></p>
        </div>
        <button type="button" id="closePoEditorX" class="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">&times;</button>
      </div>

      <form id="dynamicPlayoffForm" class="space-y-3.5 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-600 mb-1">Cancha</label>
            <input type="text" id="dynPoCourt" value="${(node.court || 'Cancha 1').replace(/"/g, '&quot;')}" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold">
          </div>
          <div>
            <label class="block font-bold text-slate-600 mb-1">Hora</label>
            <input type="text" id="dynPoTime" value="${(node.time || '19:30').replace(/"/g, '&quot;')}" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold">
          </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <div class="grid grid-cols-4 gap-2 font-bold text-slate-500 text-[11px] text-center">
            <div class="text-left">Pareja</div>
            <div>Set 1</div>
            <div>Set 2</div>
            <div>Set 3</div>
          </div>
          <div class="grid grid-cols-4 gap-2 items-center">
            <div class="font-bold text-slate-800 truncate">${nameA}</div>
            <input type="number" min="0" max="25" id="dynPoS1A" value="${getSetVal(0, 'A')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
            <input type="number" min="0" max="25" id="dynPoS2A" value="${getSetVal(1, 'A')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
            <input type="number" min="0" max="25" id="dynPoS3A" value="${getSetVal(2, 'A')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
          </div>
          <div class="grid grid-cols-4 gap-2 items-center">
            <div class="font-bold text-slate-800 truncate">${nameB}</div>
            <input type="number" min="0" max="25" id="dynPoS1B" value="${getSetVal(0, 'B')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
            <input type="number" min="0" max="25" id="dynPoS2B" value="${getSetVal(1, 'B')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
            <input type="number" min="0" max="25" id="dynPoS3B" value="${getSetVal(2, 'B')}" class="border border-slate-300 rounded-lg px-2 py-1.5 text-center font-bold bg-white">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-600 mb-1">Ganador (avanza automáticamente)</label>
          <select id="dynPoWinner" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white">
            <option value="">— Automático según sets —</option>
            ${node.teamA ? `<option value="${node.teamA}" ${node.winner === node.teamA ? 'selected' : ''}>${nameA}</option>` : ''}
            ${node.teamB ? `<option value="${node.teamB}" ${node.winner === node.teamB ? 'selected' : ''}>${nameB}</option>` : ''}
          </select>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button type="button" id="clearDynPoBtn" class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold">
            Limpiar
          </button>
          <div class="flex items-center gap-2">
            <button type="button" id="cancelDynPoBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold">
              Cancelar
            </button>
            <button type="submit" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow">
              Guardar y Avanzar
            </button>
          </div>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  applyReadOnlyRestrictions();

  const hide = () => modal.classList.add('hidden');
  modal.querySelector('#closePoEditorX').onclick = hide;
  modal.querySelector('#cancelDynPoBtn').onclick = hide;

  modal.querySelector('#clearDynPoBtn').onclick = () => {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede limpiar resultados.', 'info');
      return;
    }
    node.sets = [];
    node.winner = null;
    propagatePlayoffs(cat);
    if (typeof saveState === 'function') saveState();
    hide();
    if (typeof render === 'function') render();
    injectResetAllButton();
    hidePlayoffManualAdvanceButtons();
    showToast('Resultado de playoff limpiado.', 'info');
  };

  modal.querySelector('#dynamicPlayoffForm').onsubmit = (e) => {
    e.preventDefault();
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede guardar resultados.', 'info');
      return;
    }

    node.court = (document.getElementById('dynPoCourt')?.value || 'Cancha 1').trim();
    node.time = (document.getElementById('dynPoTime')?.value || '19:30').trim();

    const parsedSets = [];
    for (let i = 1; i <= 3; i++) {
      const aRaw = document.getElementById(`dynPoS${i}A`)?.value ?? '';
      const bRaw = document.getElementById(`dynPoS${i}B`)?.value ?? '';
      if (String(aRaw).trim() !== '' && String(bRaw).trim() !== '') {
        parsedSets.push([Number(aRaw), Number(bRaw)]);
      }
    }

    const manualWinner = document.getElementById('dynPoWinner')?.value || '';

    if (parsedSets.length > 0) {
      const valid = validateMatchSets(parsedSets);
      if (!valid.ok) {
        showToast(valid.msg, 'error');
        return;
      }
      node.sets = parsedSets;
      if (manualWinner) {
        node.winner = manualWinner;
      } else if (node.teamA && node.teamB) {
        node.winner = evaluateMatch(parsedSets, node.teamA, node.teamB).winnerId;
      } else if (node.teamA || node.teamB) {
        node.winner = node.teamA || node.teamB;
      }
    } else {
      node.sets = [];
      node.winner = manualWinner || null;
    }

    propagatePlayoffs(cat);
    if (typeof saveState === 'function') saveState();
    hide();
    if (typeof render === 'function') render();
    injectResetAllButton();
    hidePlayoffManualAdvanceButtons();

    const advName = node.winner ? getTeamDisplayName(cat, node.winner, 'Ganador') : null;
    showToast(
      advName ? `Guardado: avanzó ${advName} a la siguiente ronda.` : `Partido de ${stageKey.toUpperCase()} guardado.`,
      'success'
    );
  };
}

window.openPlayoffModal = openPlayoffModal;

if (typeof openMatchModal !== 'function') {
  function openMatchModal(matchId, categoryId) {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede anotar resultados.', 'info');
      return;
    }

    const cats = typeof getDisplayedCategories === 'function' ? getDisplayedCategories() : (state?.categories || []);
    const cat = cats.find(c => c.id === categoryId) || (typeof getActiveCategory === 'function' ? getActiveCategory() : null);
    const match = cat?.matches?.find(m => m.id === matchId);

    const realModal = document.getElementById('matchModal');
    const idInput = document.getElementById('modalMatchId');

    if (realModal && match) {
      realModal.dataset.activeMatchId = match.id;
      if (idInput) idInput.value = match.id;

      const setIfExists = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
      };
      const checkIfExists = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(checked);
      };

      const teamA = (cat.teams || []).find(t => t.id === match.teamAId);
      const teamB = (cat.teams || []).find(t => t.id === match.teamBId);
      const pA = Array.isArray(match.playersA) && match.playersA.length ? match.playersA : [teamA?.player1Id, teamA?.player2Id];
      const pB = Array.isArray(match.playersB) && match.playersB.length ? match.playersB : [teamB?.player1Id, teamB?.player2Id];

      setIfExists('modalPlayerA1', pA?.[0] || '');
      setIfExists('modalPlayerA2', pA?.[1] || '');
      setIfExists('modalPlayerB1', pB?.[0] || '');
      setIfExists('modalPlayerB2', pB?.[1] || '');

      setIfExists('modalCourt', match.court || 'Cancha 1');
      setIfExists('modalTime', match.time || '19:30');
      setIfExists('modalDate', match.customDate || '');

      checkIfExists('modalIsWO', Boolean(match.woAbsent));
      ensureWoTeamSelectorInModal(realModal, cat, match);
      if (match.woAbsent) {
        const absentSide = resolveAbsentTeamId(cat, match) === match.teamBId || match.woAbsent === 'B' ? 'B' : 'A';
        setIfExists('modalWOAbsent', absentSide);
      }
      checkIfExists('modalIsDelayed', Boolean(match.delayed && !match.played));
      setIfExists('modalDelayedNote', match.delayedNote || '');

      const sets = extractMatchSetsList(match);
      let usedNamed = false;
      for (let i = 1; i <= 5; i++) {
        const s = sets[i - 1];
        const valA = s ? s[0] : '';
        const valB = s ? s[1] : '';
        const { elA, elB } = getSetInputPair(realModal, i);
        if (elA || elB) usedNamed = true;
        if (elA) elA.value = valA;
        if (elB) elB.value = valB;
      }

      if (!usedNamed) {
        const { pairs } = getScoreboardNumericInputs(realModal);
        pairs.forEach(([inpA, inpB], idx) => {
          const s = sets[idx];
          if (inpA) inpA.value = s ? s[0] : '';
          if (inpB) inpB.value = s ? s[1] : '';
        });
      }

      applyTeamLabelsToMatchModal(realModal, cat, match);
      realModal.classList.remove('hidden');
      syncModalWoVisualState();
      updatePointsPreview();
      return;
    }

    ensureFallbackModal(
      'fallbackMatchModal',
      '📝 Gestionar / Anotar Partido',
      `<p>Partido ID: <code>${matchId}</code> · Categoría: <code>${categoryId}</code>. No se encontró el formulario <code>#matchModal</code> en <code>index.html</code>.</p>`
    );
  }
}

if (typeof switchTab !== 'function') {
  function switchTab(tabName) {
    if (!tabName) return;
    if (typeof state === 'object' && state) state.activeTab = tabName;
    if (typeof saveState === 'function') saveState();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
    if (typeof updateNavScrollButtons === 'function') {
      setTimeout(updateNavScrollButtons, 50);
    }
  }
}

const playoffFormEl = document.getElementById('playoffForm');
if (playoffFormEl) {
  playoffFormEl.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede guardar resultados.', 'info');
      return;
    }
    const cat = typeof getActiveCategory === 'function' ? getActiveCategory() : null;
    if (!cat || !cat.playoffs) return;
    const stageKey = document.getElementById('poStageKey')?.value;
    const node = cat.playoffs[stageKey];
    if (!node) return;

    node.playersA = [document.getElementById('poPlayerA1')?.value || null, document.getElementById('poPlayerA2')?.value || null];
    node.playersB = [document.getElementById('poPlayerB1')?.value || null, document.getElementById('poPlayerB2')?.value || null];
    node.court = document.getElementById('poCourt')?.value || 'Cancha 1';
    node.time = document.getElementById('poTime')?.value || '19:30';
    node.customDate = document.getElementById('poDate')?.value || '';

    const isWO = Boolean(document.getElementById('poIsWO')?.checked);
    const woAbsent = document.getElementById('poWOAbsent')?.value || 'A';

    if (isWO) {
      node.woAbsent = woAbsent;
      node.sets = (normalizeWoSets(woAbsent) || [[6, 0], [6, 0]]).map(s => [s[0], s[1]]);
      node.winner = woAbsent === 'A' ? node.teamB : node.teamA;
    } else {
      node.woAbsent = null;
      const sets = [];
      for (let i = 1; i <= 3; i++) {
        const aVal = document.getElementById(`poSet${i}A`)?.value ?? '';
        const bVal = document.getElementById(`poSet${i}B`)?.value ?? '';
        if (aVal !== '' && bVal !== '') sets.push([Number(aVal), Number(bVal)]);
      }
      if (!sets.length) {
        showToast('Ingresa al menos los 2 primeros sets o marca W.O.', 'error');
        return;
      }
      const valid = validateMatchSets(sets);
      if (!valid.ok) {
        showToast(valid.msg, 'error');
        return;
      }
      node.sets = sets;
      node.winner = evaluateMatch(sets, node.teamA, node.teamB).winnerId;
    }

    propagatePlayoffs(cat);
    if (typeof saveState === 'function') saveState();
    closePlayoffModal();
    if (typeof render === 'function') render();
    fixUndefinedSeasonLabels(state?.seasonNumber || 1);
    injectResetAllButton();
    hidePlayoffManualAdvanceButtons();
    showToast('Marcador de playoff guardado y ganador avanzado.', 'success');
  });
}

function getOrderedScoreInputs(modal) {
  if (!modal) return [];
  const { pairs } = getScoreboardNumericInputs(modal);
  if (!Array.isArray(pairs) || !pairs.length) return [];

  const ordered = [];
  pairs.forEach(([inpA, inpB]) => {
    if (inpA) ordered.push(inpA);
    if (inpB) ordered.push(inpB);
  });
  return ordered.filter(el => !el.disabled && el.offsetParent !== null);
}

function focusFirstScoreboardInput(modal) {
  const targetModal = modal || document.getElementById('matchModal');
  if (!targetModal) return;
  setTimeout(() => {
    const ordered = getOrderedScoreInputs(targetModal);
    const first = ordered[0];
    if (first) {
      first.focus();
      if (typeof first.select === 'function') first.select();
    }
  }, 60);
}

function setupScoreboardZigzagNavigation() {
  const modal = document.getElementById('matchModal');
  if (!modal) return;

  if (modal.dataset.zigzagBound !== 'true') {
    modal.dataset.zigzagBound = 'true';
    const jumpTimers = new WeakMap();

    modal.addEventListener('input', function (e) {
      const input = e.target;
      if (!input || input.tagName !== 'INPUT') return;

      const orderedInputs = getOrderedScoreInputs(modal);
      const currentIdx = orderedInputs.indexOf(input);
      if (currentIdx === -1) return;

      const val = String(input.value || '').trim();
      if (!val) return;

      const prevTimer = jumpTimers.get(input);
      if (prevTimer) clearTimeout(prevTimer);

      const delay = val === '1' ? 220 : 60;

      const timer = setTimeout(() => {
        const refreshed = getOrderedScoreInputs(modal);
        const idx = refreshed.indexOf(input);
        if (idx !== -1 && idx + 1 < refreshed.length && String(input.value || '').trim() !== '') {
          const nextInput = refreshed[idx + 1];
          nextInput.focus();
          if (typeof nextInput.select === 'function') {
            nextInput.select();
          }
        }
      }, delay);

      jumpTimers.set(input, timer);
    });

    modal.addEventListener('keydown', function (e) {
      const input = e.target;
      if (!input || input.tagName !== 'INPUT') return;

      const orderedInputs = getOrderedScoreInputs(modal);
      const currentIdx = orderedInputs.indexOf(input);
      if (currentIdx === -1) return;

      if (e.key === 'Enter') {
        const nextInput = orderedInputs[currentIdx + 1];
        if (nextInput) {
          e.preventDefault();
          nextInput.focus();
          if (typeof nextInput.select === 'function') nextInput.select();
        }
      }
    });

    if (typeof MutationObserver === 'function' && modal.dataset.visibilityObserved !== 'true') {
      modal.dataset.visibilityObserved = 'true';
      let wasHidden = modal.classList.contains('hidden');
      const observer = new MutationObserver(() => {
        const isHidden = modal.classList.contains('hidden');
        if (wasHidden && !isHidden) {
          const matchId = document.getElementById('modalMatchId')?.value || modal.dataset.activeMatchId;
          const { cat, match } = findMatchAndCategory(matchId);
          ensureWoTeamSelectorInModal(modal, cat, match);
          syncModalWoVisualState();
          focusFirstScoreboardInput(modal);
        }
        wasHidden = isHidden;
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  }
}

function fillScoreboardInputsWithSets(modal, setsToFill) {
  if (!modal) return;
  const sets = Array.isArray(setsToFill) ? setsToFill : [];
  let usedNamed = false;

  for (let i = 1; i <= 5; i++) {
    const s = sets[i - 1];
    const valA = s ? String(Array.isArray(s) ? s[0] : (s.a ?? '')) : '';
    const valB = s ? String(Array.isArray(s) ? s[1] : (s.b ?? '')) : '';
    if (typeof getSetInputPair === 'function') {
      const { elA, elB } = getSetInputPair(modal, i);
      if (elA || elB) usedNamed = true;
      if (elA) {
        elA.value = valA;
        elA.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (elB) {
        elB.value = valB;
        elB.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  if (!usedNamed && typeof getScoreboardNumericInputs === 'function') {
    const { pairs } = getScoreboardNumericInputs(modal);
    pairs.forEach(([inpA, inpB], idx) => {
      const s = sets[idx];
      const valA = s ? String(Array.isArray(s) ? s[0] : (s.a ?? '')) : '';
      const valB = s ? String(Array.isArray(s) ? s[1] : (s.b ?? '')) : '';
      if (inpA) {
        inpA.value = valA;
        inpA.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inpB) {
        inpB.value = valB;
        inpB.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }
}

function syncModalWoVisualState() {
  const modal = document.getElementById('matchModal');
  if (!modal) return;

  const matchId = document.getElementById('modalMatchId')?.value || modal.dataset.activeMatchId;
  const { cat, match } = findMatchAndCategory(matchId);
  const absentSelect = ensureWoTeamSelectorInModal(modal, cat, match);

  const woCheckbox =
    document.getElementById('modalIsWO') ||
    Array.from(modal.querySelectorAll('input[type="checkbox"]')).find(cb => {
      const txt = (cb.closest('label')?.textContent || cb.parentElement?.textContent || '').toLowerCase();
      return txt.includes('walkover') || txt.includes('w.o');
    });

  if (!woCheckbox) return;

  const isChecked = Boolean(woCheckbox.checked);
  const box = document.getElementById('modalWoAbsentBox');
  if (box) {
    box.style.display = isChecked ? 'flex' : 'none';
  }

  const absentSide = absentSelect?.value || getModalWoAbsentSide(modal, match);

  if (isChecked) {
    const woSets = normalizeWoSets(absentSide);
    fillScoreboardInputsWithSets(modal, woSets);
    if (typeof updatePointsPreview === 'function') {
      updatePointsPreview();
    }
  }
}

function bindModalWoAutoFill() {
  const modal = document.getElementById('matchModal');
  if (!modal || modal.dataset.woVisualBound === 'true') return;
  modal.dataset.woVisualBound = 'true';

  modal.addEventListener('change', function (e) {
    const target = e.target;
    if (!target) return;
    const id = (target.id || '').toLowerCase();
    const labelTxt = (target.closest?.('label')?.textContent || target.parentElement?.textContent || '').toLowerCase();

    if (
      id.includes('wo') ||
      labelTxt.includes('walkover') ||
      labelTxt.includes('w.o') ||
      labelTxt.includes('no se presentó')
    ) {
      syncModalWoVisualState();
    }
  });
}

if (typeof window.openMatchModal === 'function' && !window.__openMatchModalFocusWrapped) {
  const prevOpenMatchModal = window.openMatchModal;
  window.openMatchModal = function (...args) {
    if (!window.__isLeagueAdmin) {
      showToast('Modo solo lectura: solo el administrador puede anotar resultados.', 'info');
      return;
    }
    const out = prevOpenMatchModal.apply(this, args);
    const modal = document.getElementById('matchModal');
    const matchId = args[0] || document.getElementById('modalMatchId')?.value || modal?.dataset?.activeMatchId;
    const { cat, match } = findMatchAndCategory(matchId);
    ensureWoTeamSelectorInModal(modal, cat, match);
    syncModalWoVisualState();
    focusFirstScoreboardInput(modal);
    return out;
  };
  window.__openMatchModalFocusWrapped = true;
}

async function initApp() {
  try {
    if (typeof initStateFromSQLite === 'function') {
      state = await initStateFromSQLite();
    } else if (typeof loadState === 'function') {
      state = loadState();
    }
  } catch (err) {
    console.error('Error inicializando SQLite:', err);
    if (typeof loadState === 'function') state = loadState();
    showToast('No se pudo cargar SQLite; iniciando con respaldo local.', 'warning');
  }

  ensureDefaultCategories();
  if (!state.seasonNumber && !state.currentSeason && !state.season) {
    setActiveSeasonState(state, 1);
  } else {
    const activeNum = Math.max(1, Number(state.seasonNumber || state.currentSeason || state.season || 1));
    setActiveSeasonState(state, activeNum);
  }

  const container = document.getElementById('navTabsContainer');
  if (container) {
    container.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  if (typeof updateNavScrollButtons === 'function') {
    window.addEventListener('resize', updateNavScrollButtons);
    setTimeout(updateNavScrollButtons, 100);
  }

  wrapRenderIfAvailable();
  if (typeof render === 'function') render();
  fixUndefinedSeasonLabels(state?.seasonNumber || 1);
  const activeCat = (state?.categories || []).find(c => c.id === state?.activeCategoryId) || state?.categories?.[0];
  syncFormatControlsFromCategory(activeCat);
  injectResetAllButton();
  hidePlayoffManualAdvanceButtons();
  transformDomStandingsTables(activeCat);
  setupScoreboardZigzagNavigation();
  bindModalWoAutoFill();
  applyReadOnlyRestrictions();
}

/* ==========================================================================
   MODO ADMINISTRADOR, PUBLICACIÓN JSON Y FOTOS DEL SALÓN DE LA FAMA
   ========================================================================== */

const ADMIN_SECRET_KEY = 'padel2026';
const ADMIN_SESSION_STORAGE = 'padeltour_is_admin_v1';
const PUBLIC_DATA_FILE = './datos_liga.json';

function checkAdminAccess() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlAdmin = params.get('admin');
    if (urlAdmin === ADMIN_SECRET_KEY) {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE, '1');
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return true;
    }
    if (urlAdmin === '0' || urlAdmin === 'false') {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE);
      return false;
    }
    return sessionStorage.getItem(ADMIN_SESSION_STORAGE) === '1';
  } catch (_e) {
    return false;
  }
}

window.__isLeagueAdmin = checkAdminAccess();

function exportPublicLeagueJson() {
  try {
    if (typeof state === 'object' && state && window.__hofPhotoCache) {
      state.hofPhotos = {
        ...(state.hofPhotos || {}),
        ...window.__hofPhotoCache
      };
    }
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos_liga.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast('Archivo datos_liga.json descargado. Súbelo a GitHub para actualizar la web.', 'success');
    }
  } catch (err) {
    console.error('Error exportando datos_liga.json:', err);
  }
}

async function syncFromPublicDataIfVisitor() {
  if (window.__isLeagueAdmin) return;

  try {
    const res = await fetch(`${PUBLIC_DATA_FILE}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remoteData = await res.json();
    if (!remoteData || !Array.isArray(remoteData.categories)) return;

    const normalized = typeof normalizeLoadedState === 'function'
      ? normalizeLoadedState(remoteData)
      : remoteData;

    if (remoteData.hofPhotos && typeof remoteData.hofPhotos === 'object') {
      normalized.hofPhotos = remoteData.hofPhotos;
      window.__hofPhotoCache = { ...remoteData.hofPhotos };
    }

    if (typeof saveState === 'function') {
      saveState(normalized);
    } else {
      state = normalized;
    }

    if (typeof renderApp === 'function') {
      renderApp();
    } else if (typeof render === 'function') {
      render();
    } else if (typeof initApp === 'function') {
      initApp();
    }
  } catch (_err) {
    // Si aún no existe datos_liga.json en el servidor, mantiene los datos locales sin error
  }
}

function isInsideModalOrCloseControl(el) {
  if (!el) return false;
  const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  if (
    txt === '×' ||
    txt === 'x' ||
    txt === 'cerrar' ||
    txt === 'cancelar' ||
    txt.includes('cerrar') ||
    txt.includes('cancelar') ||
    aria.includes('close') ||
    aria.includes('cerrar')
  ) {
    return true;
  }
  return false;
}

function isFilterOrNavigationControl(el) {
  if (!el) return false;
  if (el.closest('nav, header, [role="tablist"], #league-admin-floating-bar')) return true;
  if (isInsideModalOrCloseControl(el)) return true;

  const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const filterLabels = [
    'tabla de posiciones', 'fixture y fechas', 'partidos retrasados',
    'playoffs y podio', 'salón de la fama', 'jugadores y perfiles',
    'ascensos y descensos', 'parejas', 'ambas', 'zona a', 'zona b',
    'todas las fechas', 'todos', 'filtrar', 'buscar', 'ver', 'cerrar', 'cancelar'
  ];

  if (filterLabels.some(lbl => txt === lbl || txt.startsWith(lbl + ' ('))) {
    return true;
  }

  const onclickAttr = (el.getAttribute('onclick') || '').toLowerCase();
  if (
    onclickAttr.includes('switchtab') ||
    onclickAttr.includes('selectcategory') ||
    onclickAttr.includes('setroundfilter') ||
    onclickAttr.includes('setfixturezonefilter') ||
    onclickAttr.includes('setplayersort') ||
    onclickAttr.includes('filterplayers') ||
    onclickAttr.includes('close') ||
    onclickAttr.includes("classlist.add('hidden')") ||
    onclickAttr.includes('classlist.add("hidden")')
  ) {
    return true;
  }

  return false;
}

function isMutatingControl(el) {
  if (!el || isFilterOrNavigationControl(el) || isInsideModalOrCloseControl(el)) return false;

  const tag = (el.tagName || '').toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();
  const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  const onclickAttr = (el.getAttribute('onclick') || '').toLowerCase();

  if (el.closest('form')) return true;
  if (tag === 'label' && el.querySelector('input[type="file"]')) return true;
  if (type === 'submit') return true;

  const mutatingWords = [
    'guardar', 'anotar', 'agregar', 'añadir', 'crear', 'nuevo', 'nueva',
    'eliminar', 'borrar', 'disolver', 'quitar', 'editar', 'reemplazar',
    'cerrar temporada', 'reiniciar', 'reset', 'vaciar', 'importar', 'exportar',
    'asociar foto', 'cambiar foto', 'generar', 'actualizar fixture',
    'cargar clasificados', 'avanzar', 'deshacer', 'ascenso', 'descenso',
    'simular', 'registrar', 'marcar retraso', 'wo', 'w.o', 'limpiar'
  ];

  if (mutatingWords.some(w => txt.includes(w) || title.includes(w))) {
    return true;
  }

  const mutatingHandlers = [
    'save', 'delete', 'remove', 'dissolve', 'create', 'add', 'register',
    'edit', 'swap', 'reset', 'rollover', 'regenerate', 'generatefixture',
    'syncplayoffs', 'advanceplayoff', 'togglequickdelay', 'import', 'hof'
  ];

  if (mutatingHandlers.some(fn => onclickAttr.includes(fn))) {
    return true;
  }

  return false;
}

function applyReadOnlyRestrictions() {
  if (window.__isLeagueAdmin) {
    document.querySelectorAll('[data-hidden-readonly="true"]').forEach(el => {
      el.style.removeProperty('display');
      el.removeAttribute('data-hidden-readonly');
    });
    document.querySelectorAll('input[disabled], select[disabled], textarea[disabled]').forEach(ctrl => {
      if (ctrl.dataset.disabledByPublic === 'true') {
        ctrl.disabled = false;
        delete ctrl.dataset.disabledByPublic;
      }
    });
    return;
  }

  if (!document.getElementById('public-readonly-style')) {
    const style = document.createElement('style');
    style.id = 'public-readonly-style';
    style.textContent = `
      .hof-admin-controls,
      [data-admin-only="true"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('button, label, a[role="button"]').forEach(el => {
    if (isInsideModalOrCloseControl(el)) {
      if (el.getAttribute('data-hidden-readonly') === 'true') {
        el.style.removeProperty('display');
        el.removeAttribute('data-hidden-readonly');
      }
      return;
    }
    if (isMutatingControl(el)) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-hidden-readonly', 'true');
    }
  });

  document.querySelectorAll('input, select, textarea').forEach(ctrl => {
    if (ctrl.closest('#league-admin-floating-bar')) return;
    const id = (ctrl.id || '').toLowerCase();
    const isSearchOrFilter =
      id.includes('search') ||
      id.includes('filter') ||
      id.includes('sort') ||
      id.includes('round') ||
      id.includes('category') ||
      id.includes('season') ||
      id.includes('zone');

    if (!isSearchOrFilter && !ctrl.disabled) {
      ctrl.disabled = true;
      ctrl.dataset.disabledByPublic = 'true';
    }
  });
}

if (!window.__publicReadonlyClickGuardBound) {
  window.__publicReadonlyClickGuardBound = true;

  document.addEventListener(
    'click',
    function (e) {
      if (window.__isLeagueAdmin) return;
      const target = e.target?.closest?.('button, label, a[role="button"], input[type="submit"]');
      if (!target || isInsideModalOrCloseControl(target)) return;
      if (isMutatingControl(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (typeof showToast === 'function') {
          showToast('Modo solo lectura: solo el administrador puede modificar datos.', 'info');
        }
      }
    },
    true
  );

  document.addEventListener('click', function (e) {
    const openModals = document.querySelectorAll(
      '#playerEditorModal:not(.hidden), #matchModal:not(.hidden), #playoffEditorModal:not(.hidden), #swapPlayerModal:not(.hidden), #confirmActionModal:not(.hidden)'
    );
    openModals.forEach(modal => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const openModals = document.querySelectorAll(
      '#playerEditorModal:not(.hidden), #matchModal:not(.hidden), #playoffEditorModal:not(.hidden), #swapPlayerModal:not(.hidden), #confirmActionModal:not(.hidden)'
    );
    openModals.forEach(modal => modal.classList.add('hidden'));
  });
}

function renderAdminFloatingBar() {
  const existing = document.getElementById('league-admin-floating-bar');
  if (!window.__isLeagueAdmin) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;

  const bar = document.createElement('div');
  bar.id = 'league-admin-floating-bar';
  bar.style.cssText = [
    'position:fixed',
    'bottom:16px',
    'right:16px',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:10px 14px',
    'border-radius:14px',
    'background:#0f172a',
    'color:#ffffff',
    'box-shadow:0 10px 25px rgba(15,23,42,0.28)',
    'font-family:inherit',
    'font-size:12px'
  ].join(';');

  bar.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#fbbf24;">
      ● Modo Admin
    </span>
    <button type="button" id="btn-export-public-json" style="padding:6px 10px;border-radius:8px;border:none;background:#10b981;color:#ffffff;font-weight:700;cursor:pointer;">
      Exportar datos_liga.json
    </button>
    <button type="button" id="btn-exit-admin-mode" style="padding:6px 9px;border-radius:8px;border:1px solid #334155;background:transparent;color:#cbd5e1;font-weight:600;cursor:pointer;">
      Ver como Público
    </button>
  `;

  document.body.appendChild(bar);

  document.getElementById('btn-export-public-json').onclick = exportPublicLeagueJson;
  document.getElementById('btn-exit-admin-mode').onclick = () => {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE);
    window.__isLeagueAdmin = false;
    window.location.reload();
  };
}

/* --- FOTOS DEL SALÓN DE LA FAMA (CON COMPRESIÓN AUTOMÁTICA) --- */

window.__hofPhotoCache = window.__hofPhotoCache || {};

function getHofCardKey(anchorEl, index = 0) {
  const card = anchorEl.closest('[class*="rounded"]') || anchorEl.parentElement || document.body;
  const heading = card.querySelector('h1, h2, h3, h4, strong');
  const titleText = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
  const rawKey = titleText || `hof_card_${index}`;
  return rawKey.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 120);
}

function getHofPhotoDataUrl(cardKey) {
  if (typeof state === 'object' && state && state.hofPhotos && state.hofPhotos[cardKey]) {
    return state.hofPhotos[cardKey];
  }
  return window.__hofPhotoCache[cardKey] || '';
}

function setHofPhotoDataUrl(cardKey, dataUrl) {
  if (!window.__isLeagueAdmin) return;
  if (typeof state === 'object' && state) {
    if (!state.hofPhotos || typeof state.hofPhotos !== 'object') {
      state.hofPhotos = {};
    }
    if (dataUrl) {
      state.hofPhotos[cardKey] = dataUrl;
    } else {
      delete state.hofPhotos[cardKey];
    }
  }
  if (dataUrl) {
    window.__hofPhotoCache[cardKey] = dataUrl;
  } else {
    delete window.__hofPhotoCache[cardKey];
  }
  if (typeof saveState === 'function') {
    try { saveState(); } catch (_e) {}
  }
}

function compressImageFileToDataUrl(file, maxWidth = 960, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / (img.width || maxWidth));
        const targetW = Math.round((img.width || maxWidth) * scale);
        const targetH = Math.round((img.height || maxWidth) * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function findPlayoffsListEndAnchor() {
  const all = Array.from(document.querySelectorAll('div, section, article, ul, ol'));
  const listContainers = all.filter(el => {
    if (el.closest('[data-hof-photo-slot="true"]')) return false;
    const txt = (el.textContent || '').toLowerCase();
    const hasGranFinal = txt.includes('gran final');
    const hasSemi = txt.includes('semifinal');
    const hasCuartos = txt.includes('cuartos de final');
    return hasGranFinal && (hasSemi || hasCuartos) && txt.length < 1800;
  });

  return listContainers.filter(el => {
    return !listContainers.some(other => other !== el && el.contains(other));
  });
}

function renderHallOfFamePlayoffPhotos() {
  try {
    const anchors = findPlayoffsListEndAnchor();
    if (!anchors.length) return;

    anchors.forEach((playoffsListEl, idx) => {
      const parent = playoffsListEl.parentElement;
      if (!parent) return;

      const cardKey = getHofCardKey(playoffsListEl, idx);
      const photoUrl = getHofPhotoDataUrl(cardKey);

      if (!window.__isLeagueAdmin && !photoUrl) {
        const oldSlot = parent.querySelector(`[data-hof-photo-key="${cardKey}"]`);
        if (oldSlot) oldSlot.remove();
        return;
      }

      let slotEl = parent.querySelector(`[data-hof-photo-key="${cardKey}"]`);
      if (!slotEl) {
        slotEl = document.createElement('div');
        slotEl.dataset.hofPhotoKey = cardKey;
        slotEl.dataset.hofPhotoSlot = 'true';
        slotEl.style.marginTop = '12px';
        slotEl.style.padding = '12px';
        slotEl.style.borderRadius = '16px';
        slotEl.style.border = '1px solid rgba(251, 191, 36, 0.65)';
        slotEl.style.background = '#ffffff';
        slotEl.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
      }

      if (playoffsListEl.nextSibling !== slotEl) {
        parent.insertBefore(slotEl, playoffsListEl.nextSibling);
      }

      const adminButtonsHtml = window.__isLeagueAdmin
        ? `<div class="hof-admin-controls" style="display:flex; align-items:center; gap:6px;">
             <label style="padding:5px 10px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:11px; font-weight:700; cursor:pointer;">
               ${photoUrl ? 'Cambiar Foto' : 'Asociar Foto'}
               <input type="file" accept="image/*" style="display:none;" class="hof-photo-file-input">
             </label>
             ${photoUrl ? `
               <button type="button" class="hof-remove-photo-btn" style="padding:5px 9px; border-radius:8px; background:#ffe4e6; color:#be123c; border:1px solid #fecdd3; font-size:11px; font-weight:700; cursor:pointer;">
                 Quitar
               </button>
             ` : ''}
           </div>`
        : '';

      slotEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px;">
          <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#78350f;">
            📸 Foto Destacada de la Pareja
          </span>
          ${adminButtonsHtml}
        </div>
        ${photoUrl
          ? `<div style="width:100%; min-height:220px; max-height:320px; border-radius:12px; overflow:hidden; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center;">
               <img src="${photoUrl}" alt="Foto Salón de la Fama" style="width:100%; height:100%; max-height:320px; object-fit:contain; object-position:center; display:block;">
             </div>`
          : `<div style="width:100%; height:190px; border-radius:12px; border:1.5px dashed #fcd34d; background:#fffbeb; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:12px;">
               <span style="font-size:12px; font-weight:700; color:#78350f;">Sin foto asociada aún</span>
               <span style="font-size:11px; color:#b45309; margin-top:4px;">Haz clic en "Asociar Foto" para mostrarla aquí.</span>
             </div>`
        }
      `;

      const fileInput = slotEl.querySelector('.hof-photo-file-input');
      if (fileInput) {
        fileInput.onchange = async (ev) => {
          if (!window.__isLeagueAdmin) return;
          const file = ev.target?.files?.[0];
          if (!file) return;
          try {
            const dataUrl = await compressImageFileToDataUrl(file, 960, 0.8);
            setHofPhotoDataUrl(cardKey, dataUrl);
            renderHallOfFamePlayoffPhotos();
            if (typeof showToast === 'function') {
              showToast('Foto optimizada y asociada al Salón de la Fama.', 'success');
            }
          } catch (err) {
            console.error('Error cargando foto del Salón de la Fama:', err);
          } finally {
            ev.target.value = '';
          }
        };
      }

      const removeBtn = slotEl.querySelector('.hof-remove-photo-btn');
      if (removeBtn) {
        removeBtn.onclick = () => {
          if (!window.__isLeagueAdmin) return;
          setHofPhotoDataUrl(cardKey, '');
          renderHallOfFamePlayoffPhotos();
          if (typeof showToast === 'function') {
            showToast('Foto quitada del Salón de la Fama.', 'info');
          }
        };
      }
    });
  } catch (err) {
    console.error('[HOF Photo] Error:', err);
  }
}

window.renderHallOfFamePlayoffPhotos = renderHallOfFamePlayoffPhotos;

const prevPostRenderForHof = typeof runPostRenderEnhancements === 'function' ? runPostRenderEnhancements : null;
runPostRenderEnhancements = function (...args) {
  const res = prevPostRenderForHof ? prevPostRenderForHof.apply(this, args) : undefined;
  setTimeout(() => {
    renderHallOfFamePlayoffPhotos();
    applyReadOnlyRestrictions();
    renderAdminFloatingBar();
  }, 40);
  return res;
};

document.addEventListener('click', () => {
  setTimeout(() => {
    renderHallOfFamePlayoffPhotos();
    applyReadOnlyRestrictions();
  }, 100);
});

setInterval(() => {
  renderHallOfFamePlayoffPhotos();
  applyReadOnlyRestrictions();
  renderAdminFloatingBar();
}, 1000);

setTimeout(() => {
  syncFromPublicDataIfVisitor();
  renderHallOfFamePlayoffPhotos();
  applyReadOnlyRestrictions();
  renderAdminFloatingBar();
}, 250);

window.addEventListener('DOMContentLoaded', initApp);
