import { chromium } from 'playwright';

const URL = 'http://localhost:8123/';
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'shots/01-start-1280.png' });

await page.click('#startBtn');
await page.waitForSelector('#app:not([hidden])', { timeout: 30000 });
await page.waitForSelector('.fx', { timeout: 15000 });
await page.waitForTimeout(3500); // let the model + first frames settle

const results = [];
for (const [w, h, name] of [[1280, 900, 'desktop-1280'], [900, 900, 'tablet-900'], [375, 800, 'mobile-375']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    cards: document.querySelectorAll('.fx').length,
    activeCards: document.querySelectorAll('.fx.active').length,
    dials: document.querySelectorAll('.dial').length,
    bg: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.body).fontFamily.split(',')[0],
    valFont: getComputedStyle(document.querySelector('.knob .val')).fontFamily.split(',')[0],
    dotColor: getComputedStyle(document.querySelector('.fx.active h3'), '::before').backgroundColor,
    anyShadow: [...document.querySelectorAll('header,main,.fx,.stage,.transport,button,#meters')]
      .filter((el) => getComputedStyle(el).boxShadow !== 'none').map((el) => el.className || el.tagName),
  }));
  m.overflow = m.scrollW - m.clientW;
  results.push([name, m]);
  await page.screenshot({ path: `shots/02-${name}.png`, fullPage: true });
}

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
