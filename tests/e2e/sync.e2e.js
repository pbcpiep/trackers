// Cloud sync against a mocked Supabase: sign-in by code, first upload, auto-save,
// pulling another device's change, conflict prompt, second device, sign-out.
// Needs the supabase-js browser bundle: npm i -g @supabase/supabase-js (skipped otherwise).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { launch, startStaticServer, check } = require('./helpers');

function findSdk() {
  const rel = '@supabase/supabase-js/dist/umd/supabase.js';
  for (const base of [path.join(__dirname, '..', '..', 'node_modules'), execSync('npm root -g').toString().trim()]) {
    const f = path.join(base, rel);
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
  return null;
}

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'me@example.com', aud: 'authenticated', role: 'authenticated' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

(async () => {
  const SDK = findSdk();
  if (!SDK) { console.log('  - skipped: install @supabase/supabase-js (npm i -g @supabase/supabase-js) to run the sync test'); return; }
  const server = await startStaticServer();
  let db = null; let tick = 0; const log = [];
  const pgTime = () => new Date(Date.now() + (tick++) * 1000).toISOString().replace('Z', '+00:00');

  async function device(browser, viewport) {
    const ctx = await browser.newContext({ viewport });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => log.push(`PAGEERROR ${e.message}`));
    p.on('dialog', (d) => { log.push(`DIALOG ${d.message().split('\n')[0]}`); d.accept(); });
    await p.route('**/api/config', (r) => r.fulfill({ json: { supabaseUrl: 'https://fake.supabase.co', supabaseKey: 'sb_publishable_test' } }));
    await p.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: SDK, contentType: 'application/javascript' }));
    await p.route('**/api/digest**', (r) => r.fulfill({ json: { sent: [{ user: USER.id }], skipped: [], errors: [] } }));
    await p.route('https://fake.supabase.co/**', async (r) => {
      const req = r.request(); const url = new URL(req.url()); const method = req.method();
      const single = (req.headers().accept || '').includes('vnd.pgrst.object');
      if (url.pathname === '/auth/v1/otp') return r.fulfill({ json: {} });
      if (url.pathname === '/auth/v1/verify') {
        if (JSON.parse(req.postData()).token !== '123456') return r.fulfill({ status: 400, json: { error_code: 'otp_expired', msg: 'Token has expired or is invalid' } });
        return r.fulfill({ json: { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt', user: USER } });
      }
      if (url.pathname === '/auth/v1/user') return r.fulfill({ json: USER });
      if (url.pathname === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' });
      if (url.pathname === '/rest/v1/user_state') {
        if (method === 'GET') { const rows = db ? [{ data: db.data, updated_at: db.updated_at }] : []; return r.fulfill({ json: single ? (rows[0] ?? null) : rows }); }
        if (method === 'POST') { db = { data: JSON.parse(req.postData()).data, updated_at: pgTime() }; log.push('INSERT'); return r.fulfill({ status: 201, json: single ? { updated_at: db.updated_at } : [{ updated_at: db.updated_at }] }); }
        if (method === 'PATCH') {
          if (!db || (url.searchParams.get('updated_at') || '').replace(/^eq\./, '') !== db.updated_at) { log.push('PATCH-STALE'); return r.fulfill({ json: [] }); }
          db = { data: JSON.parse(req.postData()).data, updated_at: pgTime() }; log.push('PATCH'); return r.fulfill({ json: [{ updated_at: db.updated_at }] });
        }
      }
      log.push(`UNHANDLED ${method} ${url.pathname}`); return r.fulfill({ status: 404, json: {} });
    });
    await p.goto(server.url);
    await p.waitForSelector('[data-action="account"]', { state: 'attached' });
    return p;
  }
  const signIn = async (p) => {
    await p.evaluate(() => document.querySelector('[data-action="account"]').click());
    await p.fill('.acct-email', 'me@example.com'); await p.click('[data-action="send-link"]');
    await p.fill('.acct-code', '123456'); await p.click('[data-action="verify-code"]');
    await p.waitForFunction(() => window.Cloud.status === 'synced');
    await p.click('dialog .btn.primary');
  };

  const browser = await launch();
  const p = await device(browser, { width: 1280, height: 860 });
  // wrong code first
  await p.click('[data-action="account"]'); await p.fill('.acct-email', 'me@example.com'); await p.click('[data-action="send-link"]');
  await p.fill('.acct-code', '000000'); await p.click('[data-action="verify-code"]'); await p.waitForTimeout(300);
  check(log.some((l) => l.includes('Token has expired')), 'wrong code shows an error');
  await p.fill('.acct-code', '123456'); await p.click('[data-action="verify-code"]');
  await p.waitForFunction(() => window.Cloud.status === 'synced');
  await p.click('dialog .btn.primary');
  check(log.includes('INSERT') && db.data.trackers.length >= 8, 'first sign-in uploads this device\'s trackers');

  await p.click('.sb-item:has-text("Chores")'); await p.locator('.rec-done').first().click();
  await p.waitForFunction(() => window.Cloud.status === 'synced' && !JSON.parse(localStorage.getItem('trackers:sync')).dirty, null, { timeout: 5000 });
  check(db.data.trackers.find((t) => t.name === 'Chores').items.some((i) => i.history.length), 'changes auto-save to the account');

  db = { data: { ...db.data, trackers: db.data.trackers.map((t) => (t.name === 'Workouts' ? { ...t, name: 'Gym' } : t)) }, updated_at: pgTime() };
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForSelector('.sb-item:has-text("Gym")', { timeout: 5000 });
  check(true, 'a change made on another device is pulled in');

  db = { data: { ...db.data, trackers: db.data.trackers.map((t) => (t.name === 'Gym' ? { ...t, name: 'Gym (phone)' } : t)) }, updated_at: pgTime() };
  await p.locator('.rec-done').nth(1).click();
  await p.waitForFunction(() => window.Cloud.status === 'synced', null, { timeout: 6000 });
  check(log.includes('PATCH-STALE') && log.some((l) => l.includes('changed on this device and in your account')), 'edits on two devices trigger the conflict prompt');
  check(await p.locator('.sb-item:has-text("Gym (phone)")').count() === 1, 'choosing the account version applies it');

  const q = await device(browser, { width: 390, height: 844 });
  await signIn(q);
  check((await q.$$eval('.tracker-card .tc-name', (e) => e.map((x) => x.innerText))).includes('Gym (phone)'), 'a second device gets the account\'s trackers');

  await p.click('[data-action="settings"]'); await p.click('[data-action="send-test-email"]');
  await p.waitForFunction(() => document.querySelector('[data-action="send-test-email"]').innerText.includes('Sent'));
  check(true, 'Send test email reports success');
  await p.click('dialog [data-action="close-modal"]');
  await p.click('[data-action="account"]'); await p.click('[data-action="sign-out"]');
  await p.waitForFunction(() => window.Cloud.status === 'signed-out');
  check(await p.locator('.sb-nav a.sb-item').count() > 5, 'signing out keeps the trackers on the device');
  check(!log.some((l) => l.startsWith('PAGEERROR') || l.startsWith('UNHANDLED')), `no page errors or unexpected requests ${log.filter((l) => /PAGEERROR|UNHANDLED/.test(l)).join('; ')}`);
  await browser.close(); server.close();
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
