// hyperliquid API client
const HL_API = 'https://api.hyperliquid.xyz';

export async function getMeta() {
  const res = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' })
  });
  return res.json();
}

export async function getAllMids() {
  const res = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' })
  });
  return res.json();
}

export async function getFundingRates() {
  const res = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' })
  });
  const data = await res.json();
  return data;
}

export async function getOrderbook(coin) {
  const res = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'l2Book', coin })
  });
  return res.json();
}

export async function getSpread(coin) {
  const book = await getOrderbook(coin);
  if (!book.levels || book.levels.length < 2) return null;
  
  const bids = book.levels[0];
  const asks = book.levels[1];
  
  if (!bids.length || !asks.length) return null;
  
  const bestBid = parseFloat(bids[0].px);
  const bestAsk = parseFloat(asks[0].px);
  const mid = (bestBid + bestAsk) / 2;
  const spread = ((bestAsk - bestBid) / mid) * 100;
  
  return {
    coin,
    bestBid,
    bestAsk,
    mid,
    spread,
    timestamp: Date.now()
  };
}
