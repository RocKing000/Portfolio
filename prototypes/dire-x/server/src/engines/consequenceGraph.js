// ============================================
// Consequence Graph — Records every cause→effect relationship
// Enables attribution: "62% decision, 28% scenario, 10% drift"
// ============================================

class ConsequenceGraph {
  constructor(maxEdges = 10000) {
    this.edges = [];
    this.maxEdges = maxEdges;
  }

  /**
   * Record a single causal edge.
   */
  addEdge(from, to, weight, engine, tick, companyId) {
    if (this.edges.length >= this.maxEdges) {
      // Keep recent half
      this.edges = this.edges.slice(-(this.maxEdges / 2));
    }
    this.edges.push({
      from,
      to,
      weight: Math.round(weight * 1000) / 1000,
      engine,
      tick,
      companyId,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a full simulation result as graph edges.
   */
  recordSimulation(companyId, result) {
    const tick = result.day || 0;
    const intent = result.decision?.intent || 'unknown';
    const intensity = result.decision?.intensity || 5;
    const affectedResources = result.decision?.affected_resources?.resources || [];

    // Decision → Resource SRES changes
    for (const rs of result.sres?.resources || []) {
      const isAffected = affectedResources.some((r) =>
        (rs.resource_name || '').toLowerCase().replace(/\s+/g, '_').includes(r)
      );
      if (isAffected) {
        this.addEdge(
          `decision:${intent}`,
          `resource:${rs.resource_name}:sres`,
          intensity / 10,
          'simulationOrchestrator',
          tick,
          companyId
        );
      }
    }

    // SRES → Impact dimensions
    const impact = result.impact || {};
    for (const dim of ['supply', 'economy', 'environment', 'stability']) {
      if ((impact[dim] || 0) > 0.01) {
        this.addEdge(`sres:company`, `impact:${dim}`, impact[dim], 'impactEngine', tick, companyId);
      }
    }

    // Scenario → multiplier effects
    if (result.scenario && result.scenario !== 'stable') {
      this.addEdge(
        `scenario:${result.scenario}`,
        `stress:level`,
        (result.metadata?.stress_level || 0) * 0.01,
        'scenarioEngine',
        tick,
        companyId
      );
    }

    // Events → specific impacts
    for (const evt of result.events || []) {
      this.addEdge(
        `event:${evt.type}:${evt.template_id || 'unknown'}`,
        `impact:${evt.type}`,
        (evt.severity || 3) / 5,
        'eventEngine',
        tick,
        companyId
      );
    }
  }

  /**
   * Record a world tick for a company (scenario-driven changes).
   */
  recordTick(companyId, tick, source, dimension, delta) {
    if (Math.abs(delta) < 0.01) return;
    this.addEdge(`tick:${source}`, `metric:${dimension}`, delta, 'worldState', tick, companyId);
  }

  /**
   * Get attribution breakdown for a company's recent outcomes.
   * @param {string} companyId
   * @param {number} recentTicks — how far back to look
   * @returns {{ decision, scenario, event, drift }}
   */
  getAttribution(companyId, recentTicks = 10) {
    const latestTick = this.edges.length > 0 ? this.edges[this.edges.length - 1].tick : 0;
    const cutoff = latestTick - recentTicks;

    const relevant = this.edges.filter(
      (e) => e.companyId === companyId && e.tick >= cutoff
    );

    const sources = { decision: 0, scenario: 0, event: 0, drift: 0 };
    let total = 0;

    for (const edge of relevant) {
      const w = Math.abs(edge.weight);
      if (edge.from.startsWith('decision:')) sources.decision += w;
      else if (edge.from.startsWith('scenario:')) sources.scenario += w;
      else if (edge.from.startsWith('event:')) sources.event += w;
      else sources.drift += w;
      total += w;
    }

    if (total === 0) {
      return { decision: 0.25, scenario: 0.25, event: 0.25, drift: 0.25 };
    }

    return {
      decision: Math.round((sources.decision / total) * 100) / 100,
      scenario: Math.round((sources.scenario / total) * 100) / 100,
      event: Math.round((sources.event / total) * 100) / 100,
      drift: Math.round((sources.drift / total) * 100) / 100,
    };
  }

  /**
   * Get recent causal chain leading to a specific outcome.
   */
  getRecentChain(companyId, limit = 20) {
    return this.edges
      .filter((e) => e.companyId === companyId)
      .slice(-limit);
  }

  /**
   * Get total edge count.
   */
  get size() {
    return this.edges.length;
  }

  /**
   * Clear all edges.
   */
  clear() {
    this.edges = [];
  }
}

module.exports = { ConsequenceGraph };
