/*
 * Optional cloud sync through Supabase. Active only when the app is served with
 * /api/config returning Supabase credentials (i.e. deployed on Vercel);
 * otherwise the app stays in local-only mode.
 *
 * All of a user's trackers live in one JSON document (table user_state).
 * Writes are conditional on the updated_at we last saw, so a stale device can't
 * silently overwrite newer changes made elsewhere.
 */
(() => {
  'use strict';

  const META_KEY = 'trackers:sync';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  const Cloud = { enabled: false, status: 'local', error: null, user: null };
  let client = null;
  let app = null;
  let pushTimer = null;
  let version = 0; // bumps on every local change
  let chain = Promise.resolve();
  // Serialize sync operations so a pull and a push never interleave.
  const run = (fn) => (chain = chain.then(() => fn().catch((e) => failed(e))));

  function meta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } }
  function setMeta(patch) { try { localStorage.setItem(META_KEY, JSON.stringify({ ...meta(), ...patch })); } catch (e) { /* ignore */ } }
  function setStatus(status, error) { Cloud.status = status; Cloud.error = error || null; if (app) app.onStatus(); }
  const failed = (err) => setStatus(navigator.onLine ? 'error' : 'offline', err && err.message);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the sync library.'));
      document.head.appendChild(s);
    });
  }

  Cloud.init = async (hooks) => {
    app = hooks;
    if (location.protocol === 'file:') return;
    let cfg = null;
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) cfg = await r.json();
    } catch (e) { /* not deployed with an API: local mode */ }
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) return;

    try { await loadScript(SDK_URL); } catch (e) { setStatus('error', e.message); return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
    Cloud.enabled = true;
    setStatus('signed-out');

    // Supabase advises against awaiting its own calls inside this callback.
    client.auth.onAuthStateChange((_event, session) => setTimeout(() => onSession(session), 0));
    const { data } = await client.auth.getSession();
    onSession(data.session);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Cloud.user) run(pull);
    });
    window.addEventListener('online', () => { if (Cloud.user) run(meta().dirty ? push : pull); });
  };

  function onSession(session) {
    const u = session ? session.user : null;
    if ((u && u.id) === (Cloud.user && Cloud.user.id)) return;
    Cloud.user = u ? { id: u.id, email: u.email } : null;
    if (!u) { setStatus('signed-out'); return; }
    if (location.hash.includes('access_token=')) history.replaceState(null, '', location.pathname + location.search);
    run(pull);
  }

  async function pull() {
    if (!Cloud.user) return;
    const uid = Cloud.user.id;
    setStatus('syncing');
    const { data: row, error } = await client.from('user_state').select('data, updated_at').eq('user_id', uid).maybeSingle();
    if (error) return failed(error);

    const m = meta();
    if (!row) return insert();
    if (m.userId === uid && m.remoteAt === row.updated_at) {
      if (m.dirty) return push();
      return setStatus('synced');
    }
    // The account copy changed elsewhere (or this device hasn't synced with it yet).
    if (m.dirty && !confirm('Your trackers were changed on this device and in your account.\n\nOK: use the version saved in your account\nCancel: keep this device’s version and upload it')) {
      setMeta({ userId: uid, remoteAt: row.updated_at });
      return push();
    }
    app.setState(row.data);
    setMeta({ userId: uid, remoteAt: row.updated_at, dirty: false });
    setStatus('synced');
  }

  async function insert() {
    const uid = Cloud.user.id;
    const { data, error } = await client.from('user_state')
      .insert({ user_id: uid, data: app.getState(), updated_at: new Date().toISOString() })
      .select('updated_at').single();
    if (error) return failed(error);
    setMeta({ userId: uid, remoteAt: data.updated_at, dirty: false });
    setStatus('synced');
  }

  async function push() {
    clearTimeout(pushTimer);
    if (!Cloud.user) return;
    const m = meta();
    if (m.userId !== Cloud.user.id) return pull();
    const sentVersion = version;
    setStatus('syncing');
    const { data, error } = await client.from('user_state')
      .update({ data: app.getState(), updated_at: new Date().toISOString() })
      .eq('user_id', Cloud.user.id)
      .eq('updated_at', m.remoteAt)
      .select('updated_at');
    if (error) return failed(error);
    if (!data.length) return pull(); // another device saved first
    const dirty = version !== sentVersion;
    setMeta({ remoteAt: data[0].updated_at, dirty });
    if (dirty) schedulePush(); else setStatus('synced');
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => run(push), 1200);
  }

  /** Call after every local change. */
  Cloud.changed = () => {
    if (!client) return;
    version++;
    setMeta({ dirty: true });
    if (Cloud.user) { setStatus('pending'); schedulePush(); }
  };

  Cloud.sendLink = async (email) => {
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  };

  Cloud.verifyCode = async (email, token) => {
    const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  };

  Cloud.signOut = async () => {
    clearTimeout(pushTimer);
    if (meta().dirty && Cloud.user) await run(push);
    await client.auth.signOut();
    setMeta({ userId: null, remoteAt: null, dirty: false });
  };

  Cloud.accessToken = async () => {
    const { data } = await client.auth.getSession();
    return data.session ? data.session.access_token : null;
  };

  window.Cloud = Cloud;
})();
