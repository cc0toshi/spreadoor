// live monitoring daemon
import { findOpportunities, getFundingArb } from './arbfinder.js';
import fs from 'fs';

const INTERVAL = 60000; // 1 minute
const LOG_FILE = './data/opportunities.json';

async function scan() {
  const timestamp = new Date().toISOString();
  console.log(`\n=== SCAN ${timestamp} ===\n`);
  
  try {
    // find polymarket vs spot arbs
    const pmArbs = await findOpportunities();
    console.log(`found ${pmArbs.length} polymarket opportunities`);
    
    if (pmArbs.length > 0) {
      console.log('\nTOP POLYMARKET OPPORTUNITIES:');
      pmArbs.slice(0, 5).forEach(opp => {
        console.log(`  ${opp.asset} ${opp.direction} $${opp.targetPrice}`);
        console.log(`    PM: ${opp.polymarketProb.toFixed(1)}% | Fair: ${opp.fairProb.toFixed(1)}%`);
        console.log(`    Edge: ${opp.edge > 0 ? '+' : ''}${opp.edge.toFixed(1)}% → ${opp.signal}`);
        console.log(`    Volume: $${(opp.volume/1000).toFixed(0)}k | Liquidity: $${(opp.liquidity/1000).toFixed(0)}k`);
      });
    }
    
    // find funding rate arbs
    const fundingArbs = await getFundingArb();
    console.log(`\nfound ${fundingArbs.length} funding rate opportunities`);
    
    if (fundingArbs.length > 0) {
      console.log('\nTOP FUNDING RATE ARBS:');
      fundingArbs.slice(0, 5).forEach(arb => {
        console.log(`  ${arb.asset}: ${arb.fundingRate.toFixed(4)}% (${arb.annualized.toFixed(1)}% APR)`);
        console.log(`    Signal: ${arb.signal} | Max Leverage: ${arb.leverage}x`);
      });
    }
    
    // save to file
    const data = {
      timestamp,
      polymarket: pmArbs,
      funding: fundingArbs
    };
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
    console.log(`\nsaved to ${LOG_FILE}`);
    
  } catch (err) {
    console.error('scan error:', err.message);
  }
}

// run immediately
await scan();

// then every interval
setInterval(scan, INTERVAL);

console.log(`\nmonitoring started. scanning every ${INTERVAL/1000}s...`);
console.log('press ctrl+c to stop\n');
