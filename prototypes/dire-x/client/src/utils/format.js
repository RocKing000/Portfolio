/**
 * Format a metric value to 1 decimal place
 * @param {number} value
 * @returns {string}
 */
export function formatMetric(value) {
  if (value == null || isNaN(value)) return '0.0';
  return Number(value).toFixed(1);
}

/**
 * Format a day number
 * @param {number} day
 * @returns {string}
 */
export function formatDay(day) {
  return `Day ${day}`;
}

/**
 * Get Tailwind color class for severity level
 * @param {number} severity - 1 to 5
 * @returns {string}
 */
export function getSeverityColor(severity) {
  if (severity >= 5) return 'text-red-500';
  if (severity >= 4) return 'text-red-400';
  if (severity >= 3) return 'text-orange-400';
  if (severity >= 2) return 'text-yellow-400';
  return 'text-green-400';
}

/**
 * Get background Tailwind class for severity
 * @param {number} severity
 * @returns {string}
 */
export function getSeverityBgColor(severity) {
  if (severity >= 5) return 'bg-red-500';
  if (severity >= 4) return 'bg-red-400';
  if (severity >= 3) return 'bg-orange-400';
  if (severity >= 2) return 'bg-yellow-400';
  return 'bg-green-400';
}

/**
 * Get emoji icon for event type
 * @param {string} type
 * @returns {string}
 */
export function getTypeIcon(type) {
  const icons = {
    supply: '\u{1F4E6}',
    economy: '\u{1F4C8}',
    environment: '\u{1F30D}',
    stability: '\u{1F3DB}\uFE0F',
  };
  return icons[type] || '\u{26A0}\uFE0F';
}

/**
 * Get color for dimension type
 * @param {string} type
 * @returns {{ text: string, bg: string, border: string, hex: string }}
 */
export function getTypeColor(type) {
  const colors = {
    supply: {
      text: 'text-blue-400',
      bg: 'bg-blue-400',
      border: 'border-blue-400',
      hex: '#60a5fa',
    },
    economy: {
      text: 'text-green-400',
      bg: 'bg-green-400',
      border: 'border-green-400',
      hex: '#4ade80',
    },
    environment: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-400',
      border: 'border-emerald-400',
      hex: '#34d399',
    },
    stability: {
      text: 'text-amber-400',
      bg: 'bg-amber-400',
      border: 'border-amber-400',
      hex: '#fbbf24',
    },
  };
  return (
    colors[type] || {
      text: 'text-gray-400',
      bg: 'bg-gray-400',
      border: 'border-gray-400',
      hex: '#9ca3af',
    }
  );
}

/**
 * Clamp a value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get SRES score color
 * @param {number} score - 0-100
 * @returns {string} tailwind text class
 */
export function getScoreColor(score) {
  if (score >= 75) return 'text-red-400';
  if (score >= 50) return 'text-orange-400';
  if (score >= 25) return 'text-yellow-400';
  return 'text-green-400';
}

/**
 * Get SRES score label
 * @param {number} score
 * @returns {string}
 */
export function getScoreLabel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}
