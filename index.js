const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

const app = express();
app.use(cors({ origin: '*' }));

let cachedData = {};
let lastFetch = 0;
const CACHE_MS = 30 * 60 * 1000;

async function scrape() {
    console.log('Starting browser...');
    
    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto('https://supremevalues.com', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for content to load
        await page.waitForTimeout(5000);
        
        const items = await page.evaluate(() => {
            const data = {};
            // SupremeValues specific selectors
            document.querySelectorAll('.item-card, [data-item], tr').forEach(el => {
                const name = el.querySelector('.item-name, .name, h3, td:first-child')?.innerText?.trim();
                const value = el.querySelector('.item-value, .value, td:last-child')?.innerText?.trim();
                if (name && value) {
                    const num = parseInt(value.replace(/[^0-9]/g, ''));
                    if (num > 0) data[name] = { value: num, raw: value };
                }
            });
            return data;
        });
        
        console.log('Scraped', Object.keys(items).length);
        return items;
    } finally {
        await browser.close();
    }
}

app.get('/api/values', async (req, res) => {
    if (Object.keys(cachedData).length && (Date.now() - lastFetch) < CACHE_MS) {
        return res.json({ success: true, cached: true, count: Object.keys(cachedData).length, data: cachedData });
    }
    
    try {
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
    console.log('Server on', PORT);
    scrape().then(d => { cachedData = d; }).catch(console.error);
});
