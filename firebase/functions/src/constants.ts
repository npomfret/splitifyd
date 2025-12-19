/**
 * Application Constants
 *
 * This file contains configuration constants used throughout the application.
 * Separated from types to maintain clean architectural boundaries.
 */

/**
 * Firestore collection names and API route segments.
 * Centralized constant to ensure consistency across the application.
 */
export const FirestoreCollections = {
    GROUPS: 'groups',
    GROUP_MEMBERSHIPS: 'group-memberships',
    EXPENSES: 'expenses',
    SETTLEMENTS: 'settlements',
    USERS: 'users',
    POLICIES: 'policies',
    COMMENTS: 'comments',
    REACTIONS: 'reactions', // API route segment only - reactions are denormalized on parent documents
    ACTIVITY_FEED: 'activity-feed',
    SHARE_LINK_TOKENS: 'share-link-tokens',
    TENANTS: 'tenants',
    ACCOUNT_MERGES: 'account-merges',
    BALANCES: 'balances',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const;

// Policy Constants
export const ALLOWED_POLICY_IDS = new Set<string>([
    'terms-of-service',
    'privacy-policy',
    'cookie-policy',
]);

// Validation Limits
export const VALIDATION_LIMITS = {
    MAX_PROPERTY_NAME_LENGTH: 200,
    MAX_STRING_LENGTH: 50000,
    MAX_ARRAY_STRING_LENGTH: 10000,
    MAX_NESTED_OBJECT_DEPTH: 20,
    MAX_ARRAY_ITEMS: 1000,
    MAX_NESTED_PROPERTY_NAME_LENGTH: 100,
    MAX_NESTED_STRING_LENGTH: 10000,
    MAX_NESTED_ARRAY_ITEMS: 100,
    MAX_NESTED_OBJECT_PROPERTIES: 100,
    MAX_ROOT_OBJECT_PROPERTIES: 500,
    MAX_DOCUMENT_DEPTH: 10,
    DOCUMENT_PREVIEW_LENGTH: 100,
    MAX_DISPLAY_NAME_LENGTH: 50,
    MAX_GROUP_NAME_LENGTH: 100,
    MAX_GROUP_DESCRIPTION_LENGTH: 500,
    MAX_GROUP_MEMBERS: 50,
} as const;

// Document Configuration
export const DOCUMENT_CONFIG = {
    LIST_LIMIT: 100,
    PREVIEW_LENGTH: 100,
    PAGINATION_EXTRA_ITEM: 1,
    DEPLOYED_MAX_STRING_LENGTH: 50000,
    EMULATOR_MAX_STRING_LENGTH: 100000,
    DEPLOYED_MAX_PROPERTY_COUNT: 500,
    EMULATOR_MAX_PROPERTY_COUNT: 1000,
} as const;

// Authentication
export const AUTH = {
    BEARER_TOKEN_PREFIX_LENGTH: 7,
    TOKEN_LOG_PREFIX_LENGTH: 10,
} as const;

// System Constants
export const SYSTEM = {
    BYTES_PER_KB: 1024,
    AUTH_LIST_LIMIT: 1,
} as const;
