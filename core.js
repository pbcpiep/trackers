/*
 * Shared logic for the browser app (window.TrackerCore) and the daily email
 * digest serverless function (require('../core.js')). No DOM access here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrackerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Dates (ISO "YYYY-MM-DD" strings in the user's local calendar)
  // ---------------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };

  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }

  /** Today's date in an IANA time zone (falls back to the runtime's local zone). */
  function todayIn(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t).value;
      return `${get('year')}-${get('month')}-${get('day')}`;
    } catch (e) {
      return toISO(new Date());
    }
  }

  const UNITS = { days: 'day', weeks: 'week', months: 'month', years: 'year' };

  function addInterval(iso, every, unit) {
    const n = Math.max(1, Math.round(Number(every) || 1));
    if (unit === 'weeks') return addDays(iso, n * 7);
    if (unit === 'months' || unit === 'years') {
      const [y, m, d] = iso.split('-').map(Number);
      const target = new Date(y, m - 1 + (unit === 'years' ? n * 12 : n), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d, lastDay)); // Jan 31 + 1 month -> Feb 28/29
      return toISO(target);
    }
    return addDays(iso, n);
  }

  function intervalLabel(every, unit) {
    const n = Math.max(1, Math.round(Number(every) || 1));
    const u = UNITS[unit] || 'day';
    return n === 1 ? `Every ${u}` : `Every ${n} ${u}s`;
  }

  // ---------------------------------------------------------------------------
  // Recurring items (chores, haircuts, checking in on friends, ...)
  // ---------------------------------------------------------------------------
  function lastDone(item) {
    return (item.history || []).reduce((a, b) => (b > a ? b : a), '') || null;
  }

  function recurringStatus(item, today) {
    const last = lastDone(item);
    if (!last) return { state: 'never', last: null, next: null, days: null, progress: 0 };
    const next = addInterval(last, item.every, item.unit);
    const days = daysBetween(today, next);
    const total = Math.max(1, daysBetween(last, next));
    const progress = Math.min(1, Math.max(0, daysBetween(last, today) / total));
    const state = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 2 ? 'soon' : 'ok';
    return { state, last, next, days, progress };
  }

  function dueLabel(days) {
    if (days == null) return 'Not logged yet';
    if (days < -1) return `Overdue by ${-days} days`;
    if (days === -1) return 'Overdue by 1 day';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `In ${days} days`;
  }

  // ---------------------------------------------------------------------------
  // Database rows with reminder dates (tasks, ...)
  // ---------------------------------------------------------------------------
  /** A row counts as done when any of its checkbox properties is ticked. */
  function isRowDone(t, row) {
    return t.properties.some((p) => p.type === 'checkbox' && row.values[p.id]);
  }

  function rowTitle(t, row) {
    const v = row.values[t.properties[0].id];
    return v == null || v === '' ? 'Untitled' : String(v);
  }

  /** Everything due on or before `today + horizon` days, most urgent first. */
  function collectDue(state, today, horizon) {
    const items = [];
    for (const t of state.trackers || []) {
      if (t.kind === 'recurring') {
        for (const it of t.items || []) {
          const st = recurringStatus(it, today);
          if (st.next && st.days <= horizon) {
            items.push({ kind: 'recurring', trackerId: t.id, tracker: t.name, trackerIcon: t.icon, id: it.id, name: it.name, icon: it.icon, due: st.next, days: st.days });
          }
        }
      } else if (t.kind === 'database') {
        const dateProps = (t.properties || []).filter((p) => p.type === 'date' && p.remind);
        if (!dateProps.length) continue;
        for (const r of t.rows || []) {
          if (isRowDone(t, r)) continue;
          for (const p of dateProps) {
            const v = r.values[p.id];
            if (!v) continue;
            const days = daysBetween(today, v);
            if (days <= horizon) items.push({ kind: 'task', trackerId: t.id, tracker: t.name, trackerIcon: t.icon, id: r.id, name: rowTitle(t, r), icon: t.icon, due: v, days, field: p.name });
          }
        }
      }
    }
    return items.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
  }

  // ---------------------------------------------------------------------------
  // Daily email digest
  // ---------------------------------------------------------------------------
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function buildDigest(state, today, opts = {}) {
    const due = collectDue(state, today, 1);
    const overdue = due.filter((d) => d.days < 0);
    const dueToday = due.filter((d) => d.days === 0);
    const tomorrow = due.filter((d) => d.days === 1);
    const habits = (state.trackers || []).filter((t) => t.kind === 'habit').flatMap((t) => t.habits || []);
    const count = overdue.length + dueToday.length;

    const subject = count
      ? `${count} thing${count === 1 ? '' : 's'} due today${overdue.length ? ` (${overdue.length} overdue)` : ''}`
      : 'Nothing due today 🎉';

    const [y, m, d] = today.split('-').map(Number);
    const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

    const itemLine = (it) => `${it.icon || '•'} ${it.name} — ${it.tracker}${it.days < 0 ? ` (${dueLabel(it.days).toLowerCase()})` : ''}`;
    const section = (title, list, color) => list.length ? `
      <h3 style="margin:20px 0 6px;font-size:15px;color:${color}">${escapeHtml(title)}</h3>
      <ul style="margin:0;padding-left:18px">${list.map((it) => `<li style="margin:3px 0">${escapeHtml(itemLine(it))}</li>`).join('')}</ul>` : '';

    const appLink = opts.appUrl ? `<p style="margin:24px 0 0"><a href="${escapeHtml(opts.appUrl)}" style="color:#2383e2">Open my trackers →</a></p>` : '';
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#37352f">
      <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e9e9e7;border-radius:12px;padding:24px">
        <p style="margin:0;color:#787774;font-size:13px">${escapeHtml(dateLabel)}</p>
        <h2 style="margin:4px 0 0;font-size:20px">${escapeHtml(subject)}</h2>
        ${section('Overdue', overdue, '#d44c47')}
        ${section('Due today', dueToday, '#d9730d')}
        ${section('Tomorrow', tomorrow, '#337ea9')}
        ${habits.length ? `<h3 style="margin:20px 0 6px;font-size:15px;color:#448361">Today’s habits</h3><p style="margin:0">${habits.map((h) => escapeHtml(`${h.icon} ${h.name}`)).join(' · ')}</p>` : ''}
        ${appLink}
      </div></body></html>`;

    const textSection = (title, list) => (list.length ? `\n${title}\n${list.map((it) => `- ${itemLine(it)}`).join('\n')}\n` : '');
    const text = `${dateLabel}\n${subject}\n${textSection('OVERDUE', overdue)}${textSection('DUE TODAY', dueToday)}${textSection('TOMORROW', tomorrow)}${
      habits.length ? `\nTODAY'S HABITS\n${habits.map((h) => `- ${h.name}`).join('\n')}\n` : ''}${opts.appUrl ? `\n${opts.appUrl}\n` : ''}`;

    return { subject, html, text, count, overdue, dueToday, tomorrow };
  }

  return {
    toISO, parseISO, addDays, daysBetween, todayIn, addInterval, intervalLabel, UNITS,
    lastDone, recurringStatus, dueLabel, isRowDone, rowTitle, collectDue, buildDigest, escapeHtml,
  };
});
