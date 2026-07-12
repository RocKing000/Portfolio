const cron = require('node-cron');
const { runDailyIngestion } = require('./dailyIngestion');
const ValidationPipeline = require('../api/validation/index');
const supabase = require('../config/supabase');

let scheduledTask = null;
let validationTask = null;

/**
 * Start the cron scheduler for daily ingestion at midnight.
 */
function startScheduler() {
  if (scheduledTask) {
    console.warn('[Scheduler] Already running, skipping duplicate start');
    return;
  }

  scheduledTask = cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] 08:00 AM ingestion triggered');
    try {
      const result = await runDailyIngestion();
      console.log('[Scheduler] Ingestion complete:', JSON.stringify({
        metrics_updated: result.metrics_updated,
        snapshot_id: result.snapshot_id,
        elapsed_ms: result.elapsed_ms,
      }));
    } catch (err) {
      console.error('[Scheduler] Ingestion failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('[Scheduler] Daily ingestion scheduled at 08:00 UTC');

  // Nightly batch validation at 02:00 UTC — validates all unvalidated + stale scenarios
  validationTask = cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] 02:00 UTC nightly validation run started');
    try {
      await runNightlyValidation();
    } catch (err) {
      console.error('[Scheduler] Nightly validation failed:', err.message);
    }
  }, { scheduled: true, timezone: 'UTC' });

  console.log('[Scheduler] Nightly validation scheduled at 02:00 UTC');
}

/**
 * Validate all unvalidated or stale (>90 days) scenarios in batches of 50.
 */
async function runNightlyValidation() {
  const pipeline = new ValidationPipeline(supabase);

  // Fetch unvalidated scenarios
  const { data: unvalidated } = await supabase
    .from('dp_scenarios')
    .select('scenario_id')
    .is('validation_status', null)
    .limit(500);

  // Fetch stale validated scenarios (last validated > 90 days ago)
  const staleThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from('dp_scenarios')
    .select('scenario_id')
    .lt('last_validated_at', staleThreshold)
    .not('validation_status', 'is', null)
    .limit(200);

  const ids = [
    ...(unvalidated || []).map(r => r.scenario_id),
    ...(stale || []).map(r => r.scenario_id),
  ];

  if (ids.length === 0) {
    console.log('[Scheduler] Nightly validation: no scenarios to process.');
    return;
  }

  console.log(`[Scheduler] Nightly validation: processing ${ids.length} scenario(s).`);

  // Process in batches of 50 to stay within Supabase rate limits
  const BATCH_SIZE = 50;
  let processed = 0;
  let validated = 0;
  let needsReview = 0;
  let rejected = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await pipeline.runBatch(batch, { autoCorrect: true, triggeredBy: 'scheduled' });

    for (const r of results) {
      if (!r.error) {
        processed++;
        if (r.status === 'validated')    validated++;
        if (r.status === 'needs_review') needsReview++;
        if (r.status === 'rejected')     rejected++;
      }
    }
  }

  console.log(`[Scheduler] Nightly validation complete: ${processed} processed, ${validated} validated, ${needsReview} needs_review, ${rejected} rejected.`);
}

/**
 * Stop the scheduler.
 */
function stopScheduler() {
  if (scheduledTask)  { scheduledTask.stop();  scheduledTask  = null; }
  if (validationTask) { validationTask.stop(); validationTask = null; }
  console.log('[Scheduler] Stopped');
}

/**
 * Trigger ingestion manually (for ad-hoc runs or testing).
 */
async function triggerManualIngestion() {
  console.log('[Scheduler] Manual ingestion triggered');
  try {
    const result = await runDailyIngestion();
    return result;
  } catch (err) {
    console.error('[Scheduler] Manual ingestion failed:', err.message);
    throw err;
  }
}

module.exports = { startScheduler, stopScheduler, triggerManualIngestion, runNightlyValidation };
