const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log('Navigating to game lobby...');
  await page.goto('https://shithead-3g5n.onrender.com/', {
    waitUntil: 'networkidle2',
    timeout: 90000
  });

  // Dump the HTML body or key elements
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('--- HTML BODY ---');
  console.log(bodyHTML);
  console.log('-----------------');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
