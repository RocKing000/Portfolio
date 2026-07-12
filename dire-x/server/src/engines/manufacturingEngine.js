/**
 * Manufacturing Engine
 * Pipeline: Raw Resources → Refining → Manufacturing → Output → Market
 * Deterministic calculations, no AI-generated numbers.
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Calculate refining output from raw resources.
 */
function processRefining(rawInputs, refiningStages, scenarioMultipliers) {
  const results = [];

  for (const stage of refiningStages) {
    const inputAvailable = rawInputs[stage.input] || 100;
    const scenarioFactor = scenarioMultipliers?.supply || 1.0;
    const effectiveEfficiency = clamp(stage.efficiency / scenarioFactor, 0.3, 1.0);
    const output = inputAvailable * effectiveEfficiency;
    const cost = inputAvailable * stage.costMultiplier * (2 - effectiveEfficiency);

    results.push({
      stage: stage.name,
      input: stage.input,
      inputAmount: inputAvailable,
      output: stage.output,
      outputAmount: Math.round(output * 100) / 100,
      efficiency: Math.round(effectiveEfficiency * 1000) / 1000,
      cost: Math.round(cost * 100) / 100,
      status: effectiveEfficiency > 0.7 ? 'optimal' : effectiveEfficiency > 0.5 ? 'degraded' : 'critical',
    });
  }

  return results;
}

/**
 * Calculate manufacturing output from refined materials.
 */
function processManufacturing(refinedInputs, manufacturingStages, workforce, scenarioMultipliers) {
  const results = [];

  for (const stage of manufacturingStages) {
    // Check input availability
    let inputSatisfaction = 1.0;
    const inputStatus = {};

    for (const input of stage.inputs) {
      const available = refinedInputs[input] || 50;
      const needed = 100;
      const satisfaction = Math.min(1, available / needed);
      inputSatisfaction = Math.min(inputSatisfaction, satisfaction);
      inputStatus[input] = { available, needed, satisfaction: Math.round(satisfaction * 100) / 100 };
    }

    const scenarioFactor = scenarioMultipliers?.supply || 1.0;
    const workforceModifier = workforce ? (workforce.productivity * 0.5 + workforce.skill_level * 0.3 + workforce.morale * 0.2) : 0.7;
    const effectiveEfficiency = clamp(stage.efficiency * inputSatisfaction * workforceModifier / scenarioFactor, 0.2, 1.0);
    const wasteActual = stage.waste * (2 - effectiveEfficiency);
    const outputAmount = stage.capacity * effectiveEfficiency * (1 - wasteActual);
    const energyCost = stage.energyIntensity * stage.capacity * 0.01;

    results.push({
      stage: stage.name,
      product: stage.output,
      capacity: stage.capacity,
      outputAmount: Math.round(outputAmount * 100) / 100,
      efficiency: Math.round(effectiveEfficiency * 1000) / 1000,
      waste: Math.round(wasteActual * 1000) / 1000,
      energyCost: Math.round(energyCost * 100) / 100,
      inputSatisfaction: Math.round(inputSatisfaction * 100) / 100,
      inputStatus,
      status: effectiveEfficiency > 0.7 ? 'optimal' : effectiveEfficiency > 0.5 ? 'degraded' : 'critical',
    });
  }

  return results;
}

/**
 * Full pipeline execution for a company.
 */
function runPipeline({ resources, refiningProfile, workforce, scenarioMultipliers }) {
  if (!refiningProfile) {
    return {
      refining: [],
      manufacturing: [],
      totalOutput: 0,
      totalWaste: 0,
      pipelineHealth: 0.5,
      bottlenecks: [],
    };
  }

  // Build raw input map from resource dependencies
  const rawInputs = {};
  for (const r of resources) {
    rawInputs[r.name] = 100 * (1 - r.dependency * 0.3); // higher dep = more constrained
  }

  // Run refining
  const refiningResults = processRefining(rawInputs, refiningProfile.stages || [], scenarioMultipliers);

  // Build refined input map
  const refinedInputs = {};
  for (const r of refiningResults) {
    refinedInputs[r.output] = r.outputAmount;
  }
  // Also pass through raw resources that bypass refining
  for (const [key, val] of Object.entries(rawInputs)) {
    if (!refinedInputs[key]) refinedInputs[key] = val;
  }

  // Run manufacturing
  const manufacturingResults = processManufacturing(
    refinedInputs,
    refiningProfile.manufacturing || [],
    workforce,
    scenarioMultipliers
  );

  // Aggregate
  const totalOutput = manufacturingResults.reduce((sum, m) => sum + m.outputAmount, 0);
  const totalWaste = manufacturingResults.reduce((sum, m) => sum + m.waste * m.capacity, 0);

  // Identify bottlenecks
  const bottlenecks = [];
  for (const r of refiningResults) {
    if (r.status === 'critical') bottlenecks.push({ type: 'refining', stage: r.stage, efficiency: r.efficiency });
  }
  for (const m of manufacturingResults) {
    if (m.status === 'critical') bottlenecks.push({ type: 'manufacturing', stage: m.stage, efficiency: m.efficiency });
    if (m.inputSatisfaction < 0.6) {
      bottlenecks.push({ type: 'input_shortage', stage: m.stage, satisfaction: m.inputSatisfaction });
    }
  }

  // Pipeline health
  const allEfficiencies = [...refiningResults.map(r => r.efficiency), ...manufacturingResults.map(m => m.efficiency)];
  const pipelineHealth = allEfficiencies.length > 0
    ? allEfficiencies.reduce((a, b) => a + b, 0) / allEfficiencies.length
    : 0.5;

  return {
    refining: refiningResults,
    manufacturing: manufacturingResults,
    totalOutput: Math.round(totalOutput * 100) / 100,
    totalWaste: Math.round(totalWaste * 100) / 100,
    pipelineHealth: Math.round(pipelineHealth * 1000) / 1000,
    bottlenecks,
  };
}

module.exports = {
  processRefining,
  processManufacturing,
  runPipeline,
};
