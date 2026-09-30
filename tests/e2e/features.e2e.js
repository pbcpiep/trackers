// One-tap habit links, friend Message/Call buttons, universal shopping list.
const { launch, fileUrl, check } = require('./helpers');

(async () => {
  const browser = await launch();
  const errors = []; const dialogs = [];
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => { dialogs.push(d.message()); return d.type() === 'prompt' ? d.accept('Language Transfer') : d.accept(); });
  await p.goto(fileUrl());

  check(await p.getAttribute('.today-list li:has-text("Language Transfer") .open-link', 'href') === 'https://www.languagetransfer.org/', 'Spanish habit links to Language Transfer');
  await p.click('.sb-item:has-text("Spanish")'); await p.waitForSelector('.page-title[value="Spanish"]');
  await p.click('.hn-btn:has-text("Review flashcards")');
  await p.fill('input[name=link]', 'javascript:alert(1)'); await p.click('dialog button[type=submit]');
  check(dialogs.length === 1 && await p.isVisible('dialog'), 'javascript: links are rejected');
  await p.fill('input[name=link]', 'ankiweb.net'); await p.click('dialog button[type=submit]');
  check(await p.getAttribute('.habit-name:has-text("flashcards") .open-link', 'href') === 'https://ankiweb.net', 'bare domains get https://');
  await p.click('.hn-btn:has-text("Language Transfer")');
  await p.click('[data-action="shortcut-link"]');
  check(await p.inputValue('input[name=link]') === 'shortcuts://run-shortcut?name=Open%20Language%20Transfer', 'iPhone Shortcut link is generated');
  await p.click('dialog [data-action="close-modal"]');

  // Friends
  await p.click('.sb-item:has-text("Friends")'); await p.waitForSelector('.page-title[value="Friends & Family"]');
  await p.click('.rec-name:has-text("Best friend")');
  await p.fill('input[name=phone]', '+1 (555) 123-4567'); await p.click('dialog button[type=submit]');
  const links = await p.$$eval('.rec-item:has-text("Best friend") .contact-btn', (a) => a.map((x) => x.getAttribute('href')));
  check(links[0] === 'sms:+15551234567' && links[1] === 'tel:+15551234567', 'phone number adds Message and Call links');
  await p.click('.rec-name:has-text("Mom & Dad")');
  await p.fill('input[name=phone]', '+1 555 987 6543'); await p.check('input[name=whatsapp]'); await p.click('dialog button[type=submit]');
  check(await p.getAttribute('.rec-item:has-text("Mom") .contact-btn >> nth=0', 'href') === 'https://wa.me/15559876543', 'WhatsApp option uses wa.me');

  // Shopping
  await p.click('.sb-item:has-text("Shopping")'); await p.waitForSelector('.shop-add');
  const add = async (v) => { await p.fill('[data-key="add-shop"]', v); await p.press('[data-key="add-shop"]', 'Enter'); await p.waitForTimeout(40); };
  await add('https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones-Hands-Free/dp/B09XS7JWHH/ref=sr_1_3');
  await add('https://www.bestbuy.com/site/apple-airpods-pro-2nd-generation-white/6447382.p?skuId=6447382');
  await add('usb-c charging cable');
  const rows = await p.$$eval('.db tbody tr', (trs) => trs.map((tr) => [tr.querySelector('.title-input').value, tr.querySelector('select').selectedOptions[0].text]));
  check(rows[0][0] === 'Sony WH 1000XM5 Canceling Headphones Hands Free' && rows[0][1] === 'Amazon', 'Amazon link → item name + store');
  check(rows[1][0] === 'Apple airpods pro 2nd generation white' && rows[1][1] === 'Best Buy', 'Best Buy link → item name + store');
  await p.click('tr:has(input[value="usb-c charging cable"]) .shop-btn');
  const menu = await p.$$eval('.shop-pop a', (a) => a.map((x) => x.href));
  check(menu[0] === 'https://www.amazon.com/s?k=usb-c%20charging%20cable' && menu[1] === 'https://www.bestbuy.com/site/searchpage.jsp?st=usb-c%20charging%20cable', 'store picker searches Amazon then Best Buy');
  check(menu.at(-1).startsWith('https://www.google.com/search?tbm=shop&q='), 'store picker offers compare-everywhere');
  await p.keyboard.press('Escape');
  await p.click('.tools [data-action="add-row"]');
  await p.keyboard.type('https://www.walmart.com/ip/Great-Value-Paper-Towels-6-Rolls/123456'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  check(await p.$eval('.db tbody tr:last-child .title-input', (e) => e.value) === 'Great Value Paper Towels 6 Rolls', 'pasting a link into the name cell converts it');

  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
  await browser.close();
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
