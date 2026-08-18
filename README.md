# Prem Predictor 26/27

A prediction league for the 2026/27 Premier League season. Everyone ranks all
20 clubs before kickoff, then scores the distance between their guess and the
real table each week. **Lowest score wins.**

Built as plain HTML, CSS and JavaScript — no build step, no framework, no
server to run. Supabase holds the data. GitHub Pages serves the site.

## Scoring

For each club: `points = |your predicted position − actual position|`.
Add up all 20. A perfect table is 0.

Predict Arsenal 1st and they're 1st → 0 points. Predict Chelsea 3rd and
they're 10th → 7 points.

This is a direct port of the formula from the original spreadsheet, and it's
been checked against that sheet's real 25/26 numbers — all seven players'
totals reproduce exactly.

## Setup

### 1. Supabase

1. Create a free project at supabase.com.
2. **SQL Editor** → paste and run `supabase/schema.sql`.
   Check the `season_lock_at` value near the top first — that's the moment
   predictions close. Set it to the actual first kickoff.
3. **SQL Editor** → paste and run `supabase/seed_teams.sql`. It should
   report 20 teams.
4. **Project Settings → API** → copy the Project URL and the `anon public`
   key into `config.js`. Never put the `service_role` key in there — it
   bypasses every security rule on this list.
5. **Authentication → Users → Add user** → create one account with your own
   email and password. That's the admin login. There's no signup flow on the
   site by design.

### 2. GitHub Pages

Push these files to a repo, then **Settings → Pages** → deploy from `main`,
root folder. The site is live a minute later.

### 3. Run it locally

No build step. Either open `index.html` directly, or from the project folder:

```
python3 -m http.server
```

then visit `http://localhost:8000`.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Prediction form before the lock; leaderboard after |
| `leaderboard.html` | Everyone, scored against the live table |
| `progress.html` | Line chart of every player's score by gameweek |
| `leagues.html` | Create mini leagues and filter the board to them |
| `admin.html` | Your login: update the live table, record each week |

## Your weekly routine

1. Open `admin.html`, sign in.
2. Drag the live table to match the real one. **Save live table.**
   The leaderboard updates immediately.
3. Set the gameweek number, hit **Save this week's scores.** That's what
   draws the progress chart — without it the chart stays empty, because the
   live table gets overwritten each week and old states aren't recoverable
   otherwise.

Re-saving the same gameweek overwrites it, so a mistake is fixable.

## How the lock works

`season_lock_at` in the `app_config` table is the single cutoff. Before it,
anyone can submit one prediction. After it, the form disappears — and more
importantly, the database itself refuses new predictions, because the
row-level security policy checks the timestamp on insert.

There is deliberately **no update or delete policy** on the predictions
table. Nobody can edit a submitted prediction through the site, including
you. That's the "cannot be changed once locked in" rule from the original
spreadsheet, enforced properly rather than on the honour system. If you ever
genuinely need to fix one, do it from the Supabase dashboard.

The anon key in `config.js` is meant to be public — it's in the page source
of every static site like this. What protects the data is the RLS policies in
`schema.sql`, which is why every table has them switched on.

## Not included

The original spreadsheet had a side-game predicting exact scorelines for a
handful of fixtures. It wasn't part of this build. Adding it later would mean
one more table, a form, and a toggle on the admin page.
