const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Starting SupremeValues scraper...');
  
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🔗 Connecting to SupremeValues...');
    await page.goto('https://supremevalues.com', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Wait for React app to fully load
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(8000);
    
    // Check if page loaded correctly
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    if (!pageTitle.toLowerCase().includes('supreme') && !pageTitle.toLowerCase().includes('mm2')) {
      throw new Error('Page appears to be blocked or redirected. Title: ' + pageTitle);
    }
    
    console.log('🔍 Extracting data...');
    
    const data = await page.evaluate(() => {
      const items = {};
      
      // Try EVERY possible selector for SupremeValues
      const selectors = [
        '.item-card',
        '[class*="ItemCard"]',
        '[class*="item-card"]',
        'tr',
        '.grid > div',
        '[data-testid="item"]',
        '.value-item',
        '.card',
        '.item'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Found ${elements.length} elements for selector: ${selector}`);
        
        elements.forEach(el => {
          try {
            // Try multiple patterns for name
            let name = null;
            const nameSelectors = ['.font-bold', 'h3', 'h4', '.item-name', '[class*="name"]', 'td:first-child', '.title', '.name'];
            for (const sel of nameSelectors) {
              const el_ = el.querySelector(sel);
              if (el_) {
                name = el_.innerText.trim();
                break;
              }
            }
            
            // Try multiple patterns for value
            let valueText = null;
            const valueSelectors = ['.text-green-500', '[class*="value"]', 'td:last-child', '.amount', '.price', '[class*="price"]'];
            for (const sel of valueSelectors) {
              const el_ = el.querySelector(sel);
              if (el_) {
                valueText = el_.innerText.trim();
                break;
              }
            }
            
            // If standard selectors fail, try first and last child of table rows
            if (!name && !valueText && el.tagName === 'TR') {
              const cells = el.querySelectorAll('td');
              if (cells.length >= 2) {
                name = cells[0].innerText.trim();
                valueText = cells[cells.length - 1].innerText.trim();
              }
            }
            
            if (name && valueText) {
              const value = parseInt(valueText.replace(/[^0-9]/g, ''));
              if (value > 0 && name.length > 2 && name.length < 100) {
                items[name] = {
                  value: value,
                  display: valueText,
                  category: 'Unknown'
                };
              }
            }
          } catch (err) {
            console.log('Error processing element:', err.message);
          }
        });
        
        // If we found items, stop trying other selectors
        if (Object.keys(items).length > 50) {
          console.log(`Found ${Object.keys(items).length} items, stopping search.`
          break;
        }
      }
      
      return items;
    });
    
    const count = Object.keys(data).length;
    console.log(`✅ Scraped ${count} items from SupremeValues`);
    
    if (count > 0) {
      fs.writeFileSync('values.json', JSON.stringify(data, null, 2));
      console.log('💾 Saved to values.json');
      console.log('Sample data:', JSON.stringify(Object.keys(data).slice(0, 5)));
    } else {
      console.log('❌ No items found. Creating empty file.');
      fs.writeFileSync('values.json', '{}');
    }
    
  } catch (err) {
    console.error('❌ Scraper failed:', err.message);
    console.error(err.stack);
    // Create empty file to prevent errors
    fs.writeFileSync('values.json', '{}');
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
