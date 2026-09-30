// Shared helpers for the browser tests. Run them with:  npm run test:e2e
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'trackers-e2e-')); // screenshots land here

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  try { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch (e) { /* fall through */ }
  console.error('Playwright not found. Install it with:  npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}

async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch();
}

const fileUrl = (hash = '') => `file://${path.join(ROOT, 'index.html')}${hash}`;

/** Serves the repo over http:// (needed for the cloud-sync test). Returns { url, close }. */
function startStaticServer() {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = p.endsWith(path.sep) ? path.join(p, 'index.html') : p;
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

/** Throws (fails the test) when a condition is false. */
function check(cond, msg) {
  if (!cond) throw new Error(`Check failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

module.exports = { ROOT, OUT, loadPlaywright, launch, fileUrl, startStaticServer, check };
