/**
 * Auto-merge utility for collaborative editing
 * Implements field-level three-way merge
 */

export interface MergeConflict {
  field: string;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
}

export interface MergeResult<T> {
  /** The merged data, or null if merge failed completely */
  merged: T | null;
  /** Whether any fields were updated from remote */
  hasRemoteChanges: boolean;
  /** Fields that were updated from remote */
  updatedFields: string[];
  /** Fields that had conflicts (local and remote both changed) */
  conflicts: MergeConflict[];
  /** Whether the merge was successful (no unresolved conflicts) */
  success: boolean;
}

/**
 * Deep equality check for values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }

  const cloned = {} as Record<string, unknown>;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set nested value in object using dot notation path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Get all field paths from an object (flattened with dot notation)
 */
function getAllFieldPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    // Skip internal fields
    if (key === 'id' || key === 'created_at' || key === 'updated_at') {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      paths.push(...getAllFieldPaths(value as Record<string, unknown>, fullPath));
    } else {
      // Leaf field
      paths.push(fullPath);
    }
  }

  return paths;
}

/**
 * Three-way merge algorithm
 * - If local hasn't changed from base, accept remote
 * - If remote hasn't changed from base, keep local
 * - If both changed, report conflict (but auto-resolve by preferring remote for safety)
 */
export function autoMerge<T extends object>(
  base: T | null,
  local: T | null,
  remote: T | null
): MergeResult<T> {
  // Handle null cases
  if (!remote) {
    return {
      merged: local,
      hasRemoteChanges: false,
      updatedFields: [],
      conflicts: [],
      success: true,
    };
  }

  if (!local || !base) {
    return {
      merged: remote,
      hasRemoteChanges: true,
      updatedFields: Object.keys(remote),
      conflicts: [],
      success: true,
    };
  }

  const merged = deepClone(local);
  const updatedFields: string[] = [];
  const conflicts: MergeConflict[] = [];

  // Get all field paths from all three versions
  const allPaths = new Set([
    ...getAllFieldPaths(base as Record<string, unknown>),
    ...getAllFieldPaths(local as Record<string, unknown>),
    ...getAllFieldPaths(remote as Record<string, unknown>),
  ]);

  for (const path of allPaths) {
    const baseValue = getNestedValue(base as Record<string, unknown>, path);
    const localValue = getNestedValue(local as Record<string, unknown>, path);
    const remoteValue = getNestedValue(remote as Record<string, unknown>, path);

    const localChanged = !deepEqual(baseValue, localValue);
    const remoteChanged = !deepEqual(baseValue, remoteValue);

    if (remoteChanged && !localChanged) {
      // Remote changed, local didn't - accept remote
      setNestedValue(merged as Record<string, unknown>, path, deepClone(remoteValue));
      updatedFields.push(path);
    } else if (remoteChanged && localChanged) {
      // Both changed - conflict
      // Auto-resolve by preferring remote for data safety
      if (!deepEqual(localValue, remoteValue)) {
        conflicts.push({
          field: path,
          baseValue,
          localValue,
          remoteValue,
        });
        // Accept remote to avoid data loss
        setNestedValue(merged as Record<string, unknown>, path, deepClone(remoteValue));
        updatedFields.push(path);
      }
      // If both changed to the same value, no conflict
    }
    // If only local changed or neither changed, keep local (already in merged)
  }

  return {
    merged: merged as T,
    hasRemoteChanges: updatedFields.length > 0,
    updatedFields,
    conflicts,
    success: conflicts.length === 0,
  };
}

/**
 * Format updated fields for display
 */
export function formatUpdatedFields(fields: string[]): string {
  if (fields.length === 0) return '';
  if (fields.length === 1) return fields[0];
  if (fields.length <= 3) return fields.join(', ');
  return `${fields.slice(0, 2).join(', ')} +${fields.length - 2} more`;
}
