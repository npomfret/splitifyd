/**
 * Utility functions for working with Firestore documents
 */

/**
 * Recursively removes undefined values from an object before saving to Firestore.
 * Firestore doesn't allow undefined values, so we need to filter them out.
 */
export function removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
        return null;
    }

    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedFields);
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = removeUndefinedFields(value);
            }
        }
        return cleaned;
    }

    return obj;
}