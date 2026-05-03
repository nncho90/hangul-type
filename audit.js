const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8848/game.html', { waitUntil: 'networkidle' });
  
  console.log('\n=== HANGUL BATTLE PEDAGOGICAL AUDIT ===\n');
  
  try {
    await page.waitForSelector('#introModal', { timeout: 5000 });
    await page.click('#btnStart');
    await page.waitForTimeout(1500);
    
    // Check word display
    const wordEl = await page.locator('.monster .word').first();
    const word = await wordEl.textContent();
    console.log('Sample word on screen:', word);
    
    // Check for English reveal visibility
    const englishReveals = await page.locator('.english-reveal').count();
    console.log('English reveals visible (before typing):', englishReveals);
    
    // Type first character
    if (word) {
      await page.focus('#shield');
      const firstChar = word.charAt(0);
      await page.keyboard.type(firstChar);
      await page.waitForTimeout(800);
      
      const liveOut = await page.textContent('#liveOut');
      console.log('Live input after first keystroke:', liveOut);
    }
    
    // Check audio toggle
    const audioTitle = await page.getAttribute('#btnAudio', 'title');
    console.log('Audio feature available:', audioTitle);
    
    // Check tier distribution
    const tier1 = await page.locator('.monster.tier-1').count();
    const tier2 = await page.locator('.monster.tier-2').count();
    console.log('Tier distribution - T1:', tier1, 'T2:', tier2);
    
    // Check for timer/stress elements
    const timerEl = await page.locator('[class*="timer"]').count();
    console.log('Timer UI present:', timerEl > 0 ? 'YES' : 'NO');
    
    // Look for Korean romanization
    const hasRomaji = await page.textContent('.word').then(t => /[a-z]/i.test(t)).catch(() => false);
    console.log('Shows romanization:', hasRomaji);
    
    // Stat display
    const level = await page.textContent('.stat-value.level');
    const score = await page.textContent('.stat-value.score');
    console.log('Current level:', level, '| Score:', score);
    
  } catch (e) {
    console.error('Audit error:', e.message);
  }
  
  await browser.close();
})();
