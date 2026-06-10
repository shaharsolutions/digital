const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to Shithead game...');
  await page.goto('https://shithead-3g5n.onrender.com/', {
    waitUntil: 'networkidle2',
    timeout: 90000
  });

  console.log('Entering name...');
  await page.type('#player-name', 'שחר');

  console.log('Selecting 3-player computer mode...');
  await page.select('#game-mode', 'computer');
  await page.select('#player-count', '3');

  console.log('Clicking create/start button...');
  await page.click('#create-btn');

  console.log('Waiting 5 seconds for game view...');
  await new Promise(r => setTimeout(r, 5000));

  const initialBtnText = await page.evaluate(() => {
    const btn = document.getElementById('start-btn');
    return btn ? btn.textContent.trim() : 'NOT FOUND';
  });
  console.log('Initial start-btn text:', initialBtnText);

  // Check if we need to click cards
  // Let's click some hand cards to satisfy the swap phase if it's active
  console.log('Clicking hand cards...');
  await page.evaluate(async () => {
    // Click cards in the hand
    const handCards = Array.from(document.querySelectorAll('[data-hand]'));
    console.log(`Found ${handCards.length} hand cards.`);
    
    // In Shithead, we need to choose 3 cards to put on the table.
    // Let's click the first 3 hand cards if they are available.
    for (let i = 0; i < Math.min(3, handCards.length); i++) {
      handCards[i].click();
      await new Promise(r => setTimeout(r, 500));
    }
  });

  const afterClickBtnText = await page.evaluate(() => {
    const btn = document.getElementById('start-btn');
    return btn ? btn.textContent.trim() : 'NOT FOUND';
  });
  console.log('Start-btn text after clicking cards:', afterClickBtnText);

  console.log('Clicking start-btn to start the game...');
  await page.click('#start-btn');

  console.log('Waiting 5 seconds for play phase to start...');
  await new Promise(r => setTimeout(r, 5000));

  const gameInfo = await page.evaluate(() => {
    const msg = document.getElementById('game-msg');
    const playBtn = document.getElementById('play-btn');
    const pickBtn = document.getElementById('pick-btn');
    return {
      message: msg ? msg.textContent.trim() : 'no message',
      playBtnHidden: playBtn ? playBtn.classList.contains('hidden') : true,
      pickBtnHidden: pickBtn ? pickBtn.classList.contains('hidden') : true
    };
  });
  console.log('Game Info in play phase:', gameInfo);

  // Let's try playing a card to have a discard pile card
  console.log('Attempting to click a card to play it...');
  await page.evaluate(async () => {
    const playableCards = Array.from(document.querySelectorAll('[data-hand]'));
    if (playableCards.length > 0) {
      // Click the first card
      playableCards[0].click();
      await new Promise(r => setTimeout(r, 1000));
      // Click play button if it is visible
      const playBtn = document.getElementById('play-btn');
      if (playBtn && !playBtn.classList.contains('hidden')) {
        playBtn.click();
      }
    }
  });

  console.log('Waiting 3 seconds after play...');
  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot
  const screenshotPath = '/Users/shahar/Desktop/שחר פתרונות דיגיטליים.png/digital/game-screenshot.png';
  console.log('Saving screenshot to ' + screenshotPath);
  await page.screenshot({ path: screenshotPath });

  await browser.close();
  console.log('Done!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
