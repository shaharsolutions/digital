const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
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

  // Print G state
  const gameState = await page.evaluate(() => {
    return window.G ? window.G : 'G is not defined on window';
  });

  console.log('--- GAME STATE G ---');
  console.log(JSON.stringify(gameState, null, 2));
  console.log('--------------------');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
