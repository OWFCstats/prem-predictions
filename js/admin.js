/* Admin: sign in, set the live table, record each gameweek.
   The real guard is the RLS policy in supabase/schema.sql — hiding this
   view is only a convenience, the database rejects unauthenticated writes. */

const A = {
  loginView:  document.getElementById('login-view'),
  adminView:  document.getElementById('admin-view'),
  email:      document.getElementById('email'),
  password:   document.getElementById('password'),
  loginBtn:   document.getElementById('login-btn'),
  loginMsg:   document.getElementById('login-msg'),
  adminMsg:   document.getElementById('admin-msg'),
  ranker:     document.getElementById('live-ranker'),
  saveBtn:    document.getElementById('save-table-btn'),
  reloadBtn:  document.getElementById('reload-btn'),
  gameweek:   document.getElementById('gameweek'),
  snapBtn:    document.getElementById('snapshot-btn'),
  snapOut:    document.getElementById('snapshot-preview'),
  logoutBtn:  document.getElementById('logout-btn')
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

A.loginBtn.addEventListener('click', signIn);
A.password.addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
A.saveBtn.addEventListener('click', saveLiveTable);
A.reloadBtn.addEventListener('click', loadLiveTable);
A.snapBtn.addEventListener('click', saveSnapshot);
A.logoutBtn.addEventListener('click', signOut);

checkSession();

async function checkSession() {
  const { data } = await db.auth.getSession();
  if (data.session) enterAdmin();
  else A.loginView.hidden = false;
}

async function signIn() {
  hideMsg(A.loginMsg);
  const email = A.email.value.trim();
  const password = A.password.value;

  if (!email || !password) {
    showMsg(A.loginMsg, 'Enter your email and password.', 'error');
    return;
  }

  A.loginBtn.disabled = true;
  const { error } = await db.auth.signInWithPassword({ email, password });
  A.loginBtn.disabled = false;

  if (error) {
    showMsg(A.loginMsg, 'That didn\'t work: ' + error.message, 'error');
    return;
  }

  A.loginView.hidden = true;
  enterAdmin();
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

function enterAdmin() {
  A.loginView.hidden = true;
  A.adminView.hidden = false;
  loadLiveTable();
}

/* ---------- Live table ---------- */

async function loadLiveTable() {
  hideMsg(A.adminMsg);
  A.ranker.innerHTML = '<li class="empty">Loading…</li>';

  const teams = await loadTeams();
  const { data: live } = await db.from('live_table').select('team_code, position');

  const posByCode = new Map();
  (live || []).forEach(r => {
    if (r.position !== null) posByCode.set(r.team_code, r.position);
  });

  /* Teams already placed come first in their saved order; anything unplaced
     falls in behind, alphabetically. */
  const placed = teams
    .filter(t => posByCode.has(t.code))
    .sort((a, b) => posByCode.get(a.code) - posByCode.get(b.code));
  const unplaced = teams
    .filter(t => !posByCode.has(t.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ordered = placed.concat(unplaced);

  A.ranker.innerHTML = '';
  ordered.forEach(team => {
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
    A.ranker.appendChild(li);
  });

  refreshPos();
  wireNudge();
  wireDrag();
}

function refreshPos() {
  [...A.ranker.children].forEach((li, i) => {
    const p = li.querySelector('.pos');
    if (p) p.textContent = i + 1;
    li.removeAttribute('data-zone');
    if (i < 4) li.dataset.zone = 'euro';
    if (i > 16) li.dataset.zone = 'drop';
  });
}

function wireNudge() {
  A.ranker.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const li = btn.closest('.team-row');
    if (btn.classList.contains('up') && li.previousElementSibling) {
      A.ranker.insertBefore(li, li.previousElementSibling);
    } else if (btn.classList.contains('down') && li.nextElementSibling) {
      A.ranker.insertBefore(li.nextElementSibling, li);
    }
    refreshPos();
  });
}

function wireDrag() {
  let dragEl = null, startY = 0, moved = false;

  A.ranker.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const li = e.target.closest('.team-row');
    if (!li) return;
    dragEl = li; startY = e.clientY; moved = false;
    li.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
  });

  A.ranker.addEventListener('pointermove', e => {
    if (!dragEl) return;
    if (Math.abs(e.clientY - startY) > 4) moved = true;
    if (!moved) return;
    e.preventDefault();
    const rows = [...A.ranker.children].filter(r => r !== dragEl);
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      if (e.clientY < mid && row.compareDocumentPosition(dragEl) & Node.DOCUMENT_POSITION_FOLLOWING) {
        A.ranker.insertBefore(dragEl, row); break;
      }
      if (e.clientY > mid && row.compareDocumentPosition(dragEl) & Node.DOCUMENT_POSITION_PRECEDING) {
        A.ranker.insertBefore(dragEl, row.nextElementSibling); break;
      }
    }
    refreshPos();
  });

  const end = () => {
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    dragEl = null;
    refreshPos();
  };
  A.ranker.addEventListener('pointerup', end);
  A.ranker.addEventListener('pointercancel', end);
}

