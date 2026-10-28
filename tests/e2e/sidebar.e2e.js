// Regression: swiping the phone menu must not scroll Home behind its backdrop.
const { launch, fileUrl, check, OUT } = require('./helpers');

(async () => {
  const browser = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 420 } });
    await p.goto(fileUrl());
    await p.evaluate(() => window.scrollTo(0, 250));
    const before = await p.evaluate(() => scrollY);
    check(before > 0, 'start with Home partly scrolled');
    await p.click('[data-action="open-sidebar"]');
    await p.mouse.move(350, 300);
    await p.mouse.wheel(0, 350);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => scrollY) === before, 'open menu backdrop prevents background page scrolling');

    await p.mouse.move(120, 300);
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(300);
    check(await p.locator('.sidebar').evaluate((el) => el.scrollTop) > 0, 'long phone menu still scrolls to its bottom controls');
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => scrollY) === before, 'scrolling beyond the end of the menu does not move Home');
    await p.setViewportSize({ width: 390, height: 844 });
    for (const selector of ['.sidebar', '.scrim']) {
      const box = await p.locator(selector).boundingBox();
      check(Math.abs(box.y) < 1 && Math.abs(box.y + box.height - 844) < 1, `${selector} fills the visible phone height after resize`);
    }
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'open menu has no sideways scrolling at 390px');
    await p.screenshot({ path: `${OUT}/phone-menu.png` });
    await p.mouse.click(350, 300);
    check(await p.evaluate(() => !document.querySelector('.app').classList.contains('sb-open') && scrollY === 250), 'closing menu returns to the same Home position');
    await p.locator('.scrim').waitFor({ state: 'hidden' });
    await p.mouse.move(340, 400);
    await p.waitForTimeout(250); // Let the closing transition and browser scroll hit-testing finish.
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => scrollY) > before, 'Home scrolls normally after closing the menu');

    await p.click('[data-action="open-sidebar"]');
    await p.locator('.sidebar').evaluate((el) => { el.scrollTop = 0; });
    await p.click('.sb-item:has-text("Chores")');
    await p.waitForSelector('.page-title[value="Chores"]');
    check(await p.evaluate(() => !document.querySelector('.app').classList.contains('sb-open') && scrollY === 0), 'choosing a tracker closes the menu and opens the page at the top');
    await p.setViewportSize({ width: 1280, height: 700 });
    await p.mouse.move(900, 400);
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => scrollY) > 0, 'desktop page scrolling stays available');
    console.log(`  Screenshot: ${OUT}/phone-menu.png`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
