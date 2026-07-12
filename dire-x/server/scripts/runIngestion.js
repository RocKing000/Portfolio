/**
 * CLI script to run the daily ingestion manually.
 * Usage: node scripts/runIngestion.js
 */

require('dotenv').config();

const { runDailyIngestion } = require('../src/jobs/dailyIngestion');

(async () => {
  console.log('=== DIRE-X Manual Ingestion ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  try {
    const result = await runDailyIngestion();

    console.log('');
    console.log('=== Ingestion Complete ===');
    console.log(`Elapsed: ${result.elapsed_ms}ms`);
    console.log(`Metrics updated: ${result.metrics_updated}`);
    console.log(`Snapshot ID: ${result.snapshot_id || 'N/A'}`);

    if (result.company_sres && result.company_sres.length > 0) {
      console.log('');
      console.log('Company SRES:');
      for (const cs of result.company_sres) {
        console.log(`  ${cs.company_name}: ${cs.sres}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Ingestion failed:', err.message);
    process.exit(1);
  }
})();
