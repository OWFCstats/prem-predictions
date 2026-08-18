/* Predict page: rank 20 teams, submit once, locked forever after kickoff. */

let TEAMS = [];

const el = {
  loading:  document.getElementById('loading'),
  open:     document.getElementById('open-state'),
  locked:   document.getElementById('locked-state'),
  ranker:   document.getElementById('ranker'),
  name:     document.getElementById('player-name'),
  submit:   document.getElementById('submit-btn'),
  msg:      document.getElementById('form-msg'),
  lockNote: document.getElementById('lock-note'),
  mini:     document.getElementById('mini-board')
};

init();

async function init() {
  const lockTime = await getLockTime();
  const locked = lockTime ? Date.now() >= lockTime.getTime() : false;

  el.loading.hidden = true;

  if (locked) {
    el.locked.hidden = false;
    renderMiniBoard();
  } else {
    el.open.hidden = false;
    el.lockNote.textContent = lockTime
      ? 'Entries close ' + formatLockTime(lockTime) + '.'
      : '';
    TEAMS = await loadTeams();
    shuffle(TEAMS);
    renderRanker();
    el.submit.addEventListener('click', submit);
  }
}

/* Start in a random order so the alphabetical list doesn't nudge everyone
   into the same shape. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderRanker() {
  el.ranker.innerHTML = '';
  TEAMS.forEach((team, i) => {
    const li = document.createElement('li');
    li.className = 'team-row';
    li.dataset.code = team.code;
    li.tabIndex = 0;
    li.innerHTML =
      '<span class="pos"></span>' +
      '<span class="grip" aria-hidden="true">⠿</span>' +
      '<span class="name"></span>' +
      '<span class="nudge">' +
        '<button type="button" class="up" aria-label="Move up">▲</button>' +
        '<button type="button" class="down" aria-label="Move down">▼</button>' +
      '</span>';
    li.querySelector('.name').textContent = team.name;
    el.ranker.appendChild(li);
  });
  refreshPositions();
  wireDrag();
  wireNudge();
}

function refreshPositions() {
  [...el.ranker.children].forEach((li, i) => {
    li.querySelector('.pos').textContent = i + 1;
    li.removeAttribute('data-zone');
    if (i < 4) li.dataset.zone = 'euro';
    if (i > 16) li.dataset.zone = 'drop';
  });
}

/* Up/down buttons — the reliable path, and what keyboard users get. */
function wireNudge() {
  el.ranker.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const li = btn.closest('.team-row');
    if (btn.classList.contains('up') && li.previousElementSibling) {
      el.ranker.insertBefore(li, li.previousElementSibling);
    } else if (btn.classList.contains('down') && li.nextElementSibling) {
      el.ranker.insertBefore(li.nextElementSibling, li);
    }
    refreshPositions();
    li.querySelector(btn.classList.contains('up') ? '.up' : '.down').focus();
  });
}

/* Pointer-events drag: works with mouse and touch alike, unlike HTML5
   drag-and-drop which does nothing on phones. */
function wireDrag() {
  let dragEl = null;
  let startY = 0;
  let moved = false;

  el.ranker.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const li = e.target.closest('.team-row');
    if (!li) return;
    dragEl = li;
    startY = e.clientY;
    moved = false;
    li.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
  });

  el.ranker.addEventListener('pointermove', e => {
    if (!dragEl) return;
    if (Math.abs(e.clientY - startY) > 4) moved = true;
    if (!moved) return;
    e.preventDefault();

    const rows = [...el.ranker.children].filter(r => r !== dragEl);
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      if (e.clientY < mid && row.compareDocumentPosition(dragEl) & Node.DOCUMENT_POSITION_FOLLOWING) {
        el.ranker.insertBefore(dragEl, row);
        break;
      }
      if (e.clientY > mid && row.compareDocumentPosition(dragEl) & Node.DOCUMENT_POSITION_PRECEDING) {
        el.ranker.insertBefore(dragEl, row.nextElementSibling);
        break;
      }
    }
    refreshPositions();
  });

  const end = () => {
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    dragEl = null;
    refreshPositions();
  };

  el.ranker.addEventListener('pointerup', end);
  el.ranker.addEventListener('pointercancel', end);
}

function currentOrder() {
  return [...el.ranker.children].map(li => li.dataset.code);
}

async function submit() {
  hideMsg(el.msg);
  const name = el.name.value.trim();

  if (!name) {
    showMsg(el.msg, 'Add your name before locking in.', 'error');
    el.name.focus();
    return;
  }

  const order = currentOrder();
  if (order.length !== 20) {
    showMsg(el.msg, 'Something went wrong building your table — reload and try again.', 'error');
    return;
  }

  if (!confirm('Lock in this table for ' + name + '?\n\nYou can\'t change it afterwards.')) return;

  el.submit.disabled = true;
  el.submit.textContent = 'Locking in…';

  const { error } = await db
    .from('predictions')
    .insert({ player_name: name, predicted_order: order });

  if (error) {
    el.submit.disabled = false;
    el.submit.textContent = 'Lock in my table';

    if (error.code === '23505') {
      showMsg(el.msg, '"' + name + '" has already entered. Use a different name, or check the leaderboard if that was you.', 'error');
    } else if (error.code === '42501') {
      showMsg(el.msg, 'Entries have closed — the season has already started.', 'error');
    } else {
      showMsg(el.msg, 'Couldn\'t save that: ' + error.message, 'error');
    }
    return;
  }

  el.open.innerHTML =
    '<h1>You\'re in</h1>' +
    '<p class="lede">Table locked for <strong>' + escapeHTML(name) + '</strong>. ' +
    'Scores start moving once the first results are in.</p>' +
    '<p><a href="leaderboard.html"><button class="primary">Go to the leaderboard</button></a></p>';
  window.scrollTo(0, 0);
}

async function renderMiniBoard() {
  const locked = await isLocked();
  if (!locked) {
    el.mini.innerHTML = '<div class="empty">Predictions are private until the season starts.</div>';
    return;
  }

  const [preds, live] = await Promise.all([
    db.from('predictions').select('player_name, predicted_order'),
    db.from('live_table').select('team_code, position')
  ]);

  if (preds.error || !preds.data || preds.data.length === 0) {
    el.mini.innerHTML = '<div class="empty">No predictions were entered.</div>';
    return;
  }

  const board = buildLeaderboard(preds.data, live.data || []);

  if (board.teamsRanked === 0) {
    el.mini.innerHTML = '<div class="empty">The live table hasn\'t been set yet — scores start after the first gameweek.</div>';
    return;
  }

  const rows = board.rows.slice(0, 5).map(r =>
    '<tr' + (r.rank === 1 ? ' class="leader"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="player">' + escapeHTML(r.player_name) + '</td>' +
      '<td class="score">' + r.total + '</td>' +
    '</tr>'
  ).join('');

  el.mini.innerHTML =
    '<div class="card"><div class="table-wrap"><table>' +
    '<thead><tr><th>#</th><th>Player</th><th style="text-align:right">Points</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div></div>';
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