/* Reads whatever order is currently on screen and upserts it to live_table.
   Shared by the two save actions so the snapshot can never drift from what
   the ranker last showed. */
async function persistLiveTable() {
  const rows = [...A.ranker.children].map((li, i) => ({
    team_code: li.dataset.code,
    position: i + 1
  }));

  if (rows.length !== 20) {
    return { error: { message: 'Expected 20 clubs but found ' + rows.length +
      '. Check the teams table is seeded.' } };
  }

  const { error } = await db.from('live_table').upsert(rows, { onConflict: 'team_code' });
  return { error, rows };
}

async function saveLiveTable() {
  hideMsg(A.adminMsg);
  A.saveBtn.disabled = true;
  A.saveBtn.textContent = 'Saving…';

  const { error } = await persistLiveTable();

  A.saveBtn.disabled = false;
  A.saveBtn.textContent = 'Save live table';

  if (error) {
    showMsg(A.adminMsg, 'Couldn\'t save: ' + error.message, 'error');
    return;
  }
  showMsg(A.adminMsg, 'Live table saved. Scores on the leaderboard have moved.', 'success');
}

/* ---------- Weekly snapshot ---------- */

async function saveSnapshot() {
  hideMsg(A.adminMsg);
  const gw = parseInt(A.gameweek.value, 10);

  if (!gw || gw < 1 || gw > 38) {
    showMsg(A.adminMsg, 'Pick a gameweek between 1 and 38.', 'error');
    return;
  }

  /* Always persist the on-screen order first, so recording a week can never
     leave live_table (and the next page load) out of sync with the ranker. */
  const { error: liveError, rows: liveRows } = await persistLiveTable();
  if (liveError) {
    showMsg(A.adminMsg, 'Couldn\'t save the live table: ' + liveError.message, 'error');
    return;
  }

  const preds = await db.from('predictions').select('player_name, predicted_order');

  if (!preds.data || preds.data.length === 0) {
    showMsg(A.adminMsg, 'No predictions to score yet.', 'error');
    return;
  }

  const board = buildLeaderboard(preds.data, liveRows);

  if (!confirm('Save gameweek ' + gw + ' scores for ' + board.rows.length + ' players?')) return;

  A.snapBtn.disabled = true;
  A.snapBtn.textContent = 'Saving…';

  const rows = board.rows.map(r => ({
    gameweek: gw,
    player_name: r.player_name,
    total_points: r.total
  }));

  const { error } = await db
    .from('gameweek_snapshots')
    .upsert(rows, { onConflict: 'gameweek,player_name' });

  A.snapBtn.disabled = false;
  A.snapBtn.textContent = 'Save this week\'s scores';

  if (error) {
    showMsg(A.adminMsg, 'Couldn\'t save the week: ' + error.message, 'error');
    return;
  }

  showMsg(A.adminMsg, 'Gameweek ' + gw + ' recorded.', 'success');

  A.snapOut.innerHTML =
    '<div class="table-wrap"><table><thead><tr><th>#</th><th>Player</th>' +
    '<th style="text-align:right">GW' + gw + '</th></tr></thead><tbody>' +
    board.rows.map(r =>
      '<tr><td class="rank">' + r.rank + '</td><td class="player">' +
      esc(r.player_name) + '</td><td class="score">' + r.total + '</td></tr>'
    ).join('') +
    '</tbody></table></div>';

  A.gameweek.value = Math.min(38, gw + 1);
}
