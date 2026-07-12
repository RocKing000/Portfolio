/**
 * wait-and-seed.js
 * Polls Supabase every 5 s until the companies table exists,
 * then runs the full seed automatically.
 *
 * Usage:  node scripts/wait-and-seed.js
 * (Blocks until tables are created — run this, then paste SQL in Supabase dashboard)
 */

require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const POLL_MS    = 5000;
const MAX_TRIES  = 60; // 5 min timeout

async function tablesReady() {
  const { error } = await supabaseAdmin
    .from('companies')
    .select('id')
    .limit(1);
  return !error;
}

async function runSeed() {
  // Re-use existing seed logic by spawning it as a child process
  const { execSync } = require('child_process');
  const path = require('path');
  execSync('node ' + path.join(__dirname, 'seed.js'), { stdio: 'inherit' });
}

(async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  DIRE-X — Waiting for database tables to be ready   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('1. Open: https://supabase.com/dashboard/project/xywqmkjklapfdfkcffox/sql/new');
  console.log('2. Paste the contents of:  dire-x/supabase/dire-x-setup.sql');
  console.log('3. Click RUN');
  console.log('');
  console.log('This script will detect when tables are ready and seed automatically.');
  console.log('');

  for (let i = 1; i <= MAX_TRIES; i++) {
    process.stdout.write(`\r  Checking (attempt ${i}/${MAX_TRIES})...`);
    const ready = await tablesReady();
    if (ready) {
      console.log('\n');
      console.log('  Tables detected! Starting seed...\n');
      await runSeed();
      console.log('\n  Done. Run: npm run dev  to start the server.');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  console.error('\n\n  Timeout: tables were not created within 5 minutes.');
  console.error('  Please run dire-x/supabase/dire-x-setup.sql in the Supabase SQL Editor.');
  process.exit(1);
})();
