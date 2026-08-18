/* Progress chart, built from the gameweek_snapshots the admin saves. */

const LINE_COLOURS = [
  '#FFB020', '#17A673', '#D6455D', '#4C6FFF', '#9B51E0',
  '#F2994A', '#00B8D9', '#EB5757', '#6FCF97', '#2D9CDB',
  '#BB6BD9', '#F2C94C'
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

(async function () {
  const tableOut = document.getElementById('table-out');
  const emptyBox = document.getElementById('chart-empty');
  const canvas = document.getElementById('chart');

  const { data, error } = await db
    .from('gameweek_snapshots')
    .select('gameweek, player_name, total_points')
    .order('gameweek');

  if (error) {
    tableOut.innerHTML = '<div class="empty">Couldn\'t load progress: ' +
      esc(error.message) + '</div>';
    canvas.hidden = true;
    emptyBox.hidden = false;
    return;
  }

  if (!data || data.length === 0) {
    canvas.hidden = true;
    emptyBox.hidden = false;
    tableOut.innerHTML = '<div class="empty">Nothing recorded yet.</div>';
    return;
  }

  const weeks = [...new Set(data.map(r => r.gameweek))].sort((a, b) => a - b);
  const players = [...new Set(data.map(r => r.player_name))].sort();

  /* player -> gameweek -> points */
  const lookup = new Map();
  data.forEach(r => {
    if (!lookup.has(r.player_name)) lookup.set(r.player_name, new Map());
    lookup.get(r.player_name).set(r.gameweek, r.total_points);
  });

  /* Table first, so a blocked or failed CDN can't take the whole page with
     it — the numbers are the point, the chart is the nice-to-have. */
  const head = '<tr><th>Player</th>' +
    weeks.slice().reverse().map(w => '<th style="text-align:right">GW' + w + '</th>').join('') +
    '</tr>';

  const body = players.map(name => {
    const cells = weeks.slice().reverse().map(w => {
      const v = lookup.get(name).get(w);
      return '<td style="text-align:right">' + (v === undefined ? '–' : v) + '</td>';
    }).join('');
    return '<tr><td class="player">' + esc(name) + '</td>' + cells + '</tr>';
  }).join('');

  tableOut.innerHTML = '<div class="table-wrap"><table><thead>' + head +
    '</thead><tbody>' + body + '</tbody></table></div>';

  if (typeof Chart === 'undefined') {
    canvas.hidden = true;
    emptyBox.textContent = 'The chart library didn\'t load, so the graph is unavailable. The week-by-week numbers below are unaffected.';
    emptyBox.hidden = false;
    return;
  }

  const datasets = players.map((name, i) => ({
    label: name,
    data: weeks.map(w => {
      const v = lookup.get(name).get(w);
      return v === undefined ? null : v;
    }),
    borderColor: LINE_COLOURS[i % LINE_COLOURS.length],
    backgroundColor: LINE_COLOURS[i % LINE_COLOURS.length],
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 5,
    tension: 0.25,
    spanGaps: true
  }));

  new Chart(canvas, {
    type: 'line',
    data: { labels: weeks.map(w => 'GW' + w), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: c => c.dataset.label + ': ' + c.parsed.y + ' pts'
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Points (lower is better)' },
          grid: { color: '#E3E3ED' }
        },
        x: { grid: { display: false } }
      }
    }
  });

})();
