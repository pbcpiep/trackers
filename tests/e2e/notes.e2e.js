// Notes layout uses the real page with only the external Notes service replaced.
const { launch, startStaticServer, check, OUT } = require('./helpers');

const NOTES = [
  { folder: 'bills', title: 'Internet', body: 'Internet\n$65 due Oct 20' },
  { folder: 'bills', title: 'Payment date', body: 'Payment date\n10.20.2026' },
  { folder: 'shop/lists', title: 'Groceries', body: 'Groceries\n- Milk' },
  { folder: 'shop/lists', title: 'Bread', body: 'Bread\n\n' },
  { folder: 'shop/lists', title: 'Weekend', body: 'Weekend\n- Eggs\n- Coffee' },
  { folder: 'bills', title: 'Electric', body: 'Electric\nDue Oct 15\n$84.20 autopay' },
  { folder: 'bills', title: '<img src=x onerror=window.PWNED=1>', body: '<script>window.PWNED=2</script>' },
  { folder: 'shop/lists', title: 'Long'.repeat(80), body: 'Item'.repeat(100) },
].map((n) => ({ ...n, modified_at: '2026-10-10T12:00:00Z', synced_at: '2026-10-12T08:00:00Z' }));

(async () => {
  const server = await startStaticServer();
  const browser = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/cloud.js', (r) => r.fulfill({ contentType: 'application/javascript', body: `window.Cloud = {
      enabled: true, user: { email: 'test@example.com' }, status: 'synced',
      init() {}, changed() {}, fetchNotes: async () => ${JSON.stringify(NOTES)}
    };` }));
    await p.goto(server.url + '#/notes');
    await p.waitForSelector('.note-card');
    for (const [title, item] of [['Internet', '$65 due Oct 20'], ['Payment date', '10.20.2026'], ['Groceries', 'Milk']]) {
      const card = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: title }) }).first();
      const summary = card.locator('summary');
      check((await summary.innerText()).includes(item), `${title}: one item is visible without opening the note`);
      const box = await summary.boundingBox();
      check(box.height <= 50, `${title}: single-item summary takes only one text line on a phone`);
      await summary.click();
      check(await card.locator('.note-body').innerText() === NOTES.find((n) => n.title === title).body, `${title}: opening keeps the complete original note`);
      check(await card.locator('.note-meta').isVisible(), `${title}: folder and edited date remain available when opened`);
      if (title === 'Groceries') {
        await card.locator('[data-action="notes-to-shopping"]').click();
        await p.goto(server.url + '#/t/' + await p.evaluate(() => JSON.parse(localStorage.getItem('trackers:v1')).trackers.find((t) => t.shop).id));
        check(await p.locator('.title-input').evaluateAll((els) => els.some((el) => el.value === 'Milk')), 'compact note still adds its item to Shopping List');
        await p.goto(server.url + '#/notes');
        await p.waitForSelector('.note-card');
      } else await summary.click();
    }
    const bread = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: 'Bread' }) });
    check((await bread.locator('summary').innerText()).trim() === 'Bread', 'title-only note is shown once, without an empty preview');
    for (const title of ['Weekend', 'Electric']) {
      const card = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: title }) });
      check(await card.locator('.note-preview').isVisible(), `${title}: multi-item note keeps its preview`);
      await card.locator('summary').click();
      check(await card.locator('.note-body').innerText() === NOTES.find((n) => n.title === title).body, `${title}: all lines remain readable`);
    }
    check(await p.evaluate(() => window.PWNED) === undefined && await p.locator('.note-card img, .note-card script').count() === 0, 'single-item note text is escaped');
    await p.locator('.note-card').last().locator('summary').click();
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notes page has no sideways scrolling at 390px, including an expanded long note');
    await p.locator('.note-card').last().locator('summary').click();
    await p.screenshot({ path: `${OUT}/notes-compact-phone.png`, fullPage: true });
    await p.setViewportSize({ width: 1280, height: 900 });
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notes page also fits desktop width');
    check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
    console.log(`  Screenshot: ${OUT}/notes-compact-phone.png`);
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
