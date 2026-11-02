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
    console.log('Scraping SupremeValues...');
    
    const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://supremevalues.com', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    const items = await page.evaluate(() => {
        const data = {};
        document.querySelectorAll('[class*="item"], .item-card, tr').forEach(el => {
            const name = el.querySelector('[class*="name"], h3, td:first-child')?.innerText?.trim();
            const val = el.querySelector('[class*="value"], [class*="price"], td:last-child')?.innerText?.trim();
            if (name && val) {
                const num = parseInt(val.replace(/[^0-9]/g, ''));
                if (num > 0) data[name] = { value: num, display: val };
            }
        });
        return data;
    });
    
    await browser.close();
    console.log('Scraped ' + Object.keys(items).length + ' items');
    return items;
}

app.get('/api/values', async (req, res) => {
    try {
        if (Object.keys(cachedData).length > 0 && (Date.now() - lastFetch) < CACHE_MS) {
            return res.json({ success: true, cached: true, count: Object.keys(cachedData).length, data: cachedData });
        }
        
        cachedData = await scrape();
        lastFetch = Date.now();
        res.json({ success: true, cached: false, count: Object.keys(cachedData).length, data: cachedData });
        
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, cached: Object.keys(cachedData).length > 0, data: cachedData });
    }
});

app.get('/api/refresh', async (req, res) => {
    try {
        cachedData = await scrape();
        lastFetch = Date.now();
        res.json({ success: true, count: Object.keys(cachedData).length, data: cachedData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/ping', (req, res) => res.json({ status: 'alive', items: Object.keys(cachedData).length, uptime: process.uptime() }));
app.get('/', (req, res) => res.json({ name: 'MM2 Values API', endpoints: ['/api/values', '/api/refresh', '/ping'] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server on port ' + PORT);
    scrape().then(d => { cachedData = d; lastFetch = Date.now(); }).catch(console.error);
});
