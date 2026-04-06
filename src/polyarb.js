// polymarket opportunity finder
// not pure arb - finds high-edge opportunities based on market inefficiencies
const GAMMA_API = 'https://gamma-api.polymarket.com';

// Find markets with high volume but wide spreads (inefficient pricing)
export async function findInefficientMarkets() {
  const res = await fetch(`${GAMMA_API}/markets?closed=false&limit=200`);
  const markets = await res.json();
  
  const inefficient = [];
  
  for (const m of markets) {
    if (!m.bestBid || !m.bestAsk) continue;
    
    const spread = m.bestAsk - m.bestBid;
    const spreadPct = (spread / m.bestAsk) * 100;
    const volume = m.volumeNum || 0;
    const liquidity = m.liquidityNum || 0;
    
    // High spread (>3%) with decent volume = opportunity
    if (spreadPct > 3 && volume > 50000) {
      inefficient.push({
        question: m.question,
        conditionId: m.conditionId,
        yesBid: m.bestBid,
        yesAsk: m.bestAsk,
        spread: spread,
        spreadPct: spreadPct,
        volume: volume,
        liquidity: liquidity,
        endDate: m.endDate,
        priceChange24h: m.oneMonthPriceChange
      });
    }
  }
  
  inefficient.sort((a, b) => b.spreadPct - a.spreadPct);
  return inefficient;
}

// Find markets with big recent price moves (momentum/overreaction)
export async function findMomentumMarkets() {
  const res = await fetch(`${GAMMA_API}/markets?closed=false&limit=200`);
  const markets = await res.json();
  
  const momentum = [];
  
  for (const m of markets) {
    const priceChange = m.oneMonthPriceChange;
    if (!priceChange) continue;
    
    const volume = m.volumeNum || 0;
    
    // Big move (>10%) with volume
    if (Math.abs(priceChange) > 0.1 && volume > 100000) {
      momentum.push({
        question: m.question,
        conditionId: m.conditionId,
        currentPrice: m.bestAsk,
        priceChange: priceChange,
        priceChangePct: (priceChange * 100).toFixed(1) + '%',
        direction: priceChange > 0 ? 'UP' : 'DOWN',
        volume: volume,
        volume24h: m.volume24hr,
        endDate: m.endDate
      });
    }
  }
  
  momentum.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
  return momentum;
}

// Find markets expiring soon with uncertain pricing (theta play)
export async function findExpiringMarkets() {
  const res = await fetch(`${GAMMA_API}/markets?closed=false&limit=200`);
  const markets = await res.json();
  
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const expiring = [];
  
  for (const m of markets) {
    if (!m.endDate) continue;
    
    const endDate = new Date(m.endDate);
    const timeLeft = endDate - now;
    
    // Expires within a week
    if (timeLeft > 0 && timeLeft < oneWeek) {
      const price = m.bestAsk || 0.5;
      const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
      
      // Not yet decisively priced (between 20-80%)
      if (price > 0.2 && price < 0.8) {
        expiring.push({
          question: m.question,
          conditionId: m.conditionId,
          price: price,
          daysLeft: daysLeft,
          volume: m.volumeNum || 0,
          endDate: m.endDate
        });
      }
    }
  }
  
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);
  return expiring;
}

// Main function - get all opportunities
export async function findPolymarketArbs() {
  // This now returns "edge opportunities" not pure arbs
  const [inefficient, momentum, expiring] = await Promise.all([
    findInefficientMarkets(),
    findMomentumMarkets(),
    findExpiringMarkets()
  ]);
  
  return {
    inefficient: inefficient.slice(0, 10),
    momentum: momentum.slice(0, 10),
    expiring: expiring.slice(0, 10)
  };
}

export async function findMispricedMarkets() {
  // Renamed - this finds wide spread markets
  return findInefficientMarkets();
}
