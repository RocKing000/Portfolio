#!/usr/bin/env node
'use strict';

/**
 * scripts/runValidation.js
 *
 * CLI script to run the validation pipeline against scenarios.
 *
 * Usage:
 *   node scripts/runValidation.js                   # validate all unvalidated
 *   node scripts/runValidation.js --id SCN-001      # validate a specific scenario
 *   node scripts/runValidation.js --all             # re-validate everything
 *   node scripts/runValidation.js --auto-correct    # apply auto-corrections to queue
 *   node scripts/runValidation.js --dry-run         # run without persisting
 *
 * npm script: npm run validate:batch
 */

require('dotenv').config();

const ValidationPipeline = require('../src/api/validation/index');
const supabase = require('../src/config/supabase');

const args = process.argv.slice(2);
const specificId  = args.includes('--id')           ? args[args.indexOf('--id') + 1] : null;
const revalidateAll = args.includes('--all');
const autoCorrect   = args.includes('--auto-correct');
const dryRun        = args.includes('--dry-run');

async function main() {
  const pipeline = new ValidationPipeline(supabase);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  DIRE-X Validation Pipeline');
  console.log(`  Mode      : ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Correct   : ${autoCorrect ? 'YES' : 'NO'}`);
  console.log('═══════════════════════════════════════');
  console.log('');

  // Single scenario
  if (specificId) {
    console.log(`Running validation on: ${specificId}`);
    const result = await pipeline.run(specificId, { autoCorrect, persist: !dryRun, triggeredBy: 'manual' });
    printResult(result);
    return;
  }

  // Fetch scenario IDs
  let query = supabase.from('dp_scenarios').select('scenario_id');
  if (!revalidateAll) {
    query = query.is('validation_status', null);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    console.error('Failed to fetch scenarios:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No scenarios to validate.');
    return;
  }

  console.log(`Processing ${data.length} scenario(s)...\n`);

  const ids = data.map(r => r.scenario_id);
  const results = await pipeline.runBatch(ids, { autoCorrect, persist: !dryRun, triggeredBy: 'manual' });

  // Summary
  const counts = { validated: 0, needs_review: 0, rejected: 0, error: 0 };
  for (const r of results) {
    if (r.error) { counts.error++; continue; }
    counts[r.status] = (counts[r.status] || 0) + 1;
    if (r.status !== 'validated') printResult(r, true); // show non-passing results
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  Summary');
  console.log('───────────────────────────────────────');
  console.log(`  Total processed : ${results.length}`);
  console.log(`  ✓ Validated     : ${counts.validated}`);
  console.log(`  ⚠ Needs review  : ${counts.needs_review}`);
  console.log(`  ✗ Rejected      : ${counts.rejected}`);
  console.log(`  ✗ Errors        : ${counts.error}`);
  console.log('═══════════════════════════════════════\n');
}

function printResult(result, compact = false) {
  if (result.error) {
    console.log(`  [ERROR] ${result.scenario_id}: ${result.message}`);
    return;
  }

  const icon = result.status === 'validated'    ? '✓'
             : result.status === 'needs_review' ? '⚠'
             : '✗';

  console.log(`  ${icon} ${result.scenario_id} — score: ${result.validation_score} — ${result.status}`);

  if (!compact && result.issues && result.issues.length > 0) {
    for (const iss of result.issues) {
      const prefix = iss.severity === 'CRITICAL' ? '    ✗ CRITICAL'
                   : iss.severity === 'MODERATE' ? '    ⚠ MODERATE'
                   : '    · MINOR';
      console.log(`${prefix} [${iss.rule_id}] ${iss.field}: ${iss.message.slice(0, 100)}`);
    }
  }

  if (result.correction_patch && Object.keys(result.correction_patch).length > 0) {
    console.log(`    → Auto-correction queued: ${Object.keys(result.correction_patch).join(', ')}`);
  }
  if (result.requires_human_review) {
    console.log(`    → Human review required: ${result.human_review_reason?.slice(0, 80)}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
