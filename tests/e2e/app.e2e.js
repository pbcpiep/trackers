// Core flows: Home, habits, chores (recurring), tasks, settings, phone layout.
const { launch, fileUrl, check, OUT } = require('./helpers');

(async () => {
  const browser = await launch();
  const errors = [];
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => d.accept());
  const iso = (n) => p.evaluate((k) => TrackerCore.addDays(TrackerCore.toISO(new Date()), k), n);
  await p.goto(fileUrl());

  const sidebar = await p.$$eval('.sb-nav a.sb-item .sb-label', (e) => e.map((x) => x.innerText));
  check(['Daily Habits', 'Tasks', 'Chores', 'Shopping List', 'Spanish', 'Friends & Family'].every((n) => sidebar.includes(n)), 'default trackers are present');
  check(await p.locator('[data-action="account"]').count() === 0, 'no sync button in local (file://) mode');

  // Habits from Home
  await p.locator('.today-item').first().click();
  check((await p.innerText('.today .card-head .muted')).startsWith('1 of'), 'checking a habit on Home updates the count');

  // Chores: log past dates → grouping
  await p.click('.sb-item:has-text("Chores")');
  await p.waitForSelector('.page-title[value="Chores"]');
  const logPast = async (name, daysAgo) => {
    await p.click(`.rec-name:has-text("${name}")`);
    await p.fill('.log-date', await iso(-daysAgo));
    await p.click('[data-action="log-date"]');
    await p.click('dialog button[type=submit]');
  };
  await logPast('Vacuum', 10);
  await logPast('Laundry', 7);
  check((await p.innerText('.rec-item:has-text("Vacuum") .rec-pill')) === 'Overdue by 3 days', 'weekly chore last done 10 days ago is overdue by 3 days');
  check((await p.innerText('.rec-item:has-text("Laundry") .rec-pill')) === 'Due today', 'weekly chore last done 7 days ago is due today');
  await p.locator('.rec-item:has-text("Water plants") .rec-done').click();
  check((await p.innerText('.rec-item:has-text("Water plants") .rec-done')).includes('today'), 'Done marks today');

  // Tasks: due date reminder + Home due list + complete
  await p.click('.sb-item:has-text("Tasks")');
  await p.waitForSelector('.page-title[value="Tasks"]');
  await p.click('.tools [data-action="add-row"]');
  await p.keyboard.type('Finish report'); await p.keyboard.press('Enter'); await p.waitForTimeout(50);
  const row = '.db tbody tr:has(input.title-input[value="Finish report"])';
  await p.fill(`${row} input[type=date]`, await iso(0)); await p.press(`${row} input[type=date]`, 'Tab'); await p.waitForTimeout(50);
  await p.click('.sb-item:has-text("Home")'); await p.waitForSelector('.due-card');
  const due = await p.$$eval('.due-name', (e) => e.map((x) => x.innerText));
  check(due.includes('Vacuum') && due.includes('Laundry') && due.includes('Finish report'), 'Home "Due" lists overdue chores and tasks due today');
  await p.locator('.due-row:has-text("Finish report") [data-action="complete-task"]').click();
  check(!(await p.$$eval('.due-name', (e) => e.map((x) => x.innerText))).includes('Finish report'), 'completing a task removes it from Due');

  // Hidden fields really hide (regression: .field display:flex overrode [hidden])
  await p.click('.sb-item:has-text("Tasks")'); await p.waitForSelector('.page-title[value="Tasks"]');
  await p.locator('.th-btn:has-text("Due")').click(); await p.click('.menu-item:has-text("Edit property")');
  check(await p.isChecked('input[name=remind]'), 'Tasks "Due" column has reminders on');
  await p.selectOption('select[name=type]', 'text');
  check(await p.isHidden('.remind-field'), 'reminder option hides for non-date types');
  await p.click('dialog [data-action="close-modal"]');

  // Settings: finance link
  await p.click('[data-action="settings"]');
  await p.fill('input[name=financeUrl]', 'https://budget.example.com');
  await p.click('dialog button[type=submit]');
  check(await p.getAttribute('.sb-finance', 'href') === 'https://budget.example.com', 'Actual Budget link appears in the sidebar');

  // Persistence
  await p.reload();
  check(await p.locator('.sb-finance').count() === 1, 'data survives a reload');

  // Phone layout
  await p.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Home', 'Chores', 'Tasks', 'Shopping List']) {
    await p.click('[data-action=open-sidebar]'); await p.click(`.sb-item:has-text("${name}")`); await p.waitForTimeout(250);
    check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `no sideways scrolling on a phone: ${name}`);
  }
  await p.screenshot({ path: `${OUT}/phone.png`, fullPage: true });
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
  await browser.close();
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
