// Daily email digest: what's overdue, due today and due tomorrow.
//
// Called two ways:
//  - by Vercel Cron (Authorization: Bearer $CRON_SECRET): emails every user
//    who has something due and hasn't turned the digest off;
//  - from the app's Settings → "Send test email" (Authorization: Bearer
//    <the signed-in user's Supabase access token>): emails only that user,
//    even if nothing is due.
const core = require('../core.js');

const env = (name, fallback) => process.env[name] || (fallback ? process.env[fallback] : '') || '';

function supabaseHeaders(key) {
  const h = { apikey: key };
  // Legacy anon/service_role keys are JWTs and also go in Authorization.
  // Newer sb_secret_/sb_publishable_ keys only go in the apikey header.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers });
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
  const secretKey = env('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = env('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY') || secretKey;
  if (!url || !secretKey || !env('RESEND_API_KEY')) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL, SUPABASE_SECRET_KEY or RESEND_API_KEY.' });
  }

  const auth = req.headers.authorization || '';
  const cronSecret = env('CRON_SECRET');
  const isCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

  let onlyUser = null;
  if (!isCron) {
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      onlyUser = await getJson(`${url}/auth/v1/user`, { apikey: publicKey, Authorization: `Bearer ${token}` });
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const admin = supabaseHeaders(secretKey);
  const allowed = env('ALLOWED_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const appUrl = env('APP_URL') || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const results = { sent: [], skipped: [], errors: [] };

  let rows;
  try {
    const filter = onlyUser ? `&user_id=eq.${encodeURIComponent(onlyUser.id)}` : '';
    rows = await getJson(`${url}/rest/v1/user_state?select=user_id,data${filter}`, admin);
  } catch (e) {
    return res.status(502).json({ error: `Could not read trackers: ${e.message}` });
  }

  for (const row of rows) {
    try {
      const state = row.data || {};
      const settings = state.settings || {};
      const digestOn = !(settings.digest && settings.digest.enabled === false);
      if (!onlyUser && !digestOn) { results.skipped.push({ user: row.user_id, reason: 'digest off' }); continue; }

      const email = onlyUser ? onlyUser.email : (await getJson(`${url}/auth/v1/admin/users/${row.user_id}`, admin)).email;
      if (!email) { results.skipped.push({ user: row.user_id, reason: 'no email' }); continue; }
      if (allowed.length && !allowed.includes(email.toLowerCase())) { results.skipped.push({ user: row.user_id, reason: 'not in ALLOWED_EMAILS' }); continue; }

      const today = core.todayIn(settings.timezone);
      const digest = core.buildDigest(state, today, { appUrl });
      if (!onlyUser && digest.count === 0 && digest.tomorrow.length === 0) {
        results.skipped.push({ user: row.user_id, reason: 'nothing due' });
        continue;
      }
      await sendEmail({ to: email, subject: onlyUser ? `[Test] ${digest.subject}` : digest.subject, html: digest.html, text: digest.text });
      results.sent.push({ user: row.user_id, due: digest.count });
    } catch (e) {
      results.errors.push({ user: row.user_id, error: e.message });
    }
  }

  if (onlyUser && !rows.length) results.errors.push({ user: onlyUser.id, error: 'No synced trackers yet. Make a change in the app first.' });
  res.status(results.errors.length && !results.sent.length ? 502 : 200).json(results);
};
