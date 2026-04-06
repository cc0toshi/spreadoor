// polymarket API client
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

export async function getMarkets(limit = 100) {
  const res = await fetch(`${GAMMA_API}/markets?closed=false&limit=${limit}`);
  return res.json();
}

export async function searchMarkets(query) {
  const res = await fetch(`${GAMMA_API}/markets?closed=false&_q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getMarket(conditionId) {
  const res = await fetch(`${GAMMA_API}/markets/${conditionId}`);
  return res.json();
}

export async function getOrderbook(tokenId) {
  const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
  return res.json();
}

export async function getPrice(tokenId) {
  try {
    const book = await getOrderbook(tokenId);
    if (!book.bids?.length && !book.asks?.length) return null;
    
    const bestBid = book.bids?.length ? parseFloat(book.bids[0].price) : 0;
    const bestAsk = book.asks?.length ? parseFloat(book.asks[0].price) : 1;
    const mid = (bestBid + bestAsk) / 2;
    
    return {
      tokenId,
      bestBid,
      bestAsk,
      mid,
      impliedProb: mid * 100,
      timestamp: Date.now()
    };
  } catch (e) {
    return null;
  }
}

export async function getCryptoPriceMarkets() {
  const markets = await getMarkets(200);
  
  const priceMarkets = markets.filter(m => {
    const q = (m.question || '').toLowerCase();
    return (q.includes('bitcoin') || q.includes('btc') || 
            q.includes('ethereum') || q.includes('eth')) &&
           (q.includes('price') || q.includes('above') || q.includes('below'));
  });
  
  return priceMarkets;
}
