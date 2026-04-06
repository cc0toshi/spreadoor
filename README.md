# spreadoor

cross-market arb finder for hyperliquid + polymarket spreads

## what it does

1. **polymarket vs spot arb**: finds polymarket prediction markets (e.g. "BTC above $100k by April") where the implied probability diverges from what current prices suggest

2. **funding rate arb**: identifies high funding rates on hyperliquid where you can go long spot / short perp (or vice versa) to collect funding while staying delta neutral

## install

```bash
cd spreadoor
npm install
```

## run

```bash
# api server (port 3069)
npm start

# cli monitor (prints to console)
npm run monitor
```

## api endpoints

- `GET /` - api info
- `GET /opportunities` - polymarket price prediction arbs
- `GET /funding` - funding rate arbs
- `GET /prices/:asset` - hyperliquid orderbook spread
- `GET /markets` - polymarket crypto markets
- `GET /refresh` - force refresh data

## how the arb works

### polymarket arb

if polymarket says "BTC above $100k" trades at 30% (implying 30% chance), but BTC is currently at $99k, the "fair" probability might be higher. 

the bot calculates a naive fair value based on current price distance from target, and flags opportunities where edge > 5%.

### funding rate arb

when perp funding is positive (longs pay shorts), you can:
1. buy spot
2. short perp
3. collect funding while staying delta neutral

this captures the funding rate as profit. the bot flags assets with >20% annualized funding.

## caveats

- naive probability model (no vol/time consideration)
- no execution yet (monitoring only)
- polymarket requires polygon USDC
- hyperliquid requires USDC deposit

## todo

- [ ] add execution via hyperliquid SDK
- [ ] add polymarket CLOB integration
- [ ] volatility-adjusted fair value
- [ ] telegram/discord alerts
- [ ] historical backtest
