// Daily email digest: what's overdue, due today and due tomorrow.
//
// Called two ways:
//  - by Vercel Cron (Authorization: Bearer $CRON_SECRET): emails every user
//    who has something due and hasn't turned the digest off;
//  - from the app's Settings → "Send test email" (Authorization: Bearer
//    <the signed-in user's Supabase access token>): emails only that user,
//    even if nothing is due.
//
// No Supabase master key is needed. Cron mode calls the digest_rows() database
// function with CRON_SECRET (the same secret is stored in private.app_secrets);
// test mode reads the user's own row with their own token (row-level security).
const core = require('../core.js');

const env = (name, fallback) => process.env[name] || (fallback ? process.env[fallback] : '') || '';

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).pathname}`);
  return r.json();
}

async function sendEmail({ to, subject, html, text }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('DIGEST_FROM') || 'Trackers <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

module.exports = async (req, res) => {
  const url = env('SUPABASE_URL');
  const publicKey = env('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  const cronSecret = env('CRON_SECRET');
  if (!url || !publicKey || !env('RESEND_API_KEY') || !cronSecret) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, RESEND_API_KEY or CRON_SECRET.' });
  }

  const auth = req.headers.authorization || '';
  const isCron = auth === `Bearer ${cronSecret}`;
  const allowed = env('ALLOWED_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const appUrl = env('APP_URL') || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const results = { sent: [], skipped: [], errors: [] };

  // rows: [{ user_id, email, data }]
  let rows;
  let testMode = false;
  try {
    if (isCron) {
      rows = await fetchJson(`${url}/rest/v1/rpc/digest_rows`, {
        method: 'POST',
        headers: { apikey: publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_secret: cronSecret }),
      });
    } else {
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const userHeaders = { apikey: publicKey, Authorization: `Bearer ${token}` };
      let user;
      try { user = await fetchJson(`${url}/auth/v1/user`, { headers: userHeaders }); } catch (e) { return res.status(401).json({ error: 'Unauthorized' }); }
      const own = await fetchJson(`${url}/rest/v1/user_state?select=user_id,data&user_id=eq.${encodeURIComponent(user.id)}`, { headers: userHeaders });
      rows = own.map((r) => ({ ...r, email: user.email }));
      testMode = true;
      if (!rows.length) results.errors.push({ user: user.id, error: 'No synced trackers yet. Make a change in the app first.' });
    }
  } catch (e) {
    return res.status(502).json({ error: `Could not read trackers: ${e.message}` });
  }

  for (const row of rows) {
    try {
      const state = row.data || {};
      const settings = state.settings || {};
      const digestOn = !(settings.digest && settings.digest.enabled === false);
      if (!testMode && !digestOn) { results.skipped.push({ user: row.user_id, reason: 'digest off' }); continue; }
      if (!row.email) { results.skipped.push({ user: row.user_id, reason: 'no email' }); continue; }
      if (allowed.length && !allowed.includes(row.email.toLowerCase())) { results.skipped.push({ user: row.user_id, reason: 'not in ALLOWED_EMAILS' }); continue; }

      const today = core.todayIn(settings.timezone);
      const digest = core.buildDigest(state, today, { appUrl });
      if (!testMode && digest.count === 0 && digest.tomorrow.length === 0) {
        results.skipped.push({ user: row.user_id, reason: 'nothing due' });
        continue;
      }
      await sendEmail({ to: row.email, subject: testMode ? `[Test] ${digest.subject}` : digest.subject, html: digest.html, text: digest.text });
      results.sent.push({ user: row.user_id, due: digest.count });
    } catch (e) {
      results.errors.push({ user: row.user_id, error: e.message });
    }
  }

  res.status(results.errors.length && !results.sent.length ? 502 : 200).json(results);
};
