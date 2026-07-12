const { v4: uuidv4 } = require('uuid');

/**
 * BranchManager maintains a decision tree for simulation branches.
 * Each node represents a decision point with its resulting state.
 */
class BranchManager {
  constructor() {
    // Map<branchId, node>
    this._nodes = new Map();
    // Map<simulationId, rootBranchId>
    this._simulations = new Map();
  }

  /**
   * Create a new branch node in the decision tree.
   * @param {string|null} parentId - ID of the parent branch (null for root)
   * @param {string} decision - the decision text
   * @param {object} state - the simulation state snapshot at this branch
   * @returns {object} the created branch node
   */
  createBranch(parentId, decision, state) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const node = {
      id,
      parentId: parentId || null,
      decision,
      state: { ...state },
      children: [],
      timestamp,
      depth: 0,
    };

    // Calculate depth from parent
    if (parentId && this._nodes.has(parentId)) {
      const parent = this._nodes.get(parentId);
      node.depth = parent.depth + 1;
      parent.children.push(id);
    }

    this._nodes.set(id, node);

    // If this is a root node, register it as a simulation root
    if (!parentId) {
      const simId = state.simulation_id || id;
      this._simulations.set(simId, id);
    }

    return {
      id: node.id,
      parentId: node.parentId,
      decision: node.decision,
      state: node.state,
      children: node.children,
      depth: node.depth,
      timestamp: node.timestamp,
    };
  }

  /**
   * Get a branch node with its full ancestry (path from root to this node).
   * @param {string} branchId
   * @returns {object|null} branch with history array
   */
  getBranch(branchId) {
    const node = this._nodes.get(branchId);
    if (!node) return null;

    // Walk up to root to build history
    const history = [];
    let current = node;
    while (current) {
      history.unshift({
        id: current.id,
        decision: current.decision,
        state: current.state,
        depth: current.depth,
        timestamp: current.timestamp,
      });
      current = current.parentId ? this._nodes.get(current.parentId) : null;
    }

    return {
      id: node.id,
      parentId: node.parentId,
      decision: node.decision,
      state: node.state,
      children: node.children.map((cid) => {
        const child = this._nodes.get(cid);
        return child
          ? { id: child.id, decision: child.decision, depth: child.depth, timestamp: child.timestamp }
          : { id: cid };
      }),
      depth: node.depth,
      timestamp: node.timestamp,
      history,
    };
  }

  /**
   * Get the full decision tree for a simulation.
   * @param {string} simulationId
   * @returns {object|null} tree structure with all nodes
   */
  getTree(simulationId) {
    const rootId = this._simulations.get(simulationId);
    if (!rootId) {
      // Try treating simulationId as a branch ID and walk up to root
      let node = this._nodes.get(simulationId);
      if (!node) return null;

      while (node.parentId && this._nodes.has(node.parentId)) {
        node = this._nodes.get(node.parentId);
      }

      return this._buildTree(node);
    }

    const rootNode = this._nodes.get(rootId);
    if (!rootNode) return null;

    return this._buildTree(rootNode);
  }

  /**
   * Recursively build a tree object from a root node.
   */
  _buildTree(node) {
    const children = node.children
      .map((cid) => this._nodes.get(cid))
      .filter(Boolean)
      .map((child) => this._buildTree(child));

    return {
      id: node.id,
      parentId: node.parentId,
      decision: node.decision,
      state: node.state,
      depth: node.depth,
      timestamp: node.timestamp,
      children,
    };
  }

  /**
   * Get total number of branches tracked.
   */
  get size() {
    return this._nodes.size;
  }

  /**
   * Clear all tracked branches.
   */
  clear() {
    this._nodes.clear();
    this._simulations.clear();
  }
}

module.exports = { BranchManager };
