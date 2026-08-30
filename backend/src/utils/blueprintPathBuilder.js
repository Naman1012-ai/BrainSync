/**
 * Convia Blueprint 2.0 — Canonical Path Builder & Version Identity Utilities
 *
 * Enforces strict validation of all RTDB paths, version keys, and task identifiers.
 * Guarantees that:
 * 1. No JavaScript object can ever be coerced into "[object Object]" in a database path.
 * 2. No dynamic child path can ever evaluate to an empty string "".
 * 3. Both dotted version numbers ("1.0", "19.0") and underscored version keys ("v1_0", "v19_0")
 *    are unambiguously resolved and normalized across all API boundaries and persistence layers.
 */

const INVALID_RTDB_PATH_CHARS = /[.#$\[\]]/;

/**
 * Safely extracts a canonical version key (e.g. "v1_0", "v19_0") from any string, number, or object.
 *
 * @param {string|number|Object} input - Version string, number, or version container object.
 * @returns {string|null} Canonical version key (e.g. "v1_0") or null if input is invalid/empty.
 */
export function extractCanonicalVersionKey(input) {
  if (input === null || input === undefined) return null;

  let raw = input;
  // If an object is passed, extract the most specific version identifier
  if (typeof input === 'object') {
    raw =
      input.key ||
      input.versionKey ||
      input.targetVersion ||
      input.versionId ||
      input.id ||
      input.version ||
      null;

    // Handle single level of nesting (e.g. { targetVersion: { id: "v1_0" } })
    if (typeof raw === 'object' && raw !== null) {
      raw = raw.key || raw.versionKey || raw.targetVersion || raw.versionId || raw.id || raw.version || null;
    }
  }

  if (raw === null || raw === undefined || typeof raw === 'object') return null;

  const str = String(raw).trim();
  if (!str || str === '[object Object]' || str === 'v[object Object]') return null;

  // If already in key format 'v1_0', 'v2_0', 'v19_0', return lowercased key
  if (/^v\d+(_\d+)*$/i.test(str)) {
    return str.toLowerCase();
  }

  // If in dotted format '1.0', '19.0', convert to 'v1_0', 'v19_0'
  const cleanDots = str.replace(/^v/i, '').replace(/\./g, '_');
  if (!cleanDots) return null;

  return `v${cleanDots}`;
}

/**
 * Safely extracts a canonical version number (e.g. "1.0", "19.0") from any string, number, or object.
 *
 * @param {string|number|Object} input - Version string, number, or version container object.
 * @returns {string|null} Canonical version number (e.g. "1.0") or null if input is invalid/empty.
 */
export function extractCanonicalVersionNumber(input) {
  if (input === null || input === undefined) return null;

  let raw = input;
  if (typeof input === 'object') {
    raw =
      input.version ||
      input.versionId ||
      input.targetVersion ||
      input.versionKey ||
      input.key ||
      input.id ||
      null;

    if (typeof raw === 'object' && raw !== null) {
      raw = raw.version || raw.versionId || raw.targetVersion || raw.versionKey || raw.key || raw.id || null;
    }
  }

  if (raw === null || raw === undefined || typeof raw === 'object') return null;

  const str = String(raw).trim();
  if (!str || str === '[object Object]' || str === 'v[object Object]') return null;

  // If in key format 'v1_0', 'v19_0', convert to '1.0', '19.0'
  if (/^v\d+(_\d+)*$/i.test(str)) {
    return str.substring(1).replace(/_/g, '.');
  }

  const clean = str.replace(/^v/i, '');
  return clean || null;
}

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates a single path segment for Firebase Realtime Database compatibility.
 *
 * @param {string} segment - The path segment to validate.
 * @param {string} segmentName - Logical name for error reporting (e.g. 'workspaceId', 'taskId').
 * @returns {string} Clean trimmed path segment.
 */
export function validatePathSegment(segment, segmentName = 'pathSegment') {
  if (segment === null || segment === undefined) {
    throw new Error(`Invalid RTDB path: ${segmentName} is required (received ${String(segment)}).`);
  }

  if (typeof segment === 'object') {
    throw new Error(`Invalid RTDB path: ${segmentName} cannot be an Object (received [object Object]).`);
  }

  const clean = String(segment).trim();
  if (!clean) {
    throw new Error(`Invalid RTDB path: ${segmentName} cannot be an empty string.`);
  }

  if (clean.includes('[object Object]')) {
    throw new Error(`Invalid RTDB path: ${segmentName} contains '[object Object]'.`);
  }

  if (PROTOTYPE_POLLUTION_KEYS.has(clean.toLowerCase())) {
    throw new Error(`Invalid RTDB path: ${segmentName} cannot be prototype property '${clean}'.`);
  }

  if (INVALID_RTDB_PATH_CHARS.test(clean)) {
    throw new Error(`Invalid RTDB path: ${segmentName} '${clean}' contains illegal characters (., #, $, [, ]).`);
  }

  return clean;
}

/**
 * Canonical Path Builders
 */

export function buildBlueprintPath(workspaceId, mvpIdeaId) {
  const wId = validatePathSegment(workspaceId, 'workspaceId');
  const mId = validatePathSegment(mvpIdeaId, 'mvpIdeaId');
  return `blueprints/${wId}/${mId}`;
}

export function buildBlueprintVersionPath(workspaceId, mvpIdeaId, versionInput) {
  const wId = validatePathSegment(workspaceId, 'workspaceId');
  const mId = validatePathSegment(mvpIdeaId, 'mvpIdeaId');
  const vKey = extractCanonicalVersionKey(versionInput);
  if (!vKey) {
    throw new Error(`Invalid RTDB path: blueprintVersion could not be resolved from input '${String(versionInput)}'.`);
  }
  const cleanVKey = validatePathSegment(vKey, 'versionKey');
  return `blueprints/${wId}/${mId}/versions/${cleanVKey}`;
}

export function buildTaskPath(workspaceId, taskId) {
  const wId = validatePathSegment(workspaceId, 'workspaceId');
  const tId = validatePathSegment(taskId, 'taskId');
  return `tasks/${wId}/${tId}`;
}

export function buildTasksCollectionPath(workspaceId) {
  const wId = validatePathSegment(workspaceId, 'workspaceId');
  return `tasks/${wId}`;
}

/**
 * Validates all keys and values in an RTDB multi-path update map.
 * Rejects empty string keys, undefined keys, prototype pollution, and [object Object] artifacts.
 *
 * @param {Object} updates - Dictionary of path -> value updates.
 * @param {string} operationContext - Context name for error messages.
 */
export function validateRtdbUpdateMap(updates, operationContext = 'updateData') {
  if (!updates || typeof updates !== 'object') {
    throw new Error(`[${operationContext}] Update payload must be a non-null object.`);
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return;
  }

  for (const key of keys) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error(`[${operationContext}] Invalid update key: empty string or non-string key detected in update map.`);
    }

    if (key.includes('[object Object]')) {
      throw new Error(`[${operationContext}] Invalid update key: '[object Object]' detected in path '${key}'.`);
    }

    // Split key by slashes and validate each segment
    const segments = key.split('/').filter(Boolean);
    for (const segment of segments) {
      if (PROTOTYPE_POLLUTION_KEYS.has(segment.toLowerCase())) {
        throw new Error(`[${operationContext}] Invalid update key '${key}': prototype property '${segment}' detected.`);
      }
      if (INVALID_RTDB_PATH_CHARS.test(segment)) {
        throw new Error(`[${operationContext}] Invalid update key '${key}': segment '${segment}' contains illegal RTDB characters.`);
      }
    }
  }
}

/**
 * Recursively strips prototype pollution vectors (__proto__, constructor, prototype)
 * from any JavaScript object or array.
 *
 * @param {any} obj - Input object, array, or scalar to sanitize.
 * @returns {any} Sanitized clone with dangerous properties removed.
 */
export function stripPrototypePollution(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(stripPrototypePollution);
  }

  const cleanObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      continue;
    }
    cleanObj[key] = stripPrototypePollution(value);
  }

  return { ...cleanObj };
}
