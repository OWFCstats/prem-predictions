/* Mini leagues: create one, add players who've entered, view a filtered board. */

const L = {
  listView:   document.getElementById('list-view'),
  leagueView: document.getElementById('league-view'),
  list:       document.getElementById('league-list'),
  listMsg:    document.getElementById('list-msg'),
  newName:    document.getElementById('new-league'),
  creator:    document.getElementById('creator'),
  createBtn:  document.getElementById('create-btn'),
  backBtn:    document.getElementById('back-btn'),
  title:      document.getElementById('league-title'),
  sub:        document.getElementById('league-sub'),
  board:      document.getElementById('league-board'),
  leagueMsg:  document.getElementById('league-msg'),
  addSelect:  document.getElementById('add-player'),
  addBtn:     document.getElementById('add-btn')
};

let allPlayers = [];
let currentLeague = null;

L.createBtn.addEventListener('click', createLeague);
L.backBtn.addEventListener('click', () => {
  location.hash = '';
  showList();
});
L.addBtn.addEventListener('click', addMember);
window.addEventListener('hashchange', route);

start();

async function start() {
  const { data } = await db.from('predictions').select('player_name').order('player_name');
  allPlayers = (data || []).map(r => r.player_name);
  route();
}

function route() {
  const id = location.hash.replace('#', '');
  if (id) openLeague(id);
  else showList();
}

async function showList() {
  L.leagueView.hidden = true;
  L.listView.hidden = false;
  hideMsg(L.listMsg);

  const { data, error } = await db
    .from('leagues')
    .select('id, name, created_by')
    .order('created_at');

  if (error) {
    L.list.innerHTML = '<li class="empty">Couldn\'t load leagues.</li>';
    return;
  }

  if (!data || data.length === 0) {
    L.list.innerHTML = '<li class="empty">No leagues yet. Start the first one.</li>';
    return;
  }

  L.list.innerHTML = data.map(lg =>
    '<li><span><strong>' + escapeHTML(lg.name) + '</strong><br>' +
    '<span class="hint">Started by ' + escapeHTML(lg.created_by) + '</span></span>' +
    '<button class="ghost small" data-id="' + lg.id + '">Open</button></li>'
  ).join('');

  L.list.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', () => { location.hash = b.dataset.id; });
  });
}

async function createLeague() {
  hideMsg(L.listMsg);
  const name = L.newName.value.trim();
  const who = L.creator.value.trim();

  if (!name) { showMsg(L.listMsg, 'Give the league a name.', 'error'); return; }
  if (!who)  { showMsg(L.listMsg, 'Add your name so people know whose league it is.', 'error'); return; }

  L.createBtn.disabled = true;

  const { data, error } = await db
    .from('leagues')
    .insert({ name: name, created_by: who })
    .select()
    .single();

  L.createBtn.disabled = false;

  if (error) {
    showMsg(L.listMsg, 'Couldn\'t create that league: ' + error.message, 'error');
    return;
  }

  /* Creator joins their own league if they've entered a prediction. */
  if (allPlayers.includes(who)) {
    await db.from('league_members').insert({ league_id: data.id, player_name: who });
  }

  L.newName.value = '';
  location.hash = data.id;
}

async function openLeague(id) {
  L.listView.hidden = true;
  L.leagueView.hidden = false;
  hideMsg(L.leagueMsg);
  L.board.innerHTML = '<div class="empty">Loading…</div>';

  const { data: lg, error } = await db
    .from('leagues')
    .select('id, name, created_by')
    .eq('id', id)
    .single();

  if (error || !lg) {
    L.title.textContent = 'League not found';
    L.sub.textContent = 'That league doesn\'t exist any more.';
    L.board.innerHTML = '';
    return;
  }

  currentLeague = lg;
  L.title.textContent = lg.name;

  const { data: members } = await db
    .from('league_members')
    .select('player_name')
    .eq('league_id', id);

  const names = (members || []).map(m => m.player_name);
  L.sub.textContent = names.length === 1
    ? 'Started by ' + lg.created_by + ' · 1 player'
    : 'Started by ' + lg.created_by + ' · ' + names.length + ' players';

  const { predictions, live } = await fetchBoardData();
  renderBoard(L.board, predictions, live, names);

  const available = allPlayers.filter(p => !names.includes(p));
  L.addSelect.innerHTML = available.length
    ? available.map(p => '<option>' + escapeHTML(p) + '</option>').join('')
    : '<option value="">Everyone who entered is already in</option>';
  L.addBtn.disabled = available.length === 0;
}

async function addMember() {
  hideMsg(L.leagueMsg);
  const player = L.addSelect.value;
  if (!player || !currentLeague) return;

  L.addBtn.disabled = true;
  const { error } = await db
    .from('league_members')
    .insert({ league_id: currentLeague.id, player_name: player });
  L.addBtn.disabled = false;

  if (error) {
    showMsg(L.leagueMsg, 'Couldn\'t add them: ' + error.message, 'error');
    return;
  }

  openLeague(currentLeague.id);
}
