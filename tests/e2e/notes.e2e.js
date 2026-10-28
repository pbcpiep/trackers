// Notes layout uses the real page with only the external Notes service replaced.
const { launch, startStaticServer, check, OUT } = require('./helpers');

const NOTES = [
  { folder: 'bills', title: 'Internet', body: 'Internet\n$65 due Oct 20' },
  { folder: 'bills', title: 'Payment date', body: 'Payment date\n10.20.2026' },
  { folder: 'shop/lists', title: 'No-space dot', body: 'No-space dot\n1.Milk' },
  { folder: 'shop/lists', title: 'No-space parenthesis', body: 'No-space parenthesis\n1)Milk' },
  { folder: 'shop/lists', title: 'Groceries', body: 'Groceries\n1. Milk' },
  { folder: 'shop/lists', title: 'Single decimal', body: 'Single decimal\n1.5 lb beef' },
  { folder: 'shop/lists', title: 'Decimal list', body: 'Decimal list\n1.5 lb beef\n2.5 lb chicken' },
  { folder: 'shop/lists', title: '- Milk', body: '- Milk' },
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
    for (const [title, item] of [['Internet', '$65 due Oct 20'], ['Payment date', '10.20.2026'], ['No-space dot', 'Milk'], ['No-space parenthesis', 'Milk'], ['Groceries', 'Milk'], ['Single decimal', '1.5 lb beef']]) {
      const card = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: title }) }).first();
      const summary = card.locator('summary');
      const summaryText = (await summary.innerText()).trim();
      check(title.startsWith('No-space') ? summaryText.endsWith(`· ${item}`) : summaryText.includes(item), `${title}: one item is visible without opening the note`);
      const box = await summary.boundingBox();
      check(box.height <= 50, `${title}: single-item summary takes only one text line on a phone`);
      await summary.click();
      check(await card.locator('.note-body').innerText() === NOTES.find((n) => n.title === title).body, `${title}: opening keeps the complete original note`);
      check(await card.locator('.note-meta').isVisible(), `${title}: folder and edited date remain available when opened`);
      if (['No-space dot', 'No-space parenthesis', 'Groceries', 'Single decimal'].includes(title)) {
        const addButton = card.locator('[data-action="notes-to-shopping"]');
        await addButton.click();
        if (title === 'No-space parenthesis') check((await addButton.innerText()).includes('Already on your list'), '1)Milk is recognized as the same item already imported from 1.Milk');
        await p.goto(server.url + '#/t/' + await p.evaluate(() => JSON.parse(localStorage.getItem('trackers:v1')).trackers.find((t) => t.shop).id));
        const shoppingItems = await p.locator('.title-input').evaluateAll((els) => els.map((el) => el.value));
        check(shoppingItems.includes(item), `${title}: compact note preserves its item in Shopping List`);
        if (title === 'No-space dot' || title === 'No-space parenthesis') check(!shoppingItems.includes('1.Milk') && !shoppingItems.includes('1)Milk'), `${title}: imports the item text without its list marker`);
        await p.goto(server.url + '#/notes');
        await p.waitForSelector('.note-card');
      } else await summary.click();
    }
    const bread = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: 'Bread' }) });
    check((await bread.locator('summary').innerText()).trim() === 'Bread', 'title-only note is shown once, without an empty preview');
    const markedTitle = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: '- Milk' }) });
    check((await markedTitle.locator('summary').innerText()).trim() === '- Milk', 'title-only bullet note is not duplicated');
    check(await markedTitle.locator('[data-action="notes-to-shopping"]').count() === 0, 'title-only bullet note does not offer an empty shopping import');
    const decimalList = p.locator('.note-card').filter({ has: p.locator('.note-title', { hasText: 'Decimal list' }) });
    const decimalPreview = await decimalList.locator('summary').innerText();
    check(decimalPreview.includes('1.5 lb beef') && decimalPreview.includes('2.5 lb chicken'), 'multi-item preview preserves decimal quantities');
    await decimalList.locator('summary').click();
    check(await decimalList.locator('.note-body').innerText() === NOTES.find((n) => n.title === 'Decimal list').body, 'decimal list keeps the complete original note');
    await decimalList.locator('[data-action="notes-to-shopping"]').click();
    await p.goto(server.url + '#/t/' + await p.evaluate(() => JSON.parse(localStorage.getItem('trackers:v1')).trackers.find((t) => t.shop).id));
    const shoppingItems = await p.locator('.title-input').evaluateAll((els) => els.map((el) => el.value));
    check(['1.5 lb beef', '2.5 lb chicken'].every((item) => shoppingItems.includes(item)), 'shopping import preserves both decimal quantities');
    await p.goto(server.url + '#/notes');
    await p.waitForSelector('.note-card');
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
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: `${OUT}/notes-compact-phone.png`, fullPage: true });
    await p.setViewportSize({ width: 1280, height: 900 });
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notes page also fits desktop width');
    check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
    console.log(`  Screenshot: ${OUT}/notes-compact-phone.png`);
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
