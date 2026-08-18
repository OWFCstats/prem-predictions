/* Overall leaderboard. renderBoard() is shared with the leagues page. */

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function fetchBoardData() {
  const [preds, live] = await Promise.all([
    db.from('predictions').select('player_name, predicted_order'),
    db.from('live_table').select('team_code, position')
  ]);
  return {
    predictions: preds.data || [],
    live: live.data || [],
    error: preds.error || live.error
  };
}

/* Renders into `target`. `rowsFilter` optionally limits to a set of names. */
function renderBoard(target, predictions, live, rowsFilter) {
  let preds = predictions;
  if (rowsFilter) {
    const set = new Set(rowsFilter);
    preds = predictions.filter(p => set.has(p.player_name));
  }

  if (preds.length === 0) {
    target.innerHTML = '<div class="empty">Nobody in here yet.</div>';
    return null;
  }

  const board = buildLeaderboard(preds, live);

  if (board.teamsRanked === 0) {
    target.innerHTML =
      '<div class="empty">The live table hasn\'t been set yet.<br>' +
      'Scores appear once the first gameweek is entered.</div>';
    return board;
  }

  const partial = board.teamsRanked < 20
    ? '<p class="hint" style="margin:0 0 12px">Only ' + board.teamsRanked +
      ' of 20 clubs are placed in the live table, so these scores are partial.</p>'
    : '';

  const rows = board.rows.map(r =>
    '<tr' + (r.rank === 1 ? ' class="leader"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="player">' + escapeHTML(r.player_name) + '</td>' +
      '<td><span class="strip">' + stripHTML(r.perTeam) + '</span></td>' +
      '<td class="score">' + r.total + '</td>' +
    '</tr>'
  ).join('');

  target.innerHTML = partial +
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>#</th><th>Player</th><th>Where they\'re off</th>' +
    '<th style="text-align:right">Points</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';

  return board;
}

/* Page bootstrap — only runs on leaderboard.html */
if (document.getElementById('board')) {
  (async function () {
    const target = document.getElementById('board');
    const locked = await isLocked();

    if (!locked) {
      target.innerHTML = '<div class="empty">Predictions are private until the season starts.</div>';
      return;
    }

    const { predictions, live, error } = await fetchBoardData();

    if (error) {
      target.innerHTML = '<div class="empty">Couldn\'t load the leaderboard: ' +
        escapeHTML(error.message) + '</div>';
      return;
    }

    const board = renderBoard(target, predictions, live, null);

    if (board && board.rows.length && board.teamsRanked > 0) {
      const totals = board.rows.map(r => r.total);
      document.getElementById('stat-players').textContent = board.rows.length;
      document.getElementById('stat-best').textContent = Math.min(...totals);
      document.getElementById('stat-spread').textContent =
        Math.min(...totals) + '–' + Math.max(...totals);
      document.getElementById('stats').hidden = false;
    }
  })();
}
