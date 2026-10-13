// Promo screenshot shooter (temporary dev tool — delete after the video is built).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.SHOOT_DIR || 'C:\\Users\\AbdulMalek\\AppData\\Local\\Temp\\opencode\\promo\\shots';
fs.mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  locale: 'bn-BD',
  timezoneId: 'Asia/Dhaka',
});
const page = await ctx.newPage();
page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 200)}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text().slice(0, 200)}`);
});

// 1-3: Bengali landing
await page.goto('http://localhost:3000/bn', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot(page, '01-hero-bn.png');
await page.locator('.landing-features').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await shot(page, '02-features.png');
await page.locator('main section').last().scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await shot(page, '03-cta.png');

// 4: English landing hero
await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot(page, '04-hero-en.png');

// 5: About page
await page.goto('http://localhost:3000/bn/about', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot(page, '05-about.png');

// 6: Join screen
await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot(page, '06-join.png');

// 7: Register a demo guest
await page.getByRole('button', { name: /অ্যাকাউন্ট নেই|Need an account/ }).click();
await page.locator('input[name="displayName"]').fill('Promo Guest');
await page.locator('input[name="email"]').fill(`promo${Date.now()}@example.com`);
await page.locator('input[name="password"]').fill('1234');
await page.locator('form button[type="submit"]').click();
await page.locator('.app-shell').waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
await shot(page, '07-app-today.png');

// Add three demo routines so the schedule looks alive
const routines = [
  ['ফজরের নামাজ', '05:00', '05:30'],
  ['সকালের হাঁটা', '06:30', '07:00'],
  ['পড়াশোনা', '10:00', '11:00'],
];
for (const [title, start, end] of routines) {
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="startTime"]').fill(start);
  await page.locator('input[name="endTime"]').fill(end);
  await page.locator('form button[type="submit"]', { hasText: /রুটিন যোগ|Add routine/ }).click();
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(1500);

// 8: Prayer card (enable it in settings, then Netrokona times load automatically)
await page.locator('.app-tabs').getByRole('button', { name: /বিশ্বাস ও অ্যাকাউন্ট|Trust/ }).click();
await page.waitForTimeout(800);
await page.locator('section').filter({ hasText: /নামাজের ওয়াক্ত প্রদর্শন|Show Prayer Times/ }).getByRole('button').first().click();
await page.waitForTimeout(800);
await page.locator('.app-tabs').getByRole('button', { name: /আজকের রুটিন|Today/ }).click();
await page.waitForFunction(
  () => [...document.querySelectorAll('.surface-card')].some((el) => /নামাজের ওয়াক্ত|Prayer Times/.test(el.textContent || '') && /\d{2}:\d{2}/.test(el.textContent || '')),
  { timeout: 30000 },
).catch(() => {});
await page.getByRole('heading', { name: /নামাজের ওয়াক্ত|Prayer Times/ }).scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await shot(page, '08-prayer.png');

// 9: Voice briefing modal
await page.locator('.app-hero-actions button:has-text("🎧")').click();
await page.locator('div.fixed.inset-0 h3').waitFor({ timeout: 10000 });
await page.waitForTimeout(900);
await shot(page, '09-voice.png');
await page.locator('div.fixed.inset-0 button').last().click();
await page.waitForTimeout(500);

// 10: Dashboard tab
await page.locator('.app-tabs').getByRole('button', { name: /ড্যাশবোর্ড|Dashboard/ }).click();
await page.waitForTimeout(1200);
await shot(page, '10-dashboard.png');

// 11: Alarms section
await page.locator('.app-tabs').getByRole('button', { name: /আজকের রুটিন|Today/ }).click();
await page.waitForTimeout(800);
await page.getByRole('heading', { name: /অ্যালার্ম|Alarm/ }).scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await shot(page, '11-alarms.png');

// 12: Mobile hero
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'bn-BD',
  timezoneId: 'Asia/Dhaka',
  isMobile: true,
});
const mpage = await mob.newPage();
await mpage.goto('http://localhost:3000/bn', { waitUntil: 'networkidle' });
await mpage.waitForTimeout(1500);
await mpage.screenshot({ path: path.join(OUT, '12-mobile.png') });

await browser.close();
console.log(`SHOTS_DONE errors=${errors.length}`);
for (const e of errors.slice(0, 10)) console.log(e);
