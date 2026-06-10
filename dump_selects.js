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

  const selectInfo = await page.evaluate(() => {
    const gameModeOptions = Array.from(document.querySelectorAll('#game-mode option')).map(o => ({ value: o.value, text: o.textContent }));
    const playerCountOptions = Array.from(document.querySelectorAll('#player-count option')).map(o => ({ value: o.value, text: o.textContent }));
    return { gameModeOptions, playerCountOptions };
  });

  console.log(JSON.stringify(selectInfo, null, 2));

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
