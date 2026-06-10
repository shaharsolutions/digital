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

  // Extract the functions connectSocket, handleCreate, handleJoin
  const code = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const gameScript = scripts.find(s => s.textContent.includes('connectSocket'));
    if (!gameScript) return 'Not found';
    
    const text = gameScript.textContent;
    const connectSocketIdx = text.indexOf('function connectSocket');
    const handleCreateIdx = text.indexOf('function handleCreate');
    const handleJoinIdx = text.indexOf('function handleJoin');
    
    return {
      connectSocket: text.substring(connectSocketIdx, connectSocketIdx + 800),
      handleCreate: text.substring(handleCreateIdx, handleCreateIdx + 800),
      handleJoin: text.substring(handleJoinIdx, handleJoinIdx + 800)
    };
  });

  console.log(JSON.stringify(code, null, 2));

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
