// arbitrage opportunity finder
import * as hl from './hyperliquid.js';
import * as pm from './polymarket.js';

// parse polymarket question to extract price target
function parseTarget(question) {
  const match = question.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

function parseDirection(question) {
  const q = question.toLowerCase();
  if (q.includes('above') || q.includes('over') || q.includes('reach')) return 'above';
  if (q.includes('below') || q.includes('under')) return 'below';
  return null;
}

function parseAsset(question) {
  const q = question.toLowerCase();
  if (q.includes('bitcoin') || q.includes('btc')) return 'BTC';
  if (q.includes('ethereum') || q.includes('eth')) return 'ETH';
  if (q.includes('solana') || q.includes('sol')) return 'SOL';
  return null;
}

function impliedProbFromPrice(currentPrice, targetPrice, direction) {
  const diff = (targetPrice - currentPrice) / currentPrice;
  
  if (direction === 'above') {
    if (currentPrice > targetPrice) return 0.85;
    if (Math.abs(diff) < 0.05) return 0.5;
    return Math.max(0.1, 0.5 - diff * 2);
  } else {
    if (currentPrice < targetPrice) return 0.85;
    if (Math.abs(diff) < 0.05) return 0.5;
    return Math.max(0.1, 0.5 + diff * 2);
  }
}

export async function findOpportunities() {
  console.log('fetching polymarket crypto markets...');
  const pmMarkets = await pm.getCryptoPriceMarkets();
  
  console.log('fetching hyperliquid prices...');
  const hlPrices = await hl.getAllMids();
  
  const opportunities = [];
  
  for (const market of pmMarkets) {
    const asset = parseAsset(market.question);
    if (!asset) continue;
    
    const hlPrice = hlPrices[asset];
    if (!hlPrice) continue;
    
    const currentPrice = parseFloat(hlPrice);
    const targetPrice = parseTarget(market.question);
    const direction = parseDirection(market.question);
    
    if (!targetPrice || !direction) continue;
    
    const fairProb = impliedProbFromPrice(currentPrice, targetPrice, direction);
    
    const pmPrice = market.outcomePrices ? 
      parseFloat(JSON.parse(market.outcomePrices)[0]) : null;
    
    if (!pmPrice) continue;
    
    const edge = fairProb - pmPrice;
    const edgePct = edge * 100;
    
    if (Math.abs(edgePct) > 5) {
      opportunities.push({
        market: market.question,
        conditionId: market.conditionId,
        asset,
        currentPrice,
        targetPrice,
        direction,
        polymarketProb: pmPrice * 100,
        fairProb: fairProb * 100,
        edge: edgePct,
        signal: edge > 0 ? 'BUY_YES' : 'BUY_NO',
        volume: market.volume || 0,
        liquidity: market.liquidityClob || 0
      });
    }
  }
  
  opportunities.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));
  
  return opportunities;
}

export async function getFundingArb() {
  console.log('fetching hyperliquid funding rates...');
  const data = await hl.getFundingRates();
  
  if (!data || data.length < 2) return [];
  
  const [meta, assetCtxs] = data;
  const arbs = [];
  
  for (let i = 0; i < meta.universe.length; i++) {
    const asset = meta.universe[i];
    const ctx = assetCtxs[i];
    
    if (!ctx || !ctx.funding) continue;
    
    const fundingRate = parseFloat(ctx.funding);
    const annualized = fundingRate * 24 * 365 * 100;
    
    // only flag if funding > 20% annualized
    if (Math.abs(annualized) > 20) {
      // POSITIVE funding = longs pay shorts = SHORT perp to receive
      // NEGATIVE funding = shorts pay longs = LONG perp to receive
      const isPositive = fundingRate > 0;
      
      arbs.push({
        asset: asset.name,
        fundingRate: fundingRate * 100,
        annualized,
        // positive funding: easy play (buy spot + short perp on HL)
        // negative funding: hard play (need to short spot elsewhere)
        difficulty: isPositive ? 'EASY' : 'HARD',
        strategy: isPositive 
          ? 'BUY_SPOT + SHORT_PERP (same exchange)' 
          : 'LONG_PERP + SHORT_SPOT (need margin elsewhere)',
        signal: isPositive ? 'SHORT_PERP' : 'LONG_PERP',
        leverage: asset.maxLeverage,
        note: isPositive 
          ? 'Can execute on Hyperliquid alone' 
          : 'Need to short spot on Binance/etc for hedge'
      });
    }
  }
  
  // sort by absolute APR but prioritize EASY ones
  arbs.sort((a, b) => {
    if (a.difficulty !== b.difficulty) {
      return a.difficulty === 'EASY' ? -1 : 1;
    }
    return Math.abs(b.annualized) - Math.abs(a.annualized);
  });
  
  return arbs;
}
