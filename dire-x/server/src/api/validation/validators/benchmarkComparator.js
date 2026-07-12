'use strict';

/**
 * benchmarkComparator.js
 *
 * Stage 5: Compare scenario field values against historical distribution.
 * Uses z-score analysis to flag statistical outliers.
 *
 * z-score = (observed - mean) / stddev
 *   |z| > 2.0 → OUTLIER  → MINOR issue
 *   |z| > 3.0 → OUTLIER  → MODERATE issue
 *   3+ OUTLIER fields simultaneously → CRITICAL issue
 *
 * Returns: { issues: Issue[], benchmarkResults: object, corrections: object[] }
 */

const { getBenchmark } = require('../data/benchmarkLibrary');

function issue(ruleId, severity, field, message, observed, expected, autoCorrectable = false) {
  return { rule_id: ruleId, severity, field, message, observed_value: observed, expected_range: expected, auto_correctable: autoCorrectable };
}

/**
 * @param {object} scenario
 * @returns {{ issues: object[], benchmarkResults: object, corrections: object[] }}
 */
function runBenchmarkComparator(scenario) {
  const issues = [];
  const corrections = [];

  const bench = getBenchmark(scenario.event_type);

  if (!bench) {
    return {
      issues,
      corrections,
      benchmarkResults: {
        archetype_matched: null,
        source_events: null,
        field_comparisons: [],
        overall_benchmark_flag: 'SKIPPED',
        note: `No benchmark defined for event_type '${scenario.event_type}'.`,
      },
    };
  }

  const fieldComparisons = [];
  const outlierFields = [];

  for (const [field, dist] of Object.entries(bench.distribution)) {
    const val = scenario[field];
    if (val === undefined || val === null) continue;
    if (dist.stddev === 0) continue;

    const zScore = (val - dist.mean) / dist.stddev;
    const absZ   = Math.abs(zScore);

    let flag;
    if      (absZ > 3.0) flag = 'OUTLIER';
    else if (absZ > 2.0) flag = 'OUTLIER';
    else if (absZ > 1.5) flag = 'UNUSUAL';
    else                 flag = 'NORMAL';

    const comparison = {
      field,
      scenario_value:  val,
      benchmark_mean:  dist.mean,
      benchmark_stddev:dist.stddev,
      z_score:         Math.round(zScore * 100) / 100,
      flag,
    };
    fieldComparisons.push(comparison);

    if (flag === 'OUTLIER') {
      outlierFields.push(comparison);

      // Severity escalates with z-score magnitude
      const severity = absZ > 3.0 ? 'MODERATE' : 'MINOR';
      const direction = zScore > 0 ? 'above' : 'below';

      issues.push(issue(
        `BENCH-${field.toUpperCase()}`,
        severity,
        field,
        `Field '${field}' value ${val} is ${absZ.toFixed(1)}σ ${direction} historical mean ${dist.mean} for event_type '${scenario.event_type}'. Source: ${bench.source}.`,
        val,
        { benchmark_mean: dist.mean, stddev: dist.stddev, z_score: zScore },
        true
      ));

      // Correction: pull toward mean ± 1σ
      const correctedValue = zScore > 0
        ? dist.mean + dist.stddev         // pull down
        : dist.mean - dist.stddev;        // pull up

      corrections.push({
        rule_id: `BENCH-${field}`,
        patch: { [field]: parseFloat(correctedValue.toFixed(2)) },
        strategy: `benchmark_pull_to_1sigma (z=${zScore.toFixed(2)})`,
      });
    }
  }

  // If 3+ fields are outliers simultaneously → escalate to CRITICAL
  if (outlierFields.length >= 3) {
    issues.push(issue(
      'BENCH-MULTI-OUTLIER',
      'CRITICAL',
      'multiple_fields',
      `${outlierFields.length} fields are statistical outliers simultaneously: ${outlierFields.map(f => f.field).join(', ')}. This scenario deviates from historical patterns across multiple dimensions — likely misconfigured or based on incorrect assumptions.`,
      outlierFields.map(f => ({ field: f.field, z_score: f.z_score })),
      { max_outlier_fields: 2 },
      false
    ));
  }

  const overall_benchmark_flag = issues.some(i => i.severity === 'CRITICAL') ? 'FAIL'
    : issues.some(i => i.severity === 'MODERATE')                            ? 'WARN'
    : issues.some(i => i.severity === 'MINOR')                               ? 'WARN'
    : 'PASS';

  return {
    issues,
    corrections,
    benchmarkResults: {
      archetype_matched:   scenario.event_type,
      source_events:       bench.source,
      field_comparisons:   fieldComparisons,
      overall_benchmark_flag,
    },
  };
}

module.exports = { runBenchmarkComparator };
