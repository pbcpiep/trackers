(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'trackers:v1';
  const THEME_KEY = 'trackers:theme';

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
  const today = () => toISO(new Date());
  const weekStart = (s) => { const d = parseISO(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); };
  const fmtDate = (s, o) => parseISO(s).toLocaleDateString(undefined, o);
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'red', 'brown', 'gray'];
  const EMOJI = ['✅', '📚', '📖', '🏃', '💪', '🏋️', '🚴', '🧘', '💧', '🍎', '🥗', '☕', '😴', '🌙', '☀️', '📝',
    '✍️', '🎯', '💰', '📈', '🎸', '🎨', '🎧', '🎬', '🌱', '🌿', '❤️', '🧠', '🙏', '💊', '🦷', '🧹',
    '🏠', '✈️', '🗓️', '⭐', '🔥', '📵', '🚭', '🎮'];
  const PROP_TYPES = {
    text: { label: 'Text', icon: 'Aa' },
    number: { label: 'Number', icon: '#' },
    select: { label: 'Select', icon: '▾' },
    checkbox: { label: 'Checkbox', icon: '☑' },
    date: { label: 'Date', icon: '◷' },
    rating: { label: 'Rating', icon: '★' },
    url: { label: 'URL', icon: '↗' },
  };

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------
  const opt = (name, color) => ({ id: uid(), name, color });
  const prop = (name, type, options) => (type === 'select' ? { id: uid(), name, type, options: options || [] } : { id: uid(), name, type });

  function database(name, icon, properties, samples = []) {
    const t = { id: uid(), kind: 'database', name, icon, properties, rows: [], view: { mode: 'table', sort: null, query: '', groupBy: null } };
    for (const s of samples) {
      const values = {};
      for (const p of properties) {
        let v = s[p.name];
        if (v === undefined) continue;
        if (p.type === 'select') v = (p.options.find((o) => o.name === v) || {}).id || null;
        values[p.id] = v;
      }
      t.rows.push({ id: uid(), values, createdAt: Date.now() });
    }
    return t;
  }

  function habitTracker(name, icon, habits) {
    return {
      id: uid(), kind: 'habit', name, icon,
      habits: habits.map(([hName, hIcon, color, target]) => ({ id: uid(), name: hName, icon: hIcon, color, target: target || 7 })),
      log: {},
      view: { mode: 'week' },
    };
  }

  const TEMPLATES = {
    habits: {
      name: 'Daily Habits', icon: '✅', desc: 'Check off habits each day, hit weekly goals and build streaks.',
      make: () => habitTracker('Daily Habits', '✅', [
        ['Drink 8 glasses of water', '💧', 'blue', 7],
        ['Exercise', '🏃', 'green', 5],
        ['Read 20 minutes', '📖', 'orange', 7],
        ['Meditate', '🧘', 'purple', 7],
        ['In bed by 11pm', '😴', 'pink', 7],
      ]),
    },
    reading: {
      name: 'Reading List', icon: '📚', desc: 'Books to read, in progress and finished — with ratings.',
      make: (samples) => database('Reading List', '📚', [
        prop('Title', 'text'), prop('Author', 'text'),
        prop('Status', 'select', [opt('To read', 'gray'), opt('Reading', 'blue'), opt('Finished', 'green')]),
        prop('Rating', 'rating'), prop('Finished on', 'date'),
      ], samples ? [
        { Title: 'Atomic Habits', Author: 'James Clear', Status: 'Reading' },
        { Title: 'Deep Work', Author: 'Cal Newport', Status: 'To read' },
      ] : []),
    },
    workouts: {
      name: 'Workouts', icon: '💪', desc: 'Log each session: type, duration and how it felt.',
      make: (samples) => database('Workouts', '💪', [
        prop('Workout', 'text'), prop('Date', 'date'),
        prop('Type', 'select', [opt('Run', 'green'), opt('Strength', 'orange'), opt('Yoga', 'purple'), opt('Bike', 'blue'), opt('Walk', 'yellow')]),
        prop('Minutes', 'number'), prop('Effort', 'rating'), prop('Notes', 'text'),
      ], samples ? [{ Workout: 'Morning run', Date: today(), Type: 'Run', Minutes: 30, Effort: 3 }] : []),
    },
    mood: {
      name: 'Mood Journal', icon: '🌙', desc: 'A daily check-in: mood, energy, sleep and a short note.',
      make: () => database('Mood Journal', '🌙', [
        prop('Entry', 'text'), prop('Date', 'date'),
        prop('Mood', 'select', [opt('😀 Great', 'green'), opt('🙂 Good', 'blue'), opt('😐 Okay', 'yellow'), opt('🙁 Low', 'orange'), opt('😞 Rough', 'red')]),
        prop('Energy', 'rating'), prop('Hours slept', 'number'), prop('Grateful for', 'text'),
      ]),
    },
    goals: {
      name: 'Goals', icon: '🎯', desc: 'Bigger goals by life area, with status and target dates.',
      make: () => database('Goals', '🎯', [
        prop('Goal', 'text'),
        prop('Area', 'select', [opt('Health', 'green'), opt('Career', 'blue'), opt('Money', 'yellow'), opt('Relationships', 'pink'), opt('Learning', 'purple')]),
        prop('Status', 'select', [opt('Not started', 'gray'), opt('In progress', 'blue'), opt('Done', 'green')]),
        prop('Target date', 'date'), prop('Done', 'checkbox'),
      ]),
    },
    finance: {
      name: 'Spending', icon: '💰', desc: 'Track expenses by category and see the running total.',
      make: () => database('Spending', '💰', [
        prop('Item', 'text'), prop('Date', 'date'), prop('Amount', 'number'),
        prop('Category', 'select', [opt('Groceries', 'green'), opt('Eating out', 'orange'), opt('Transport', 'blue'), opt('Bills', 'red'), opt('Fun', 'purple'), opt('Other', 'gray')]),
        prop('Notes', 'text'),
      ]),
    },
    blankHabits: { name: 'Empty habit tracker', icon: '🔥', desc: 'Start with no habits and add your own.', make: () => habitTracker('New habits', '🔥', []) },
    blank: { name: 'Empty database', icon: '📝', desc: 'A blank table. Add whatever columns you need.', make: () => database('Untitled', '📝', [prop('Name', 'text'), prop('Tags', 'select', []), prop('Date', 'date')]) },
  };

  // ---------------------------------------------------------------------------
  // State & persistence
  // ---------------------------------------------------------------------------
  let storageOK = true;
  try { localStorage.setItem('trackers:test', '1'); localStorage.removeItem('trackers:test'); } catch (e) { storageOK = false; }

  function normalize(data) {
    for (const t of data.trackers) {
      t.id = t.id || uid();
      t.icon = t.icon || '📝';
      t.view = t.view || {};
      if (t.kind === 'habit') { t.habits = t.habits || []; t.log = t.log || {}; t.view.mode = t.view.mode || 'week'; }
      else { t.kind = 'database'; t.properties = t.properties || [prop('Name', 'text')]; t.rows = t.rows || []; t.view.mode = t.view.mode || 'table'; }
    }
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.trackers)) return normalize(d); }
    } catch (e) { /* fall through to defaults */ }
    return { version: 1, trackers: [TEMPLATES.habits.make(), TEMPLATES.reading.make(true), TEMPLATES.workouts.make(true), TEMPLATES.goals.make()] };
  }

  let state = load();
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { storageOK = false; }
  }

  const ui = { page: 'home', weekOffset: 0 };
  const cur = () => state.trackers.find((t) => t.id === ui.page);
  const findTracker = (id) => state.trackers.find((t) => t.id === id);

  // ---------------------------------------------------------------------------
  // Habit stats
  // ---------------------------------------------------------------------------
  function streak(log = {}) {
    let d = log[today()] ? today() : addDays(today(), -1);
    let n = 0;
    while (log[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak(log = {}) {
    let best = 0, run = 0, prev = null;
    for (const d of Object.keys(log).filter((k) => log[k]).sort()) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }
  function rate(log = {}, days = 30) {
    let c = 0;
    for (let i = 0; i < days; i++) if (log[addDays(today(), -i)]) c++;
    return Math.round((c / days) * 100);
  }
  function toggleHabit(t, habitId, date) {
    if (date > today()) return;
    const log = (t.log[habitId] = t.log[habitId] || {});
    if (log[date]) delete log[date]; else log[date] = true;
  }

  // ---------------------------------------------------------------------------
  // Database helpers
  // ---------------------------------------------------------------------------
  function displayValue(p, v) {
    if (v == null || v === '') return '';
    if (p.type === 'select') return (p.options.find((o) => o.id === v) || {}).name || '';
    if (p.type === 'checkbox') return v ? '✓' : '';
    if (p.type === 'rating') return '★'.repeat(v);
    return String(v);
  }

  function compare(p, a, b) {
    const empty = (v) => v == null || v === '' || (p.type === 'select' && !p.options.some((o) => o.id === v));
    if (empty(a) && empty(b)) return 0;
    if (empty(a)) return 1;
    if (empty(b)) return -1;
    if (p.type === 'number' || p.type === 'rating') return a - b;
    if (p.type === 'checkbox') return (a ? 1 : 0) - (b ? 1 : 0);
    if (p.type === 'select') return p.options.findIndex((o) => o.id === a) - p.options.findIndex((o) => o.id === b);
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function visibleRows(t) {
    const q = (t.view.query || '').trim().toLowerCase();
    let rows = t.rows;
    if (q) rows = rows.filter((r) => t.properties.some((p) => displayValue(p, r.values[p.id]).toLowerCase().includes(q)));
    const s = t.view.sort;
    const sp = s && t.properties.find((p) => p.id === s.prop);
    if (sp) {
      rows = [...rows].sort((a, b) => {
        const va = a.values[sp.id], vb = b.values[sp.id];
        const c = compare(sp, va, vb);
        const isEmpty = (v) => v == null || v === '';
        if (isEmpty(va) || isEmpty(vb)) return c; // empties always last
        return s.dir === 'desc' ? -c : c;
      });
    }
    return rows;
  }

  function convertValue(v, from, to, newProp) {
    if (v == null || v === '') return null;
    const text = displayValue(from, v);
    switch (to.type) {
      case 'text': case 'url': return from.type === 'checkbox' ? (v ? 'Yes' : '') : text;
      case 'number': { const n = parseFloat(from.type === 'rating' ? v : text); return Number.isFinite(n) ? n : null; }
      case 'checkbox': return Boolean(v);
      case 'rating': { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; }
      case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
      case 'select': {
        if (!text) return null;
        let o = newProp.options.find((x) => x.name === text);
        if (!o) { o = opt(text, COLORS[newProp.options.length % COLORS.length]); newProp.options.push(o); }
        return o.id;
      }
      default: return null;
    }
  }

  function addRow(t, preset = {}) {
    const row = { id: uid(), values: { ...preset }, createdAt: Date.now() };
    t.rows.push(row);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const appEl = document.getElementById('app');
  const sidebarEl = document.getElementById('sidebar');
  const pageEl = document.getElementById('page');
  const bannerEl = document.getElementById('banner');
  const mobileTitleEl = document.getElementById('mobile-title');

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; render(); }, 0);
  }
  function commit(deferred) { save(); if (deferred) scheduleRender(); else render(); }

  // Stable identity for a focusable element, so focus survives a re-render.
  const FOCUS_ATTRS = ['action', 'tracker', 'habit', 'date', 'row', 'prop', 'val', 'view', 'delta', 'template'];
  function focusKey(el) {
    if (!el || !el.dataset) return null;
    if (el.dataset.key) return el.dataset.key;
    return el.dataset.action ? FOCUS_ATTRS.map((k) => el.dataset[k] || '').join('|') : null;
  }
  function findByFocusKey(key) {
    const direct = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (direct) return direct;
    return [...document.querySelectorAll('[data-action]')].find((el) => focusKey(el) === key) || null;
  }

  function render() {
    // Remember focus so re-rendering doesn't kick the user out of an input.
    const a = document.activeElement;
    const key = a && a !== document.body ? focusKey(a) : null;
    let sel = null;
    try { if (key && typeof a.selectionStart === 'number') sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* not a text input */ }

    const t = cur();
    if (!t) ui.page = 'home';
    renderSidebar();
    pageEl.innerHTML = t ? (t.kind === 'habit' ? habitPage(t) : dbPage(t)) : homePage();
    mobileTitleEl.textContent = t ? `${t.icon} ${t.name || 'Untitled'}` : 'Home';
    document.title = t ? `${t.name || 'Untitled'} · My Trackers` : 'My Trackers';
    bannerEl.innerHTML = storageOK ? '' : '<div class="banner">⚠️ Browser storage is unavailable, so changes won’t be saved. Use Export to keep a copy.</div>';
    if (modalState && modalState.live) drawModal();

    if (key) {
      const el = findByFocusKey(key);
      if (el && el !== document.activeElement) {
        el.focus({ preventScroll: true });
        if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ }
      }
    }
  }

  function renderSidebar() {
    sidebarEl.innerHTML = `
      <div class="sb-head">
        <span class="sb-logo">✅</span><span class="sb-title">My Trackers</span>
        <button class="icon-btn sb-close" data-action="close-sidebar" aria-label="Close menu">✕</button>
      </div>
      <nav class="sb-nav">
        <a class="sb-item ${ui.page === 'home' ? 'active' : ''}" href="#/"><span class="sb-icon">🏠</span><span class="sb-label">Home</span></a>
        <div class="sb-section">Trackers</div>
        ${state.trackers.map((t) => `
          <a class="sb-item ${ui.page === t.id ? 'active' : ''}" href="#/t/${t.id}">
            <span class="sb-icon">${esc(t.icon)}</span><span class="sb-label">${esc(t.name || 'Untitled')}</span>
          </a>`).join('')}
        <button class="sb-item sb-muted" data-action="new-tracker"><span class="sb-icon">＋</span><span class="sb-label">New tracker</span></button>
      </nav>
      <div class="sb-foot">
        <button class="sb-item sb-muted" data-action="export"><span class="sb-icon">⤓</span><span class="sb-label">Export backup</span></button>
        <button class="sb-item sb-muted" data-action="import"><span class="sb-icon">⤒</span><span class="sb-label">Import backup</span></button>
        <button class="sb-item sb-muted" data-action="theme"><span class="sb-icon">${effectiveTheme() === 'dark' ? '☀️' : '🌙'}</span><span class="sb-label">${effectiveTheme() === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
      </div>`;
  }

  function pageHead(t) {
    return `
      <header class="page-head">
        <button class="page-icon" data-action="pick-icon" aria-label="Change icon">${esc(t.icon)}</button>
        <div class="page-title-row">
          <input class="page-title" data-field="tracker-name" data-key="title-${t.id}" value="${esc(t.name)}" placeholder="Untitled" aria-label="Tracker name">
          <button class="icon-btn" data-action="tracker-menu" aria-label="Tracker options">⋯</button>
        </div>
      </header>`;
  }

  const tab = (v, label, mode) => `<button class="tab ${mode === v ? 'active' : ''}" role="tab" aria-selected="${mode === v}" data-action="set-view" data-view="${v}">${label}</button>`;

  // ----- Home -----
  function homePage() {
    const h = new Date().getHours();
    const greet = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const d = today();
    const items = state.trackers.filter((t) => t.kind === 'habit').flatMap((t) => t.habits.map((hb) => ({ t, hb })));
    const done = items.filter(({ t, hb }) => t.log[hb.id] && t.log[hb.id][d]).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;

    return `
      <div class="page">
        <header class="home-head">
          <h1>${greet} 👋</h1>
          <p class="muted">${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </header>

        <section class="card today">
          <div class="card-head">
            <h2>Today’s habits</h2>
            <span class="muted">${done} of ${items.length} done${items.length && done === items.length ? ' 🎉' : ''}</span>
          </div>
          <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
          ${items.length ? `<ul class="today-list">${items.map(({ t, hb }) => {
            const on = !!(t.log[hb.id] && t.log[hb.id][d]);
            const s = streak(t.log[hb.id]);
            return `<li><button class="today-item c-${hb.color} ${on ? 'on' : ''}" data-action="toggle-habit" data-tracker="${t.id}" data-habit="${hb.id}" data-date="${d}" aria-pressed="${on}">
              <span class="check-box">${on ? '✓' : ''}</span>
              <span class="ti-icon">${esc(hb.icon)}</span>
              <span class="ti-name">${esc(hb.name)}</span>
              ${s ? `<span class="streak">🔥 ${s}</span>` : ''}
            </button></li>`;
          }).join('')}</ul>` : '<p class="muted empty">No habits yet. <button class="link" data-action="new-tracker">Create a habit tracker</button></p>'}
        </section>

        <section>
          <h2 class="section-title">Your trackers</h2>
          <div class="tracker-grid">
            ${state.trackers.map(trackerCard).join('')}
            <button class="tracker-card add" data-action="new-tracker">
              <span class="tc-icon">＋</span><span class="tc-name">New tracker</span><span class="muted">Start from a template</span>
            </button>
          </div>
        </section>
      </div>`;
  }

  function trackerCard(t) {
    let sub;
    if (t.kind === 'habit') {
      const best = Math.max(0, ...t.habits.map((h) => streak(t.log[h.id])));
      sub = plural(t.habits.length, 'habit', 'habits') + (best ? ` · 🔥 ${best}-day streak` : '');
    } else {
      sub = plural(t.rows.length, 'entry', 'entries');
    }
    return `<a class="tracker-card" href="#/t/${t.id}"><span class="tc-icon">${esc(t.icon)}</span><span class="tc-name">${esc(t.name || 'Untitled')}</span><span class="muted">${sub}</span></a>`;
  }

  // ----- Habit tracker -----
  function habitPage(t) {
    const mode = t.view.mode === 'history' ? 'history' : 'week';
    return `
      <div class="page">
        ${pageHead(t)}
        <div class="toolbar">
          <div class="tabs" role="tablist">${tab('week', '📅 Week', mode)}${tab('history', '📈 History', mode)}</div>
          ${mode === 'week' ? weekNav() : ''}
        </div>
        ${mode === 'week' ? habitWeek(t) : habitHistory(t)}
        <form class="add-inline" data-form="add-habit">
          <input name="name" placeholder="Add a habit…" data-key="add-habit" autocomplete="off" aria-label="New habit name">
          <button class="btn">Add habit</button>
        </form>
      </div>`;
  }

  function weekNav() {
    const ws = addDays(weekStart(today()), ui.weekOffset * 7);
    const we = addDays(ws, 6);
    return `
      <div class="week-nav">
        <button class="icon-btn" data-action="week" data-delta="-1" aria-label="Previous week">‹</button>
        <span class="week-label">${fmtDate(ws, { month: 'short', day: 'numeric' })} – ${fmtDate(we, { month: 'short', day: 'numeric' })}</span>
        <button class="icon-btn" data-action="week" data-delta="1" aria-label="Next week" ${ui.weekOffset >= 0 ? 'disabled' : ''}>›</button>
        ${ui.weekOffset ? '<button class="btn sm" data-action="week" data-delta="0">This week</button>' : ''}
      </div>`;
  }

  function habitWeek(t) {
    if (!t.habits.length) return '<p class="muted empty">No habits yet — add your first one below.</p>';
    const ws = addDays(weekStart(today()), ui.weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const td = today();
    return `
      <div class="table-wrap">
        <table class="habit-grid">
          <thead><tr>
            <th class="habit-col">Habit</th>
            ${days.map((d) => `<th class="day ${d === td ? 'is-today' : ''}"><span>${fmtDate(d, { weekday: 'short' })}</span><span class="dnum">${parseISO(d).getDate()}</span></th>`).join('')}
            <th class="goal-col">Goal</th><th class="streak-col">Streak</th>
          </tr></thead>
          <tbody>${t.habits.map((h) => {
            const log = t.log[h.id] || {};
            const count = days.filter((d) => log[d]).length;
            const target = Math.min(Math.max(h.target || 7, 1), 7);
            const s = streak(log);
            return `<tr>
              <th scope="row" class="habit-name"><button class="hn-btn" data-action="edit-habit" data-habit="${h.id}" title="Edit habit"><span class="hn-icon">${esc(h.icon)}</span><span class="hn-text">${esc(h.name)}</span></button></th>
              ${days.map((d) => {
                const on = !!log[d];
                return `<td class="${d === td ? 'is-today' : ''}"><button class="check c-${h.color} ${on ? 'on' : ''}" data-action="toggle-habit" data-habit="${h.id}" data-date="${d}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}" ${d > td ? 'disabled' : ''}>${on ? '✓' : ''}</button></td>`;
              }).join('')}
              <td class="goal"><div class="goal-bar c-${h.color}"><div style="width:${Math.min(100, (count / target) * 100)}%"></div></div><span class="${count >= target ? 'met' : 'muted'}">${count}/${target}</span></td>
              <td class="streak-cell">${s ? `🔥 ${s}` : '<span class="muted">–</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  }

  function habitHistory(t) {
    if (!t.habits.length) return '<p class="muted empty">No habits yet — add your first one below.</p>';
    const WEEKS = 20;
    const td = today();
    const start = addDays(weekStart(td), -(WEEKS - 1) * 7);
    const stat = (label, value) => `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
    return `<div class="history">${t.habits.map((h) => {
      const log = t.log[h.id] || {};
      let cells = '';
      for (let i = 0; i < WEEKS * 7; i++) {
        const d = addDays(start, i);
        const fut = d > td;
        const label = `${fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}${log[d] ? ' ✓' : ''}`;
        cells += `<button class="hm ${log[d] ? 'on' : ''} ${fut ? 'fut' : ''} ${d === td ? 'is-today' : ''}" ${fut ? 'disabled' : ''} data-action="toggle-habit" data-habit="${h.id}" data-date="${d}" title="${label}" aria-label="${esc(h.name)}, ${label}"></button>`;
      }
      return `<article class="card hcard c-${h.color}">
        <div class="card-head"><h3><button class="hn-btn" data-action="edit-habit" data-habit="${h.id}">${esc(h.icon)} ${esc(h.name)}</button></h3></div>
        <div class="stats">
          ${stat('Current streak', `${streak(log)}d`)}${stat('Best streak', `${bestStreak(log)}d`)}${stat('Last 30 days', `${rate(log, 30)}%`)}${stat('Total check-ins', Object.keys(log).length)}
        </div>
        <div class="heatmap-wrap"><div class="heatmap">${cells}</div></div>
      </article>`;
    }).join('')}</div>`;
  }

  // ----- Database tracker -----
  function dbPage(t) {
    const v = t.view;
    const selects = t.properties.filter((p) => p.type === 'select');
    const mode = v.mode === 'board' && selects.length ? 'board' : 'table';
    const rows = visibleRows(t);
    const sortP = v.sort && t.properties.find((p) => p.id === v.sort.prop);
    return `
      <div class="page wide">
        ${pageHead(t)}
        <div class="toolbar">
          <div class="tabs" role="tablist">${tab('table', '▦ Table', mode)}${selects.length ? tab('board', '▥ Board', mode) : ''}</div>
          <div class="tools">
            ${sortP ? `<span class="chip">${esc(sortP.name)} ${v.sort.dir === 'desc' ? '↓' : '↑'}<button data-action="clear-sort" aria-label="Clear sort">✕</button></span>` : ''}
            <input type="search" class="search" placeholder="Search…" data-field="search" data-key="search-${t.id}" value="${esc(v.query || '')}" aria-label="Search entries">
            <button class="btn primary" data-action="add-row">＋ New</button>
          </div>
        </div>
        ${mode === 'table' ? dbTable(t, rows) : dbBoard(t, rows)}
      </div>`;
  }

  function cellEditor(r, p, ctx, isTitle) {
    const v = r.values[p.id];
    const attrs = `data-row="${r.id}" data-prop="${p.id}" data-key="${ctx}-${r.id}-${p.id}" aria-label="${esc(p.name)}"`;
    switch (p.type) {
      case 'checkbox':
        return `<input type="checkbox" class="cb" ${attrs} ${v ? 'checked' : ''}>`;
      case 'number':
        return `<input type="number" step="any" inputmode="decimal" class="cell-input num" ${attrs} value="${v ?? ''}">`;
      case 'date':
        return `<input type="date" class="cell-input" ${attrs} value="${esc(v || '')}">`;
      case 'select': {
        const o = p.options.find((x) => x.id === v);
        return `<select class="cell-select ${o ? `pill-${o.color}` : 'empty'}" ${attrs}>
          <option value="">—</option>
          ${p.options.map((x) => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>`;
      }
      case 'rating':
        return `<span class="rating" role="group" aria-label="${esc(p.name)}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="star ${i <= (v || 0) ? 'on' : ''}" data-action="rate" data-row="${r.id}" data-prop="${p.id}" data-val="${i}" aria-label="${i} of 5">★</button>`).join('')}</span>`;
      case 'url': {
        const href = safeUrl(v);
        return `<span class="url-cell"><input type="url" class="cell-input" ${attrs} value="${esc(v || '')}" placeholder="https://">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="url-open" aria-label="Open link">↗</a>` : ''}</span>`;
      }
      default:
        return `<input type="text" class="cell-input ${isTitle ? 'title-input' : ''}" ${attrs} value="${esc(v || '')}" placeholder="${isTitle ? 'Untitled' : ''}">`;
    }
  }

  function calc(p, rows) {
    const vals = rows.map((r) => r.values[p.id]);
    if (p.type === 'number') {
      const nums = vals.filter((v) => typeof v === 'number');
      if (!nums.length) return '';
      const sum = nums.reduce((a, b) => a + b, 0);
      return `<span class="muted">Sum</span> ${Math.round(sum * 100) / 100}`;
    }
    if (p.type === 'checkbox' && rows.length) return `<span class="muted">Done</span> ${vals.filter(Boolean).length}/${rows.length}`;
    if (p.type === 'rating') {
      const nums = vals.filter((v) => typeof v === 'number' && v > 0);
      return nums.length ? `<span class="muted">Avg</span> ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)} ★` : '';
    }
    return '';
  }

  function dbTable(t, rows) {
    const props = t.properties;
    return `
      <div class="table-wrap">
        <table class="db">
          <thead><tr>
            ${props.map((p, i) => `<th class="t-${p.type} ${i === 0 ? 'title-col' : ''}"><button class="th-btn" data-action="prop-menu" data-prop="${p.id}"><span class="ptype">${PROP_TYPES[p.type].icon}</span><span>${esc(p.name)}</span></button></th>`).join('')}
            <th class="add-col"><button class="th-btn" data-action="add-prop" aria-label="Add property" title="Add property">＋</button></th>
          </tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>
              ${props.map((p, i) => `<td class="t-${p.type}">${i === 0
                ? `<div class="title-cell">${cellEditor(r, p, 'c', true)}<button class="open-btn" tabindex="-1" data-action="open-row" data-row="${r.id}">Open</button></div>`
                : cellEditor(r, p, 'c')}</td>`).join('')}
              <td class="row-actions"><button class="icon-btn" data-action="delete-row" data-row="${r.id}" aria-label="Delete entry" title="Delete entry">🗑</button></td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            ${props.map((p, i) => `<td class="calc">${i === 0 ? '<button class="add-row-btn" data-action="add-row">＋ New</button>' : calc(p, rows)}</td>`).join('')}
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      ${rows.length ? '' : `<p class="muted empty">${t.view.query ? 'No matching entries.' : 'No entries yet — click “＋ New” to add one.'}</p>`}
      <p class="muted count">${plural(rows.length, 'entry', 'entries')}</p>`;
  }

  function cardProp(p, v) {
    if (v == null || v === '' || v === false) return '';
    if (p.type === 'select') {
      const o = p.options.find((x) => x.id === v);
      return o ? `<span class="pill pill-${o.color}">${esc(o.name)}</span>` : '';
    }
    if (p.type === 'checkbox') return `<div class="bc-prop">☑ ${esc(p.name)}</div>`;
    if (p.type === 'rating') return `<div class="bc-prop stars">${'★'.repeat(v)}<span class="muted">${'★'.repeat(5 - v)}</span></div>`;
    if (p.type === 'date') return `<div class="bc-prop muted">${esc(fmtDate(v, { month: 'short', day: 'numeric', year: 'numeric' }))}</div>`;
    return `<div class="bc-prop"><span class="muted">${esc(p.name)}:</span> ${esc(v)}</div>`;
  }

  function dbBoard(t, rows) {
    const selects = t.properties.filter((p) => p.type === 'select');
    const g = selects.find((p) => p.id === t.view.groupBy) || selects[0];
    const titleP = t.properties[0];
    const cols = [...g.options, { id: '', name: `No ${g.name}`, color: 'gray' }];
    return `
      <div class="board-meta muted">Grouped by <button class="link" data-action="group-menu">${esc(g.name)} ▾</button> · drag cards between columns</div>
      <div class="board">
        ${cols.map((c) => {
          const items = rows.filter((r) => (g.options.some((o) => o.id === r.values[g.id]) ? r.values[g.id] : '') === c.id);
          if (c.id === '' && !items.length) return '';
          return `<section class="col" data-col="${c.id}" data-group="${g.id}">
            <header class="col-head"><span class="pill pill-${c.color}">${esc(c.name)}</span><span class="muted">${items.length}</span></header>
            <div class="col-body">
              ${items.map((r) => `<article class="bcard" draggable="true" data-card="${r.id}" data-action="open-row" data-row="${r.id}" tabindex="0" role="button">
                <div class="bc-title">${esc(displayValue(titleP, r.values[titleP.id]) || 'Untitled')}</div>
                <div class="bc-props">${t.properties.slice(1).filter((p) => p.id !== g.id).map((p) => cardProp(p, r.values[p.id])).join('')}</div>
              </article>`).join('')}
            </div>
            <button class="col-add" data-action="add-row" data-group="${g.id}" data-col="${c.id}">＋ New</button>
          </section>`;
        }).join('')}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------
  const modal = document.getElementById('modal');
  let modalState = null;

  function openModal(opts) {
    modalState = opts;
    drawModal();
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('[autofocus]');
    if (first) { first.focus(); if (first.select) first.select(); }
  }

  function drawModal() {
    if (!modalState) return;
    const html = typeof modalState.body === 'function' ? modalState.body() : modalState.body;
    if (html == null) { closeModal(); return; }
    modal.className = modalState.cls || '';
    modal.innerHTML = `
      <form class="modal-form" novalidate>
        <header class="modal-head">
          <h2>${esc(modalState.title || '')}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button>
        </header>
        <div class="modal-body">${html}</div>
        ${modalState.submitLabel ? `<footer class="modal-foot">
          ${modalState.footerExtra || ''}
          <span class="spacer"></span>
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary">${esc(modalState.submitLabel)}</button>
        </footer>` : ''}
      </form>`;
  }

  function closeModal() {
    modalState = null;
    if (modal.open) modal.close();
  }

  modal.addEventListener('close', () => { modalState = null; modal.innerHTML = ''; });
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!modalState || !modalState.onSubmit) return;
    const fd = new FormData(e.target);
    if (modalState.onSubmit(fd) === false) return;
    closeModal();
    commit();
  });

  function templatePicker() {
    openModal({
      title: 'New tracker',
      cls: 'wide',
      body: `<p class="muted">Pick a starting point. You can rename, re-icon and add columns afterwards.</p>
        <div class="template-grid">${Object.entries(TEMPLATES).map(([k, tp]) => `
          <button type="button" class="template" data-action="create-template" data-template="${k}">
            <span class="tp-icon">${tp.icon}</span><span class="tp-name">${esc(tp.name)}</span><span class="muted tp-desc">${esc(tp.desc)}</span>
          </button>`).join('')}</div>`,
    });
  }

  function emojiRadios(name, current) {
    return `<div class="emoji-grid">${[...new Set([current, ...EMOJI])].map((e) => `
      <label class="emoji-opt"><input type="radio" name="${name}" value="${esc(e)}" ${e === current ? 'checked' : ''}><span>${esc(e)}</span></label>`).join('')}</div>`;
  }

  function colorRadios(name, current) {
    return `<div class="swatches">${COLORS.map((c) => `
      <label class="swatch c-${c}" title="${c}"><input type="radio" name="${name}" value="${c}" ${c === current ? 'checked' : ''} aria-label="${c}"><span></span></label>`).join('')}</div>`;
  }

  function editHabit(t, h) {
    openModal({
      title: 'Edit habit',
      submitLabel: 'Save',
      footerExtra: `<button type="button" class="btn danger" data-action="delete-habit" data-habit="${h.id}">Delete</button>`,
      body: `
        <label class="field"><span>Name</span><input name="name" value="${esc(h.name)}" required autofocus autocomplete="off"></label>
        <label class="field"><span>Weekly goal (days per week)</span><input name="target" type="number" min="1" max="7" value="${h.target || 7}"></label>
        <div class="field"><span>Color</span>${colorRadios('color', h.color)}</div>
        <div class="field"><span>Icon</span>${emojiRadios('icon', h.icon)}</div>
        <div class="field"><span>Order</span><div class="btn-row">
          <button type="button" class="btn sm" data-action="move-habit" data-habit="${h.id}" data-delta="-1">↑ Move up</button>
          <button type="button" class="btn sm" data-action="move-habit" data-habit="${h.id}" data-delta="1">↓ Move down</button>
        </div></div>`,
      onSubmit: (fd) => {
        const name = String(fd.get('name') || '').trim();
        if (!name) return false;
        h.name = name;
        h.target = Math.min(7, Math.max(1, parseInt(fd.get('target'), 10) || 7));
        h.color = fd.get('color') || h.color;
        h.icon = fd.get('icon') || h.icon;
        return true;
      },
    });
  }

  function editProperty(t, p) {
    const isNew = !p;
    const draft = p || { name: '', type: 'text' };
    const optionsText = draft.type === 'select' ? draft.options.map((o) => o.name).join('\n') : '';
    const isTitle = !isNew && t.properties[0] === p;
    openModal({
      title: isNew ? 'Add property' : 'Edit property',
      submitLabel: isNew ? 'Add' : 'Save',
      body: `
        <label class="field"><span>Name</span><input name="name" value="${esc(draft.name)}" required autofocus autocomplete="off" placeholder="e.g. Status, Minutes, Tags"></label>
        <label class="field"><span>Type</span><select name="type" data-field="prop-type" ${isTitle ? 'disabled' : ''}>
          ${Object.entries(PROP_TYPES).map(([k, pt]) => `<option value="${k}" ${k === draft.type ? 'selected' : ''}>${pt.icon}  ${pt.label}</option>`).join('')}
        </select>${isTitle ? '<small class="muted">The first column is the entry title and stays as text.</small>' : ''}</label>
        <label class="field options-field" ${draft.type === 'select' ? '' : 'hidden'}><span>Options <small class="muted">(one per line)</small></span>
          <textarea name="options" rows="5" placeholder="To do&#10;Doing&#10;Done">${esc(optionsText)}</textarea></label>`,
      onSubmit: (fd) => {
        const name = String(fd.get('name') || '').trim();
        if (!name) return false;
        const type = isTitle ? p.type : String(fd.get('type') || 'text');
        const optNames = String(fd.get('options') || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const buildOptions = (existing = []) => [...new Set(optNames)].map((n, i) => existing.find((o) => o.name === n) || opt(n, COLORS[i % COLORS.length]));

        if (isNew) {
          const np = prop(name, type);
          if (type === 'select') np.options = buildOptions();
          t.properties.push(np);
          return true;
        }
        p.name = name;
        if (type !== p.type) {
          const from = { ...p, options: p.options ? [...p.options] : undefined };
          const to = { id: p.id, name, type };
          if (type === 'select') to.options = buildOptions();
          for (const r of t.rows) {
            const nv = convertValue(r.values[p.id], from, to, to);
            if (nv == null) delete r.values[p.id]; else r.values[p.id] = nv;
          }
          Object.keys(p).forEach((k) => delete p[k]);
          Object.assign(p, to);
          if (t.view.sort && t.view.sort.prop === p.id) t.view.sort = null;
        } else if (type === 'select') {
          p.options = buildOptions(p.options);
          const ids = new Set(p.options.map((o) => o.id));
          for (const r of t.rows) if (r.values[p.id] && !ids.has(r.values[p.id])) delete r.values[p.id];
        }
        return true;
      },
    });
  }

  function openRow(t, rowId) {
    openModal({
      title: t.name || 'Entry',
      cls: 'wide',
      live: true,
      body: () => {
        const r = t.rows.find((x) => x.id === rowId);
        if (!r) return null;
        const [titleP, ...rest] = t.properties;
        return `
          <div class="row-title">${cellEditor(r, titleP, 'm', true)}</div>
          <div class="prop-list">
            ${rest.map((p) => `<div class="prop-row"><div class="prop-name"><span class="ptype">${PROP_TYPES[p.type].icon}</span>${esc(p.name)}</div><div class="prop-val t-${p.type}">${cellEditor(r, p, 'm')}</div></div>`).join('')}
          </div>
          <div class="modal-foot">
            <button type="button" class="btn danger" data-action="delete-row" data-row="${r.id}">Delete entry</button>
            <span class="spacer"></span>
            <button type="button" class="btn primary" data-action="close-modal">Done</button>
          </div>`;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Popovers (menus, emoji picker)
  // ---------------------------------------------------------------------------
  let popEl = null;
  function closePopover() { if (popEl) { popEl.remove(); popEl = null; } }
  function openPopover(anchor, html, onPick, cls = '') {
    closePopover();
    popEl = document.createElement('div');
    popEl.className = `popover ${cls}`;
    popEl.setAttribute('role', 'menu');
    popEl.innerHTML = html;
    (modal.open ? modal : document.body).appendChild(popEl);
    const r = anchor.getBoundingClientRect();
    const w = popEl.offsetWidth, h = popEl.offsetHeight;
    const top = r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    popEl.style.top = `${top}px`;
    popEl.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
    popEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const v = b.dataset.pick;
      closePopover();
      onPick(v);
    });
    const firstBtn = popEl.querySelector('button');
    if (firstBtn) firstBtn.focus({ preventScroll: true });
  }
  function openMenu(anchor, items, onPick) {
    openPopover(anchor, items.filter(Boolean).map((it) => it.sep
      ? '<div class="menu-sep"></div>'
      : `<button type="button" class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" data-pick="${esc(it.value)}">${it.label}</button>`).join(''), onPick, 'menu');
  }
  document.addEventListener('mousedown', (e) => { if (popEl && !popEl.contains(e.target)) closePopover(); });
  window.addEventListener('resize', closePopover);
  document.addEventListener('scroll', closePopover, true);

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function effectiveTheme() { return document.documentElement.dataset.theme || (darkMQ.matches ? 'dark' : 'light'); }
  function applyTheme() { const s = storedTheme(); if (s) document.documentElement.dataset.theme = s; else delete document.documentElement.dataset.theme; }
  darkMQ.addEventListener('change', () => renderSidebar());
  applyTheme();

  // ---------------------------------------------------------------------------
  // Import / export
  // ---------------------------------------------------------------------------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trackers-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const importInput = document.getElementById('import-file');
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.trackers)) throw new Error('This file doesn’t look like a trackers backup.');
      if (!confirm(`Replace your current trackers with the ${plural(data.trackers.length, 'tracker', 'trackers')} in “${file.name}”?`)) return;
      state = normalize(data);
      save();
      location.hash = '#/';
      render();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------
  function route() {
    const m = location.hash.match(/^#\/t\/([\w-]+)/);
    const next = m && findTracker(m[1]) ? m[1] : 'home';
    if (next !== ui.page) ui.weekOffset = 0;
    ui.page = next;
    appEl.classList.remove('sb-open');
    closePopover();
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  const go = (id) => { location.hash = id === 'home' ? '#/' : `#/t/${id}`; };

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const t = el.dataset.tracker ? findTracker(el.dataset.tracker) : cur();
    const habit = t && t.habits && el.dataset.habit ? t.habits.find((h) => h.id === el.dataset.habit) : null;

    switch (action) {
      case 'open-sidebar': appEl.classList.add('sb-open'); break;
      case 'close-sidebar': appEl.classList.remove('sb-open'); break;
      case 'close-modal': closeModal(); break;
      case 'new-tracker': appEl.classList.remove('sb-open'); templatePicker(); break;
      case 'create-template': {
        const nt = TEMPLATES[el.dataset.template].make(false);
        state.trackers.push(nt);
        closeModal();
        save();
        go(nt.id);
        break;
      }
      case 'export': exportData(); break;
      case 'import': importInput.click(); break;
      case 'theme': {
        const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* per-viewer convenience only */ }
        document.documentElement.dataset.theme = next;
        renderSidebar();
        break;
      }
      case 'pick-icon':
        openPopover(el, EMOJI.map((em) => `<button type="button" class="emoji-btn" data-pick="${em}">${em}</button>`).join(''), (em) => { t.icon = em; commit(); }, 'emoji-pop');
        break;
      case 'tracker-menu':
        openMenu(el, [{ label: '⧉ Duplicate', value: 'dup' }, { sep: true }, { label: '🗑 Delete tracker', value: 'del', danger: true }], (v) => {
          if (v === 'dup') {
            const copy = JSON.parse(JSON.stringify(t));
            copy.id = uid();
            copy.name = `${t.name} (copy)`;
            state.trackers.splice(state.trackers.indexOf(t) + 1, 0, copy);
            save();
            go(copy.id);
          } else if (v === 'del' && confirm(`Delete “${t.name || 'Untitled'}” and everything in it? This can’t be undone.`)) {
            state.trackers = state.trackers.filter((x) => x !== t);
            save();
            go('home');
            render();
          }
        });
        break;
      case 'set-view': t.view.mode = el.dataset.view; commit(); break;
      case 'week': {
        const d = Number(el.dataset.delta);
        ui.weekOffset = d === 0 ? 0 : Math.min(0, ui.weekOffset + d);
        render();
        break;
      }
      case 'toggle-habit': if (habit) { toggleHabit(t, habit.id, el.dataset.date); commit(); } break;
      case 'edit-habit': if (habit) editHabit(t, habit); break;
      case 'move-habit': {
        const i = t.habits.indexOf(habit), j = i + Number(el.dataset.delta);
        if (habit && j >= 0 && j < t.habits.length) { t.habits.splice(i, 1); t.habits.splice(j, 0, habit); commit(); }
        break;
      }
      case 'delete-habit':
        if (habit && confirm(`Delete “${habit.name}” and its history?`)) {
          t.habits = t.habits.filter((h) => h !== habit);
          delete t.log[habit.id];
          closeModal();
          commit();
        }
        break;
      case 'add-row': {
        const preset = {};
        if (el.dataset.group && el.dataset.col) preset[el.dataset.group] = el.dataset.col;
        const r = addRow(t, preset);
        commit();
        if (t.view.mode === 'board') openRow(t, r.id);
        else {
          const input = document.querySelector(`[data-key="c-${r.id}-${t.properties[0].id}"]`);
          if (input) input.focus(); else openRow(t, r.id);
        }
        break;
      }
      case 'delete-row': {
        const r = t.rows.find((x) => x.id === el.dataset.row);
        const titleP = t.properties[0];
        const label = r && displayValue(titleP, r.values[titleP.id]);
        if (r && (!label || confirm(`Delete “${label}”?`))) {
          t.rows = t.rows.filter((x) => x !== r);
          if (modalState && modalState.live) closeModal();
          commit();
        }
        break;
      }
      case 'open-row': openRow(t, el.dataset.row); break;
      case 'rate': {
        const r = t.rows.find((x) => x.id === el.dataset.row);
        const val = Number(el.dataset.val);
        if (r) { r.values[el.dataset.prop] = r.values[el.dataset.prop] === val ? null : val; commit(); }
        break;
      }
      case 'add-prop': editProperty(t, null); break;
      case 'prop-menu': {
        const p = t.properties.find((x) => x.id === el.dataset.prop);
        const i = t.properties.indexOf(p);
        openMenu(el, [
          { label: '✎ Edit property', value: 'edit' },
          { label: '↑ Sort ascending', value: 'asc' },
          { label: '↓ Sort descending', value: 'desc' },
          p.type === 'select' && { label: '▥ Group board by this', value: 'group' },
          i > 1 && { label: '← Move left', value: 'left' },
          i > 0 && i < t.properties.length - 1 && { label: '→ Move right', value: 'right' },
          i > 0 && { sep: true },
          i > 0 && { label: '🗑 Delete property', value: 'del', danger: true },
        ], (v) => {
          if (v === 'edit') return editProperty(t, p);
          if (v === 'asc' || v === 'desc') t.view.sort = { prop: p.id, dir: v };
          if (v === 'group') { t.view.groupBy = p.id; t.view.mode = 'board'; }
          if (v === 'left' || v === 'right') {
            const j = i + (v === 'left' ? -1 : 1);
            t.properties.splice(i, 1);
            t.properties.splice(j, 0, p);
          }
          if (v === 'del') {
            if (!confirm(`Delete the “${p.name}” property and its values?`)) return;
            t.properties = t.properties.filter((x) => x !== p);
            t.rows.forEach((r) => delete r.values[p.id]);
            if (t.view.sort && t.view.sort.prop === p.id) t.view.sort = null;
            if (t.view.groupBy === p.id) t.view.groupBy = null;
          }
          commit();
        });
        break;
      }
      case 'clear-sort': t.view.sort = null; commit(); break;
      case 'group-menu': {
        const selects = t.properties.filter((p) => p.type === 'select');
        openMenu(el, selects.map((p) => ({ label: esc(p.name), value: p.id })), (v) => { t.view.groupBy = v; commit(); });
        break;
      }
      default: break;
    }
  });

  // Keyboard activation for board cards.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popEl) { closePopover(); e.preventDefault(); return; }
    const card = e.target.closest && e.target.closest('.bcard');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); card.click(); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const t = cur();
    if (el.dataset.row && el.dataset.prop && t && t.rows) {
      const r = t.rows.find((x) => x.id === el.dataset.row);
      const p = t.properties.find((x) => x.id === el.dataset.prop);
      if (!r || !p) return;
      let v;
      if (p.type === 'checkbox') v = el.checked;
      else if (p.type === 'number') v = el.value === '' ? null : Number(el.value);
      else v = el.value.trim() === '' ? null : el.value;
      if (v == null || v === false) delete r.values[p.id]; else r.values[p.id] = v;
      commit(true);
    } else if (el.dataset.field === 'tracker-name' && t) {
      t.name = el.value.trim();
      commit(true);
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    const t = cur();
    if (el.dataset.field === 'search' && t) { t.view.query = el.value; commit(); }
    else if (el.dataset.field === 'tracker-name' && t) { t.name = el.value; save(); renderSidebar(); mobileTitleEl.textContent = `${t.icon} ${t.name || 'Untitled'}`; }
    else if (el.dataset.field === 'prop-type') {
      const f = el.form && el.form.querySelector('.options-field');
      if (f) f.hidden = el.value !== 'select';
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.dataset.form !== 'add-habit') return;
    e.preventDefault();
    const t = cur();
    const name = String(new FormData(form).get('name') || '').trim();
    if (!t || !name) return;
    t.habits.push({ id: uid(), name, icon: '✅', color: COLORS[t.habits.length % COLORS.length], target: 7 });
    form.reset();
    commit();
  });

  // Title inputs: Enter commits and leaves the field.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.page-title, .cell-input')) e.target.blur();
  });

  // Board drag & drop.
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('[data-card]');
    if (!c) return;
    e.dataTransfer.setData('text/plain', c.dataset.card);
    e.dataTransfer.effectAllowed = 'move';
    c.classList.add('dragging');
  });
  document.addEventListener('dragend', () => document.querySelectorAll('.dragging, .col.over').forEach((n) => n.classList.remove('dragging', 'over')));
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col) return;
    e.preventDefault();
    document.querySelectorAll('.col.over').forEach((n) => n !== col && n.classList.remove('over'));
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col) return;
    e.preventDefault();
    const t = cur();
    const r = t && t.rows && t.rows.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (!r) return;
    if (col.dataset.col) r.values[col.dataset.group] = col.dataset.col; else delete r.values[col.dataset.group];
    commit();
  });

  // Refresh "today" when the date rolls over or the tab regains focus.
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && today() !== lastDay) { lastDay = today(); render(); }
  });

  save();
  route();
})();
