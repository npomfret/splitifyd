/**
 * Test Constants
 * Standardized timeout values and magic strings for Playwright tests
 */
import { GroupId } from '@splitifyd/shared';

export const TEST_TIMEOUTS = {
    /** Standard navigation timeout - page transitions, route changes */
    NAVIGATION: 5000,

    /** Input field updates - form field value changes, Preact signal updates */
    INPUT_UPDATE: 1000, // Reduced from 3000ms - mocks respond instantly

    /** Modal/dialog open/close animations and visibility */
    MODAL_TRANSITION: 1000, // Slightly higher to account for dashboard refresh work

    /** API response timeout - waiting for mocked API responses */
    API_RESPONSE: 1000, // Reduced from 3000ms - mocked APIs are instant

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

    /** Join group page */
    joinGroup: (token: string) => `/join/${token}`,

    /** 404 page pattern */
    NOT_FOUND_PATTERN: /\/404/,
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
