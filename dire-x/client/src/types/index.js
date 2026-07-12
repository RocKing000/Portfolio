/**
 * @typedef {Object} Company
 * @property {string} id - Unique company identifier
 * @property {string} name - Company display name
 * @property {string} sector - Industry sector
 * @property {string} country - Country of origin
 * @property {number} spiScore - Supply Vulnerability Index (0-100)
 * @property {number} ecoScore - Economic Resilience Index (0-100)
 * @property {number} envScore - Environmental Risk Index (0-100)
 * @property {number} stabScore - Geopolitical Stability Index (0-100)
 * @property {number} sresScore - Combined SRES score (0-100)
 * @property {Resource[]} resources - Key resource dependencies
 */

/**
 * @typedef {Object} Resource
 * @property {string} name - Resource name
 * @property {string} origin - Source country/region
 * @property {number} dependency - Dependency level (0-100)
 * @property {number} risk - Current risk level (0-100)
 * @property {string} category - supply | economy | environment | stability
 */

/**
 * @typedef {Object} RiskMetrics
 * @property {number} supply - Supply chain risk (0-100)
 * @property {number} economy - Economic risk (0-100)
 * @property {number} environment - Environmental risk (0-100)
 * @property {number} stability - Geopolitical stability (0-100)
 */

/**
 * @typedef {Object} SimulationResult
 * @property {RiskMetrics} metrics - Updated metrics after simulation
 * @property {Event[]} events - New events generated
 * @property {string} narration - AI-generated explanation
 * @property {number} day - Current simulation day
 */

/**
 * @typedef {Object} Event
 * @property {string} id - Unique event identifier
 * @property {string} type - supply | economy | environment | stability
 * @property {string} title - Event headline
 * @property {string} description - Event description
 * @property {number} severity - Severity level (1-5)
 * @property {number} day - Day the event occurred
 * @property {RiskMetrics} [impact] - Impact on metrics
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {number} day - Day number
 * @property {Event[]} events - Events on this day
 * @property {RiskMetrics} metrics - Metrics snapshot at this day
 * @property {string} [decision] - Player decision on this day
 * @property {string} [narration] - AI narration for this day
 */

/**
 * @typedef {Object} Branch
 * @property {string} id - Branch identifier
 * @property {string} label - Branch display label
 * @property {number} fromDay - Day the branch was created
 * @property {TimelineEntry[]} entries - Timeline entries for this branch
 * @property {string|null} parentBranch - Parent branch id
 */

export {};
