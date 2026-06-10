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

  // Evaluate and search for handleLockReady definition in all script tags
  const code = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const gameScript = scripts.find(s => s.textContent.includes('handleLockReady'));
    if (!gameScript) return 'Not found';
    
    // Extract handleLockReady function text or lines around it
    const text = gameScript.textContent;
    const idx = text.indexOf('function handleLockReady');
    if (idx === -1) {
      // Maybe it's defined differently
      const idx2 = text.indexOf('handleLockReady =');
      if (idx2 === -1) return 'Not found';
      return text.substring(idx2, idx2 + 1000);
    }
    return text.substring(idx, idx + 1000);
  });

  console.log('--- handleLockReady Code ---');
  console.log(code);
  console.log('----------------------------');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
