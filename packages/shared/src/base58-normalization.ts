/**
 * Normalizes display names to base58-compatible format for comparison purposes only.
 * The original display name is stored as-is; this normalization is only used to detect conflicts.
 *
 * Replacements (case-insensitive):
 * - 0 (zero) → o
 * - O (uppercase o) → o
 * - I (uppercase i) → i
 * - l (lowercase L) → i
 *
 * This prevents users from creating similar-looking names like:
 * - "Alice" vs "Al1ce" vs "AIice" vs "Alìce"
 * - "Bob" vs "B0b" vs "BOb"
 *
 * @example
 * normalizeDisplayNameForComparison("Alice") // "aIice"
 * normalizeDisplayNameForComparison("Al1ce") // "aIice" (conflict!)
 * normalizeDisplayNameForComparison("ALICE") // "aIice" (conflict!)
 */
export function normalizeDisplayNameForComparison(displayName: string): string {
    return displayName
        .toLowerCase()
        .replace(/0/g, 'o')    // zero → o
        .replace(/l/g, 'i');   // lowercase L → i (after toLowerCase, both I and l become i)
}

/**
 * Checks if two display names would be considered equivalent after normalization.
 * Used to detect conflicts without restricting what users can type.
 */
export function areDisplayNamesEquivalent(name1: string, name2: string): boolean {
    const normalized1 = normalizeDisplayNameForComparison(name1.trim());
    const normalized2 = normalizeDisplayNameForComparison(name2.trim());
    return normalized1 === normalized2;
}
