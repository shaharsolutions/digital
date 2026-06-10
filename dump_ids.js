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

  // Find all elements with IDs or classes
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[id]')).map(el => ({
      id: el.id,
      tag: el.tagName,
      text: el.textContent ? el.textContent.trim().substring(0, 50) : '',
      placeholder: el.placeholder || ''
    }));
  });

  console.log('--- ALL ELEMENTS WITH IDS ---');
  console.log(JSON.stringify(elements, null, 2));
  console.log('-----------------------------');

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
