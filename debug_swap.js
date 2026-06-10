const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('https://shithead-3g5n.onrender.com/', {
    waitUntil: 'networkidle2',
    timeout: 90000
  });

  await page.type('#player-name', 'שחר');
  await page.select('#game-mode', 'computer');
  await page.select('#player-count', '3');
  await page.click('#create-btn');

  console.log('Waiting for game board...');
  await new Promise(r => setTimeout(r, 5000));

  // Log state before click
  const beforeState = await page.evaluate(() => {
    const btn = document.getElementById('start-btn');
    const msg = document.getElementById('game-msg');
    return {
      btnText: btn ? btn.textContent.trim() : 'null',
      btnDisabled: btn ? btn.disabled : 'null',
      msgText: msg ? msg.textContent.trim() : 'null'
    };
  });
  console.log('Before click:', beforeState);

  console.log('Clicking start-btn...');
  await page.click('#start-btn');

  // Monitor state for 10 seconds
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const state = await page.evaluate(() => {
      const btn = document.getElementById('start-btn');
      const msg = document.getElementById('game-msg');
      const swapNotify = document.getElementById('swap-notification');
      const playNotify = document.getElementById('play-notification');
      const discCount = document.getElementById('disc-cnt');
      
      // Get all active players and their ready status if visible
      const players = Array.from(document.querySelectorAll('.opponent-card, #human-zone')).map(el => {
        const name = el.querySelector('span')?.textContent || 'unknown';
        const ready = el.textContent.includes('מוכן') || el.textContent.includes('⌛');
        return { name, ready };
      });

      return {
        btnText: btn ? btn.textContent.trim() : 'null',
        btnHidden: btn ? btn.classList.contains('hidden') : true,
        msgText: msg ? msg.textContent.trim() : 'null',
        swapHidden: swapNotify ? swapNotify.classList.contains('hidden') : true,
        playHidden: playNotify ? playNotify.classList.contains('hidden') : true,
        discCards: discCount ? discCount.textContent.trim() : '0',
        players
      };
    });
    console.log(`Second ${i}:`, state);
  }

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
