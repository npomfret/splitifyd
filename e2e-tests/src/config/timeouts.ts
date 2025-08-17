/**
 * Centralized timeout configuration for E2E tests
 *
 * These values are based on typical UI response times:
 * - QUICK: Fast UI interactions (button clicks, form field updates)
 * - STANDARD: Normal page loads and navigation
 * - LONG: Complex operations, API calls with processing
 * - EXTENDED: Network-heavy operations, file uploads
 */

export const TIMEOUTS = {
    // Quick operations - form validation, button state changes
    QUICK: 500,

    // Standard operations - page navigation, element visibility
    STANDARD: 1000,

    // Long operations - API calls, complex page loads
    LONG: 3000,

    // Extended operations - file operations, network requests
    EXTENDED: 5000,
} as const;

// Specific timeout contexts for common operations
export const TIMEOUT_CONTEXTS = {
    // Navigation timeouts
    PAGE_NAVIGATION: TIMEOUTS.STANDARD,
    URL_CHANGE: TIMEOUTS.STANDARD,

    // Element interaction timeouts
    ELEMENT_VISIBILITY: TIMEOUTS.QUICK,
    BUTTON_STATE_CHANGE: TIMEOUTS.QUICK,

    // Form operation timeouts
    FORM_SUBMISSION: TIMEOUTS.LONG,
    VALIDATION_DISPLAY: TIMEOUTS.QUICK,

    // API operation timeouts
    API_RESPONSE: TIMEOUTS.EXTENDED,
    GROUP_CREATION: TIMEOUTS.EXTENDED,

    // Error handling timeouts
    ERROR_DISPLAY: TIMEOUTS.EXTENDED,
    NETWORK_ERROR: TIMEOUTS.LONG,

    // Test simulation timeouts
    SIMULATED_TIMEOUT_DELAY: 10000, // For tests that simulate timeout scenarios
} as const;
