// ============================================
// Input Sanitizer — Defends against prompt injection,
// XSS, keyword stuffing, and adversarial inputs
// ============================================

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*note\s*:/i,
  /override\s+(your|the)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /\bpretend\b.*\byou\b/i,
  /return\s+this\s+exact/i,
  /respond\s+(only\s+)?with/i,
  /\bdo\s+not\s+follow\b/i,
  /\bnew\s+instructions?\b.*:/i,
  /\brole\s*:\s*(system|assistant|user)\b/i,
];

/**
 * Sanitize decision text for simulation input.
 * Returns { text, flags, trustPenalty }.
 */
function sanitizeDecisionText(text) {
  if (!text || typeof text !== 'string') {
    return { text: '', flags: ['empty'], trustPenalty: 1.0 };
  }

  const flags = [];
  let trustPenalty = 0;
  let clean = text.slice(0, 500); // Hard cap

  // Check for prompt injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      flags.push('prompt_injection_detected');
      clean = clean.replace(pattern, '[REDACTED]');
      trustPenalty += 0.5;
    }
  }

  // Check for HTML/script injection
  if (/<[^>]+>/g.test(clean)) {
    flags.push('html_injection_detected');
    clean = clean.replace(/<[^>]+>/g, '');
    trustPenalty += 0.3;
  }

  // Check for keyword stuffing (same word 4+ times)
  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const stuffed = Object.entries(freq).filter(([, count]) => count >= 4);
  if (stuffed.length > 0) {
    flags.push('keyword_stuffing_detected');
    trustPenalty += 0.2;
  }

  // Minimum semantic length
  if (words.length < 3) {
    flags.push('too_short');
    trustPenalty += 0.1;
  }

  return {
    text: clean.trim(),
    flags,
    trustPenalty: Math.min(1.0, trustPenalty),
  };
}

/**
 * Sanitize company name — strip dangerous characters.
 */
function sanitizeCompanyName(name) {
  if (!name || typeof name !== 'string') return 'Unnamed Corp';
  return name.slice(0, 100).replace(/[<>"'&;{}()\\/`]/g, '').trim() || 'Unnamed Corp';
}

/**
 * Sanitize query parameters for AI endpoints.
 */
function sanitizeQueryParam(param, maxLen = 100) {
  if (!param || typeof param !== 'string') return '';
  return param
    .slice(0, maxLen)
    .replace(/[<>"'&;{}()\\/`]/g, '')
    .replace(/ignore\s+previous/gi, '')
    .replace(/system\s*note/gi, '')
    .trim();
}

/**
 * Express middleware: sanitize common request fields in-place.
 */
function sanitizerMiddleware(req, _res, next) {
  // Sanitize body fields
  if (req.body) {
    if (req.body.name) {
      req.body.name = sanitizeCompanyName(req.body.name);
    }
    if (req.body.decision) {
      const result = sanitizeDecisionText(req.body.decision);
      req.body.decision = result.text;
      req.inputFlags = result.flags;
      req.inputTrustPenalty = result.trustPenalty;
    }
  }

  // Sanitize query params
  if (req.query) {
    for (const key of ['company', 'nation', 'resources', 'resource']) {
      if (req.query[key]) {
        req.query[key] = sanitizeQueryParam(req.query[key], 200);
      }
    }
  }

  next();
}

module.exports = {
  sanitizeDecisionText,
  sanitizeCompanyName,
  sanitizeQueryParam,
  sanitizerMiddleware,
};
