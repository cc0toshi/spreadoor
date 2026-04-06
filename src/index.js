// spreadoor - cross-market arb finder
import express from 'express';
import { findOpportunities, getFundingArb } from './arbfinder.js';
import * as hl from './hyperliquid.js';
import * as pm from './polymarket.js';

const app = express();
const PORT = process.env.PORT || 3069;

// cache
let cache = {
  opportunities: [],
  funding: [],
  lastUpdate: null
};

async function refresh() {
  try {
    const [opportunities, funding] = await Promise.all([
      findOpportunities(),
      getFundingArb()
    ]);
    cache = {
      opportunities,
      funding,
      lastUpdate: new Date().toISOString()
    };
    console.log(`refreshed: ${opportunities.length} pm opps, ${funding.length} funding arbs`);
  } catch (err) {
    console.error('refresh error:', err.message);
  }
}

// routes
app.get('/', (req, res) => {
  res.json({
    name: 'spreadoor',
    version: '0.1.0',
    description: 'cross-market arb finder for hyperliquid + polymarket',
    endpoints: {
      '/': 'this info',
      '/opportunities': 'polymarket vs spot price opportunities',
      '/funding': 'funding rate arbitrage opportunities',
      '/prices/:asset': 'get hyperliquid price for asset',
      '/markets': 'get polymarket crypto markets',
      '/refresh': 'force refresh data'
    },
    lastUpdate: cache.lastUpdate
  });
});

app.get('/opportunities', (req, res) => {
  res.json({
    count: cache.opportunities.length,
    lastUpdate: cache.lastUpdate,
    data: cache.opportunities
  });
});

app.get('/funding', (req, res) => {
  res.json({
    count: cache.funding.length,
    lastUpdate: cache.lastUpdate,
    data: cache.funding
  });
});

app.get('/prices/:asset', async (req, res) => {
  const { asset } = req.params;
  try {
    const spread = await hl.getSpread(asset.toUpperCase());
    if (!spread) {
      return res.status(404).json({ error: 'asset not found' });
    }
    res.json(spread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/markets', async (req, res) => {
  try {
    const markets = await pm.getCryptoPriceMarkets();
    res.json({
      count: markets.length,
      data: markets.map(m => ({
        question: m.question,
        conditionId: m.conditionId,
        volume: m.volume,
        liquidity: m.liquidityClob,
        endDate: m.endDate
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/refresh', async (req, res) => {
  await refresh();
  res.json({ status: 'refreshed', lastUpdate: cache.lastUpdate });
});

// start
await refresh();
setInterval(refresh, 60000); // refresh every minute

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║           S P R E A D O O R           ║
  ║   cross-market arb finder v0.1.0      ║
  ╚═══════════════════════════════════════╝
  
  server running on http://localhost:${PORT}
  
  endpoints:
    GET /              - api info
    GET /opportunities - polymarket arbs
    GET /funding       - funding rate arbs
    GET /prices/:asset - hyperliquid prices
    GET /markets       - polymarket crypto markets
    GET /refresh       - force refresh
  
  auto-refresh every 60s
  `);
});
