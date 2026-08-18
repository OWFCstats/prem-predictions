/* Scoring — a direct port of the formula from the original spreadsheet.

   For each of the 20 teams:
       points = ABS(predicted position - actual current position)
   Player total = sum across all 20 teams.
   LOWEST total wins. A perfect table is 0.

   See reference/scoring_formulas.md for the full write-up. */

/* liveTable: array of { team_code, position }  (position may be null)
   Returns a Map of team_code -> position, skipping unset teams. */
function livePositionMap(liveTable) {
  const map = new Map();
  (liveTable || []).forEach(row => {
    if (row.position !== null && row.position !== undefined) {
      map.set(row.team_code, Number(row.position));
    }
  });
  return map;
}

/* prediction: { player_name, predicted_order: [codes, 1st first] }
   Returns { total, perTeam: [{ code, predicted, actual, diff }], exact }
   Teams with no live position yet are skipped (contribute 0 and are not
   counted as exact hits) so a part-filled table doesn't score as perfect. */
function scorePrediction(prediction, posMap) {
  const order = prediction.predicted_order || [];
  const perTeam = [];
  let total = 0;
  let exact = 0;

  order.forEach((code, i) => {
    const predicted = i + 1;
    if (!posMap.has(code)) {
      perTeam.push({ code, predicted, actual: null, diff: null });
      return;
    }
    const actual = posMap.get(code);
    const diff = Math.abs(predicted - actual);
    total += diff;
    if (diff === 0) exact++;
    perTeam.push({ code, predicted, actual, diff });
  });

  return { total, perTeam, exact };
}

/* Scores everyone and sorts best (lowest) first.
   Ties share a rank, matching how you'd read a league table. */
function buildLeaderboard(predictions, liveTable) {
  const posMap = livePositionMap(liveTable);
  const scored = (predictions || []).map(p => {
    const s = scorePrediction(p, posMap);
    return {
      player_name: p.player_name,
      total: s.total,
      exact: s.exact,
      perTeam: s.perTeam
    };
  });

  scored.sort((a, b) => a.total - b.total || a.player_name.localeCompare(b.player_name));

  let lastTotal = null;
  let lastRank = 0;
  scored.forEach((row, i) => {
    if (row.total === lastTotal) {
      row.rank = lastRank;
    } else {
      row.rank = i + 1;
      lastRank = row.rank;
      lastTotal = row.total;
    }
  });

  return { rows: scored, teamsRanked: posMap.size };
}

/* Renders the 20-segment deviation strip: one bar per team, taller = further
   off. Green bars are exact hits. Capped at 10 so one wild miss doesn't
   flatten everything else. */
function stripHTML(perTeam) {
  const CAP = 10;
  return perTeam.map(t => {
    if (t.diff === null) return '<i style="height:2px;opacity:.25"></i>';
    const pct = Math.max(8, Math.min(100, (t.diff / CAP) * 100));
    const hit = t.diff === 0 ? ' data-hit="1"' : '';
    return `<i style="height:${pct}%"${hit} title="${t.code}: off by ${t.diff}"></i>`;
  }).join('');
}
