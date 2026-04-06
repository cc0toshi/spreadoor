// arbitrage opportunity finder
import * as hl from './hyperliquid.js';
import * as pm from './polymarket.js';

// parse polymarket question to extract price target
function parseTarget(question) {
  // "Will Bitcoin be above $100,000 on April 30?"
  // "ETH above $4000 by end of Q2?"
  const match = question.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

// determine if market is "above" or "below" type
function parseDirection(question) {
  const q = question.toLowerCase();
  if (q.includes('above') || q.includes('over') || q.includes('reach')) return 'above';
  if (q.includes('below') || q.includes('under')) return 'below';
  return null;
}

// determine asset from question
function parseAsset(question) {
  const q = question.toLowerCase();
  if (q.includes('bitcoin') || q.includes('btc')) return 'BTC';
  if (q.includes('ethereum') || q.includes('eth')) return 'ETH';
  if (q.includes('solana') || q.includes('sol')) return 'SOL';
  return null;
}

// calculate implied probability from current price
function impliedProbFromPrice(currentPrice, targetPrice, direction) {
  // naive model: linear distance from target
  // more sophisticated would use volatility/time
  const diff = (targetPrice - currentPrice) / currentPrice;
  
  if (direction === 'above') {
    // if current > target, high prob of staying above
    if (currentPrice > targetPrice) return 0.85;
    // if within 5%, flip a coin
    if (Math.abs(diff) < 0.05) return 0.5;
    // otherwise scale by distance
    return Math.max(0.1, 0.5 - diff * 2);
  } else {
    // below logic is inverse
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
    
    // calculate what we think probability should be
    const fairProb = impliedProbFromPrice(currentPrice, targetPrice, direction);
    
    // get polymarket's current price (probability)
    const pmPrice = market.outcomePrices ? 
      parseFloat(JSON.parse(market.outcomePrices)[0]) : null;
    
    if (!pmPrice) continue;
    
    const edge = fairProb - pmPrice;
    const edgePct = edge * 100;
    
    // only report if edge > 5%
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
  
  // sort by absolute edge
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
    const annualized = fundingRate * 24 * 365 * 100; // as percentage
    
    // if funding rate > 20% annualized, there's arb potential
    if (Math.abs(annualized) > 20) {
      arbs.push({
        asset: asset.name,
        fundingRate: fundingRate * 100,
        annualized,
        signal: fundingRate > 0 ? 'SHORT_PERP_LONG_SPOT' : 'LONG_PERP_SHORT_SPOT',
        leverage: asset.maxLeverage
      });
    }
  }
  
  arbs.sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized));
  return arbs;
}
