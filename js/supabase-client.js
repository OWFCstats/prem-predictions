/* Shared Supabase client + small helpers used by every page.
   Loaded after config.js and the supabase-js CDN bundle. */

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Fallback team list. The teams table in Supabase is the real source of
   truth; this is only used if that fetch fails, so the predict form still
   works rather than showing a blank page. */
const FALLBACK_TEAMS = [
  { code: 'AFC', name: 'AFC Bournemouth' },
  { code: 'ARS', name: 'Arsenal' },
  { code: 'AVL', name: 'Aston Villa' },
  { code: 'BRE', name: 'Brentford' },
  { code: 'BHA', name: 'Brighton' },
  { code: 'CHE', name: 'Chelsea' },
  { code: 'COV', name: 'Coventry' },
  { code: 'CRY', name: 'Crystal Palace' },
  { code: 'EVE', name: 'Everton' },
  { code: 'FUL', name: 'Fulham' },
  { code: 'HUL', name: 'Hull' },
  { code: 'IPS', name: 'Ipswich' },
  { code: 'LEE', name: 'Leeds' },
  { code: 'LIV', name: 'Liverpool' },
  { code: 'MCI', name: 'Manchester City' },
  { code: 'MUN', name: 'Manchester United' },
  { code: 'NEW', name: 'Newcastle' },
  { code: 'NFO', name: 'Nottingham Forest' },
  { code: 'SUN', name: 'Sunderland' },
  { code: 'TOT', name: 'Tottenham' }
];

async function loadTeams() {
  const { data, error } = await db.from('teams').select('code, name').order('name');
  if (error || !data || data.length === 0) return FALLBACK_TEAMS.slice();
  return data;
}

let _lockTimeCache = null;

async function getLockTime() {
  if (_lockTimeCache) return _lockTimeCache;
  const { data, error } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'season_lock_at')
    .single();
  if (error || !data) return null;
  _lockTimeCache = new Date(data.value);
  return _lockTimeCache;
}

async function isLocked() {
  const lock = await getLockTime();
  if (!lock) return false;
  return Date.now() >= lock.getTime();
}

function formatLockTime(date) {
  if (!date) return 'the start of the season';
  return date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showMsg(el, text, kind) {
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (kind || 'info');
  el.hidden = false;
}

function hideMsg(el) {
  if (el) el.hidden = true;
}

/* Marks the current page in the nav. */
function markNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(a => {
    if (a.getAttribute('href') === here) a.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', markNav);
