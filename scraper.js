const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting scrape of SupremeValues...');
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto('https://supremevalues.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Wait for React
    
    const data = await page.evaluate(() => {
      const items = {};
      // Try multiple selectors
      document.querySelectorAll('.item-card, [class*="ItemCard"], tr, .grid > div').forEach(el => {
        const nameEl = el.querySelector('.font-bold, h3, [class*="name"], td:first-child');
        const valueEl = el.querySelector('.text-green-500, [class*="value"], td:last-child');
        
        if (nameEl && valueEl) {
          const name = nameEl.innerText.trim();
          const valueText = valueEl.innerText.trim();
          const value = parseInt(valueText.replace(/[^0-9]/g, ''));
          
          if (name && value > 0) {
            items[name] = { value, display: valueText };
          }
        }
      });
      return items;
    });
    
    const count = Object.keys(data).length;
    console.log(`Scraped ${count} items.`);
    
    if (count > 0) {
      fs.writeFileSync('values.json', JSON.stringify(data, null, 2));
      console.log('Saved to values.json');
    } else {
      console.log('No items found. Skipping save.');
    }
    
  } catch (err) {
    console.error('Scrape failed:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
