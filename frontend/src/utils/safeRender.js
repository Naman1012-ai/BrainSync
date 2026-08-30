/**
 * Safe String & Primitive Extractor for React JSX Children.
 * Guarantees that complex Objects are NEVER directly rendered as React children,
 * preventing "Objects are not valid as a React child" runtime errors.
 */

export function safeText(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      const items = val.map((item) => safeText(item)).filter(Boolean);
      return items.length > 0 ? items.join(', ') : fallback;
    }
    return (
      val.title ||
      val.name ||
      val.feature ||
      val.featureName ||
      val.stepName ||
      val.summary ||
      val.description ||
      val.rationale ||
      val.decision ||
      val.question ||
      val.text ||
      val.value ||
      val.challenge ||
      fallback ||
      ''
    );
  }
  return String(val);
}

export function safeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [val];
}
