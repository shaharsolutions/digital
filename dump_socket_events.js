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

  const code = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const gameScript = scripts.find(s => s.textContent.includes('connectSocket'));
    if (!gameScript) return 'Not found';
    
    const text = gameScript.textContent;
    const startIdx = text.indexOf('//  SOCKET SOCKET LISTENERS');
    const endIdx = text.indexOf('// ═══════════════════════════════════════════', startIdx + 50);
    return text.substring(startIdx, endIdx);
  });

  console.log('--- SOCKET LISTENERS ---');
  console.log(code);
  console.log('------------------------');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
