// Imported/synced data must not be able to inject markup or script.
const fs = require('fs');
const path = require('path');
const { launch, fileUrl, check, OUT } = require('./helpers');

const evil = {
  trackers: [
    { id: 'x"><img src=x onerror=window.PWNED=1>', kind: 'recurring', name: '<b>Evil</b>', icon: '💀', items: [
      { id: 'i"><img src=x onerror=window.PWNED=2>', name: '<script>', every: '2"><img src=x onerror=window.PWNED=3>', unit: 'weeks',
        phone: '"><img src=x onerror=window.PWNED=8>', history: ['2026-09-01', '"><img src=x onerror=window.PWNED=4>'] }] },
    { id: 'db', kind: 'database', name: 'T', properties: [
      { id: 'p1', name: 'N', type: 'text' }, { id: 'p2', name: 'D', type: 'date', remind: true },
      { id: 'p3', name: 'S', type: 'select', options: [{ id: 'o1', name: 'A', color: 'red"><img src=x onerror=window.PWNED=5>' }] }],
      rows: [{ id: 'r1', values: { p1: '<img src=x onerror=window.PWNED=6>', p2: '"><img src=x onerror=window.PWNED=7>', p3: 'o1' } }] },
    { id: 'h', kind: 'habit', name: 'H', habits: [{ id: 'h1', name: 'x', icon: 'x', color: 'blue', link: 'javascript:window.PWNED=9' }], log: {} },
  ],
};

(async () => {
  const file = path.join(OUT, 'evil.json');
  fs.writeFileSync(file, JSON.stringify(evil));
  const browser = await launch();
  const p = await browser.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(fileUrl());
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-action="import"]')]);
  await fc.setFiles(file);
  await p.waitForSelector('.sb-item:has-text("Evil")');
  for (const name of ['Evil', 'T', 'H', 'Home']) { await p.click(`.sb-item:has-text("${name}")`); await p.waitForTimeout(150); }
  await p.click('.sb-item:has-text("Evil")'); await p.waitForTimeout(150); await p.click('.rec-name'); await p.waitForTimeout(150);
  check(await p.evaluate(() => window.PWNED) === undefined, 'malicious import does not run script');
  check(await p.locator('.open-link[href^="javascript"]').count() === 0, 'javascript: habit link is not rendered');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
  await browser.close();
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
