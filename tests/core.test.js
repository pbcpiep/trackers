const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('addInterval handles days, weeks, months (clamped) and years', () => {
  assert.equal(core.addInterval('2026-09-28', 3, 'days'), '2026-10-01');
  assert.equal(core.addInterval('2026-09-28', 2, 'weeks'), '2026-10-12');
  assert.equal(core.addInterval('2026-01-31', 1, 'months'), '2026-02-28');
  assert.equal(core.addInterval('2028-01-31', 1, 'months'), '2028-02-29');
  assert.equal(core.addInterval('2026-03-15', 6, 'months'), '2026-09-15');
  assert.equal(core.addInterval('2026-09-28', 1, 'years'), '2027-09-28');
});

test('daysBetween is DST-safe', () => {
  assert.equal(core.daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(core.daysBetween('2026-11-02', '2026-10-31'), -2);
});

test('recurringStatus reports overdue / today / soon / ok / never', () => {
  const item = (history, every = 1, unit = 'weeks') => ({ history, every, unit });
  assert.equal(core.recurringStatus(item([]), '2026-09-28').state, 'never');
  const over = core.recurringStatus(item(['2026-09-01', '2026-09-10']), '2026-09-28');
  assert.deepEqual([over.state, over.last, over.next, over.days], ['overdue', '2026-09-10', '2026-09-17', -11]);
  assert.equal(core.recurringStatus(item(['2026-09-21']), '2026-09-28').state, 'today');
  assert.equal(core.recurringStatus(item(['2026-09-22']), '2026-09-28').state, 'soon');
  const ok = core.recurringStatus(item(['2026-09-28'], 4, 'weeks'), '2026-09-28');
  assert.deepEqual([ok.state, ok.days, ok.progress], ['ok', 28, 0]);
});

test('dueLabel wording', () => {
  assert.equal(core.dueLabel(-3), 'Overdue by 3 days');
  assert.equal(core.dueLabel(-1), 'Overdue by 1 day');
  assert.equal(core.dueLabel(0), 'Due today');
  assert.equal(core.dueLabel(1), 'Due tomorrow');
  assert.equal(core.dueLabel(5), 'In 5 days');
});

const sampleState = () => ({
  settings: { timezone: 'America/New_York' },
  trackers: [
    { id: 'h', kind: 'habit', name: 'Habits', icon: '✅', habits: [{ id: 'h1', name: 'Read', icon: '📖' }], log: {} },
    { id: 'c', kind: 'recurring', name: 'Chores', icon: '🧹', items: [
      { id: 'c1', name: 'Vacuum', icon: '🧹', every: 1, unit: 'weeks', history: ['2026-09-14'] },  // overdue
      { id: 'c2', name: 'Laundry', icon: '🧺', every: 1, unit: 'weeks', history: ['2026-09-21'] }, // today
      { id: 'c3', name: 'Haircut', icon: '✂️', every: 4, unit: 'weeks', history: ['2026-09-01'] }, // tomorrow
      { id: 'c4', name: 'Dentist', icon: '🦷', every: 6, unit: 'months', history: ['2026-09-01'] }, // later
      { id: 'c5', name: 'Never', icon: '❓', every: 1, unit: 'days', history: [] },
    ] },
    { id: 't', kind: 'database', name: 'Tasks', icon: '☑️', properties: [
      { id: 'p1', name: 'Task', type: 'text' }, { id: 'p2', name: 'Due', type: 'date', remind: true },
      { id: 'p3', name: 'Done', type: 'checkbox' }, { id: 'p4', name: 'Other date', type: 'date' },
    ], rows: [
      { id: 'r1', values: { p1: 'Send <report>', p2: '2026-09-28' } },
      { id: 'r2', values: { p1: 'Already done', p2: '2026-09-20', p3: true } },
      { id: 'r3', values: { p1: 'Not a reminder', p4: '2026-09-28' } },
      { id: 'r4', values: { p1: 'Next week', p2: '2026-10-05' } },
    ] },
  ],
});

test('collectDue includes overdue/today/soon items and skips done or unflagged rows', () => {
  const due = core.collectDue(sampleState(), '2026-09-28', 1);
  assert.deepEqual(due.map((d) => [d.name, d.days]), [
    ['Vacuum', -7], ['Laundry', 0], ['Send <report>', 0], ['Haircut', 1],
  ]);
});

test('buildDigest summarizes and escapes user text', () => {
  const d = core.buildDigest(sampleState(), '2026-09-28', { appUrl: 'https://example.com' });
  assert.equal(d.count, 3);
  assert.equal(d.subject, '3 things due today (1 overdue)');
  assert.match(d.html, /Send &lt;report&gt;/);
  assert.doesNotMatch(d.html, /<report>/);
  assert.match(d.text, /OVERDUE\n- 🧹 Vacuum — Chores \(overdue by 7 days\)/);
  assert.match(d.text, /TOMORROW\n- ✂️ Haircut/);
  assert.match(d.html, /https:\/\/example\.com/);
  const empty = core.buildDigest({ trackers: [] }, '2026-09-28');
  assert.equal(empty.count, 0);
  assert.equal(empty.subject, 'Nothing due today 🎉');
});

test('todayIn returns an ISO date and tolerates bad zones', () => {
  assert.match(core.todayIn('Pacific/Auckland'), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(core.todayIn('Not/AZone'), /^\d{4}-\d{2}-\d{2}$/);
});
