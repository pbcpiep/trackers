const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

const handler = require('../api/digest.js');

function mockRes() {
  return {
    statusCode: 0, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const TODAY_STATE = (userTz) => {
  const today = core.todayIn(userTz);
  return {
    settings: { timezone: userTz, digest: { enabled: true } },
    trackers: [{ id: 'c', kind: 'recurring', name: 'Chores', icon: '🧹', items: [
      { id: 'c1', name: 'Vacuum', icon: '🧹', every: 1, unit: 'weeks', history: [core.addDays(today, -7)] },
    ] }],
  };
};

function setup(rows, { users = {}, validToken = 'user-token' } = {}) {
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_x';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x';
  process.env.RESEND_API_KEY = 're_x';
  process.env.CRON_SECRET = 'cron-secret';
  delete process.env.ALLOWED_EMAILS;
  const sent = [];
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    if (url === 'https://api.resend.com/emails') { sent.push(JSON.parse(opts.body)); return ok({ id: 'e1' }); }
    if (url.endsWith('/auth/v1/user')) {
      return opts.headers.Authorization === `Bearer ${validToken}` ? ok({ id: 'u1', email: 'me@example.com' }) : { ok: false, status: 401, json: async () => ({}) };
    }
    const m = url.match(/\/auth\/v1\/admin\/users\/(.+)$/);
    if (m) return ok({ id: m[1], email: users[m[1]] });
    if (url.includes('/rest/v1/user_state')) {
      const f = url.match(/user_id=eq\.([^&]+)/);
      return ok(f ? rows.filter((r) => r.user_id === decodeURIComponent(f[1])) : rows);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { sent, calls };
}

test('rejects requests without a valid secret or user token', async () => {
  setup([]);
  const res = mockRes();
  await handler({ headers: {} }, res);
  assert.equal(res.statusCode, 401);
  const res2 = mockRes();
  await handler({ headers: { authorization: 'Bearer wrong' } }, res2);
  assert.equal(res2.statusCode, 401);
});

test('cron run emails users with something due and skips the rest', async () => {
  const off = TODAY_STATE('UTC'); off.settings.digest.enabled = false;
  const { sent, calls } = setup([
    { user_id: 'u1', data: TODAY_STATE('America/Los_Angeles') },
    { user_id: 'u2', data: { settings: { timezone: 'UTC' }, trackers: [] } },
    { user_id: 'u3', data: off },
  ], { users: { u1: 'a@example.com', u2: 'b@example.com', u3: 'c@example.com' } });
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer cron-secret', host: 'trackers.vercel.app' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sent.map((m) => m.to[0]), ['a@example.com']);
  assert.equal(sent[0].subject, '1 thing due today');
  assert.match(sent[0].html, /https:\/\/trackers\.vercel\.app/);
  assert.deepEqual(res.body.skipped.map((s) => s.reason), ['nothing due', 'digest off']);
  // Secret key goes only in the apikey header (it is not a JWT).
  const rest = calls.find((c) => c.url.includes('/rest/v1/'));
  assert.deepEqual(rest.opts.headers, { apikey: 'sb_secret_x' });
});

test('ALLOWED_EMAILS limits who gets emailed', async () => {
  const { sent } = setup([{ user_id: 'u1', data: TODAY_STATE('UTC') }], { users: { u1: 'stranger@example.com' } });
  process.env.ALLOWED_EMAILS = 'me@example.com';
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer cron-secret', host: 'x' } }, res);
  assert.equal(sent.length, 0);
  assert.equal(res.body.skipped[0].reason, 'not in ALLOWED_EMAILS');
});

test('test mode emails only the signed-in user, even when nothing is due', async () => {
  const { sent } = setup([
    { user_id: 'u1', data: { settings: {}, trackers: [] } },
    { user_id: 'u2', data: TODAY_STATE('UTC') },
  ]);
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer user-token', host: 'x' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['me@example.com']);
  assert.equal(sent[0].subject, '[Test] Nothing due today 🎉');
});
