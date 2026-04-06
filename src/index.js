// spreadoor - polymarket edge finder
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findPolymarketArbs, findInefficientMarkets, findMomentumMarkets, findExpiringMarkets } from './polyarb.js';
import * as hl from './hyperliquid.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3069;

let cache = {
  inefficient: [],
  momentum: [],
  expiring: [],
  lastUpdate: null
};

async function refresh() {
  try {
    console.log('refreshing...');
    const [inefficient, momentum, expiring] = await Promise.all([
      findInefficientMarkets().catch(e => []),
      findMomentumMarkets().catch(e => []),
      findExpiringMarkets().catch(e => [])
    ]);
    
    cache = { inefficient, momentum, expiring, lastUpdate: new Date().toISOString() };
    console.log(`refreshed: ${inefficient.length} inefficient, ${momentum.length} momentum, ${expiring.length} expiring`);
  } catch (err) {
    console.error('refresh error:', err.message);
  }
}

app.use(express.static(join(__dirname, '../public')));

app.get('/api', (req, res) => {
  res.json({
    name: 'spreadoor',
    version: '0.3.0',
    description: 'polymarket edge finder',
    endpoints: {
      '/inefficient': 'high spread markets (pricing inefficiency)',
      '/momentum': 'big price movers (momentum plays)',
      '/expiring': 'expiring soon + uncertain (theta plays)',
      '/prices/:asset': 'hyperliquid prices'
    },
    lastUpdate: cache.lastUpdate
  });
});

app.get('/inefficient', (req, res) => {
  res.json({ count: cache.inefficient.length, lastUpdate: cache.lastUpdate, data: cache.inefficient });
});

app.get('/momentum', (req, res) => {
  res.json({ count: cache.momentum.length, lastUpdate: cache.lastUpdate, data: cache.momentum });
});

app.get('/expiring', (req, res) => {
  res.json({ count: cache.expiring.length, lastUpdate: cache.lastUpdate, data: cache.expiring });
});

// legacy endpoints
app.get('/opportunities', (req, res) => res.json({ count: 0, data: [] }));
app.get('/funding', (req, res) => res.json({ count: 0, data: [] }));
app.get('/polyarbs', (req, res) => res.json(cache));
app.get('/mispriced', (req, res) => res.json({ count: cache.inefficient.length, data: cache.inefficient }));

app.get('/prices/:asset', async (req, res) => {
  try {
    const spread = await hl.getSpread(req.params.asset.toUpperCase());
    if (!spread) return res.status(404).json({ error: 'not found' });
    res.json(spread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/refresh', async (req, res) => {
  await refresh();
  res.json({ status: 'ok', lastUpdate: cache.lastUpdate });
});

await refresh();
setInterval(refresh, 60000);

app.listen(PORT, () => {
  console.log(`spreadoor v0.3.0 running on http://localhost:${PORT}`);
});
