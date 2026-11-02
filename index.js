const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));

let cachedData = {};

function loadData() {
  try {
    const filePath = path.join(__dirname, 'values.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      cachedData = JSON.parse(data);
      console.log(`✅ Loaded ${Object.keys(cachedData).length} items from values.json`);
      return true;
    } else {
      console.log('⚠️ values.json not found. API will return empty data.');
    }
  } catch (err) {
    console.error('❌ Error loading values.json:', err.message);
  }
  return false;
}

// Load data on startup
loadData();

app.get('/api/values', (req, res) => {
  if (Object.keys(cachedData).length === 0) {
    return res.status(404).json({ 
      error: 'No data available. GitHub Action may have failed.',
      message: 'Wait for the next scheduled run or trigger it manually.'
    });
  }
  
  res.json({ 
    success: true, 
    count: Object.keys(cachedData).length, 
    data: cachedData,
    source: 'SupremeValues (via GitHub Actions)',
    lastUpdated: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => res.json({ 
  status: 'alive', 
  items: Object.keys(cachedData).length,
  uptime: process.uptime()
}));

app.get('/', (req, res) => res.json({ 
  name: 'SupremeValues API', 
  status: 'Running',
  message: 'Data is updated via GitHub Actions every 6 hours',
  endpoints: ['/api/values', '/ping'] 
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
