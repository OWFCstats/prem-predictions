/* Single player's prediction plus their points per team, reached by
   clicking a name on the leaderboard, progress table, or a league board. */

(async function () {
  const title = document.getElementById('player-title');
  const sub = document.getElementById('player-sub');
  const stats = document.getElementById('stats');
  const board = document.getElementById('player-board');

  const name = new URLSearchParams(location.search).get('name');

  if (!name) {
    title.textContent = 'Player not found';
    board.innerHTML = '<div class="empty">No player was specified.</div>';
    return;
  }

  title.textContent = name;

  const locked = await isLocked();
  if (!locked) {
    sub.textContent = 'Predictions are private until the season starts.';
    board.innerHTML = '<div class="empty">Check back once the season kicks off.</div>';
    return;
  }

  const [{ data: prediction, error }, teams, { data: live }] = await Promise.all([
    db.from('predictions').select('player_name, predicted_order').eq('player_name', name).maybeSingle(),
    loadTeams(),
    db.from('live_table').select('team_code, position')
  ]);

  if (error || !prediction) {
    title.textContent = 'Player not found';
    board.innerHTML = '<div class="empty">No prediction on file for "' + escapeHTML(name) + '".</div>';
    return;
  }

  const teamNames = new Map(teams.map(t => [t.code, t.name]));
  const posMap = livePositionMap(live || []);
  const { total, perTeam, exact } = scorePrediction(prediction, posMap);

  if (posMap.size === 0) {
    sub.textContent = "The live table hasn't been set yet, so scores aren't available.";
  } else {
    sub.textContent = posMap.size < 20
      ? 'Only ' + posMap.size + ' of 20 clubs are placed in the live table, so this score is partial.'
      : "Here's how their table stacks up against the real one.";
    stats.hidden = false;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-exact').textContent = exact;
  }

  const rows = perTeam.map(t => {
    const teamName = escapeHTML(teamNames.get(t.code) || t.code);
    const actual = t.actual === null ? '–' : t.actual;
    const diff = t.diff === null ? '–' : t.diff;
    return '<tr' + (t.diff === 0 ? ' class="leader"' : '') + '>' +
      '<td class="rank">' + t.predicted + '</td>' +
      '<td class="player">' + teamName + '</td>' +
      '<td style="text-align:right">' + actual + '</td>' +
      '<td class="score">' + diff + '</td>' +
    '</tr>';
  }).join('');

  board.innerHTML = '<div class="table-wrap"><table>' +
    '<thead><tr><th>Predicted</th><th>Team</th>' +
    '<th style="text-align:right">Actual</th><th style="text-align:right">Off by</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
})();
