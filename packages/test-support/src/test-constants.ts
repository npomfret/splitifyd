/**
 * Test Constants
 * Standardized timeout values and magic strings for Playwright tests
 */

export const TEST_TIMEOUTS = {
    /** Standard navigation timeout - page transitions, route changes */
    NAVIGATION: 5000,

    /** Input field updates - form field value changes, Preact signal updates */
    INPUT_UPDATE: 1000,

    /** Modal/dialog open/close animations and visibility */
    MODAL_TRANSITION: 2000,

    /** API response timeout - waiting for mocked API responses */
    API_RESPONSE: 3000,

    /** Element visibility - waiting for elements to appear/disappear */
    ELEMENT_VISIBLE: 5000,

    /** Button state changes - enabled/disabled transitions */
    BUTTON_STATE: 1000,

    /** Loading spinner disappearance - async operations completing */
    LOADING_COMPLETE: 5000,

    /** Error message appearance - validation errors, API errors */
    ERROR_DISPLAY: 3000,
} as const;

export const TEST_ROUTES = {
    /** Home/landing page */
    HOME: '/',

    /** Login page */
    LOGIN: '/login',

    /** Registration page */
    REGISTER: '/register',

    /** Dashboard page */
    DASHBOARD: '/dashboard',

    /** Group detail page pattern (for regex matching) */
    GROUP_DETAIL_PATTERN: /\/groups\/[a-zA-Z0-9\-_]+/,

    /** Group detail page builder */
    groupDetail: (groupId: string) => `/groups/${groupId}`,

    /** Join group page */
    joinGroup: (token: string) => `/join/${token}`,

    /** 404 page pattern */
    NOT_FOUND_PATTERN: /\/404/,
} as const;

export const TEST_MESSAGES = {
    /** Empty state messages */
    EMPTY_GROUPS: 'No groups yet',
    EMPTY_EXPENSES: 'No expenses yet',

    /** Balance/settlement messages */
    ALL_SETTLED_UP: 'All settled up!',

    /** Loading messages (use translation keys instead when available) */
    LOADING: 'Loading...',

    /** Error messages (use translation keys instead when available) */
    PAGE_NOT_FOUND: 'Page not found',
    PERMISSION_DENIED: 'Permission denied',

    /** Common button text (prefer translation keys) */
    TRY_AGAIN: 'Try Again',
} as const;

/**
 * Common regex patterns for validation
 */
export const TEST_PATTERNS = {
    /** Numeric display (e.g., group count, expense count) */
    NUMBER: /^\d+$/,

    /** Currency amount with optional decimal places */
    CURRENCY: /^\$?\d+\.?\d*$/,

    /** Email address basic validation */
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

    /** ISO date string */
    ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
} as const;

/**
 * Form validation constants
 */
export const FORM_VALIDATION = {
    /** Minimum group name length */
    MIN_GROUP_NAME_LENGTH: 2,

    /** Minimum password length */
    MIN_PASSWORD_LENGTH: 6,

    /** Maximum description length */
    MAX_DESCRIPTION_LENGTH: 500,
} as const;
