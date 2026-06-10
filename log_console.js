const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.toString()));

  await page.goto('https://shithead-3g5n.onrender.com/', {
    waitUntil: 'networkidle2',
    timeout: 90000
  });

  await page.type('#player-name', 'שחר');
  await page.select('#game-mode', 'computer');
  await page.select('#player-count', '3');
  await page.click('#create-btn');

  console.log('Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('Clicking start-btn...');
  await page.click('#start-btn');

  console.log('Waiting another 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
