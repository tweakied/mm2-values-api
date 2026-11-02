const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors({ origin: '*' }));

let cachedData = {};
let lastFetch = 0;
const CACHE_MS = 30 * 60 * 1000;

async function scrape() {
    console.log('Scraping SupremeValues...');
    
    try {
        const { data: html } = await axios.get('https://supremevalues.com', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        const $ = cheerio.load(html);
        const items = {};
        
        // Try multiple selectors
        $('[class*="item"], tr, .card, .row').each((i, el) => {
            const name = $(el).find('[class*="name"], h3, h4, td:first-child, .title').text().trim();
            const valueText = $(el).find('[class*="value"], [class*="price"], td:last-child, .amount').text().trim();
            
            if (name && valueText) {
                const value = parseInt(valueText.replace(/[^0-9]/g, ''));
                if (value > 0 && name.length > 2) {
                    items[name] = {
                        value: value,
                        display: valueText,
                        category: 'Unknown'
                    };
                }
            }
        });
        
        console.log('Scraped', Object.keys(items).length, 'items');
        return items;
        
    } catch (err) {
        console.error('Scrape error:', err.message);
        return {};
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
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        items: Object.keys(cachedData).length,
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'MM2 Values API',
        endpoints: ['/api/values', '/ping']
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port', PORT);
    scrape().then(d => {
        cachedData = d;
        lastFetch = Date.now();
    }).catch(console.error);
});
