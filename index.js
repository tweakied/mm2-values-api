const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright-core');

const app = express();
app.use(cors({ origin: '*' }));

let cachedData = {};
let lastFetch = 0;
const CACHE_MS = 30 * 60 * 1000;

async function scrape() {
    console.log('Launching browser...');
    
    let browser;
    try {
        // Use system chrome if available, otherwise download
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        console.log('Navigating to SupremeValues...');
        await page.goto('https://supremevalues.com', { 
            waitUntil: 'networkidle',
            timeout: 60000 
        });
        
        // Wait for React to render
        await page.waitForTimeout(5000);
        
        console.log('Extracting data...');
        
        // Try multiple selectors that SupremeValues uses
        const items = await page.evaluate(() => {
            const data = {};
            
            // SupremeValues specific selectors (based on their React app structure)
            const selectors = [
                '.item-card',
                '[data-testid="item"]',
                '.value-item',
                'tr.cursor-pointer',
                '.grid > div'
            ];
            
            for (const selector of selectors) {
                document.querySelectorAll(selector).forEach(el => {
                    // Try finding name
                    let nameEl = el.querySelector('.font-bold, h3, .item-name, [class*="name"]');
                    let valueEl = el.querySelector('.text-green, [class*="value"], .text-right');
                    
                    if (!nameEl) nameEl = el.children[0];
                    if (!valueEl) valueEl = el.children[1];
                    
                    const name = nameEl?.innerText?.trim();
                    const valueText = valueEl?.innerText?.trim();
                    
                    if (name && valueText) {
                        const value = parseInt(valueText.replace(/[^0-9]/g, ''));
                        if (value > 0 && name.length > 2 && !data[name]) {
                            data[name] = {
                                value: value,
                                display: valueText,
                                category: 'Unknown'
                            };
                        }
                    }
                });
                
                if (Object.keys(data).length > 10) break;
            }
            
            // Alternative: check if data is in window.__DATA__ or similar
            if (Object.keys(data).length === 0 && window.__INITIAL_STATE__) {
                console.log('Found initial state');
            }
            
            return data;
        });
        
        console.log('Scraped', Object.keys(items).length, 'items from SupremeValues');
        return items;
        
    } catch (err) {
        console.error('Scrape error:', err.message);
        console.error(err.stack);
        return {};
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/api/values', async (req, res) => {
    try {
        if (Object.keys(cachedData).length && (Date.now() - lastFetch) < CACHE_MS) {
            return res.json({ 
                success: true, 
                cached: true, 
                count: Object.keys(cachedData).length, 
                data: cachedData 
            });
        }
        
        cachedData = await scrape();
        lastFetch = Date.now();
        
        res.json({
            success: true,
            cached: false,
            count: Object.keys(cachedData).length,
            data: cachedData
        });
        
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/ping', (req, res) => res.json({ 
    status: 'alive', 
    items: Object.keys(cachedData).length,
    uptime: process.time()
}));

app.get('/', (req, res) => res.json({ 
    name: 'SupremeValues API', 
    source: 'supremevalues.com',
    endpoints: ['/api/values', '/ping'] 
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server on port', PORT);
    scrape().then(d => { 
        cachedData = d; 
        lastFetch = Date.now();
    }).catch(console.error);
});
