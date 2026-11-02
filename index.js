const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(cors({ origin: '*' }));

let cachedData = {};
let lastFetch = 0;
const CACHE_MS = 30 * 60 * 1000;

async function scrape() {
    console.log('Scraping...');
    
    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto('https://supremevalues.com', { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForTimeout(3000);
        
        const items = await page.evaluate(() => {
            const data = {};
            document.querySelectorAll('[class*="item"], tr, .card').forEach(el => {
                const name = el.querySelector('[class*="name"], h3, h4, td:first-child')?.innerText?.trim();
                const val = el.querySelector('[class*="value"], [class*="price"], td:last-child')?.innerText?.trim();
                if (name && val) {
                    const num = parseInt(val.replace(/[^0-9]/g, ''));
                    if (num > 0) data[name] = { value: num, display: val };
                }
            });
            return data;
        });
        
        console.log('Found', Object.keys(items).length, 'items');
        return items;
    } catch (err) {
        console.error('Scrape error:', err.message);
        return {};
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/api/values', async (req, res) => {
    try {
        if (Object.keys(cachedData).length && (Date.now() - lastFetch) < CACHE_MS) {
            return res.json({ success: true, cached: true, count: Object.keys(cachedData).length, data: cachedData });
        }
        
        cachedData = await scrape();
        lastFetch = Date.now();
        res.json({ success: true, cached: false, count: Object.keys(cachedData).length, data: cachedData });
        
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/ping', (req, res) => res.json({ status: 'alive', items: Object.keys(cachedData).length }));
app.get('/', (req, res) => res.json({ name: 'MM2 API', endpoints: ['/api/values', '/ping'] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server on port', PORT);
    scrape().then(d => { cachedData = d; lastFetch = Date.now(); }).catch(console.error);
});
