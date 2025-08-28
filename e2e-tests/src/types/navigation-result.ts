/**
 * Common types for navigation and operation results in E2E tests.
 * These provide structured error reporting for better debugging.
 */

/**
 * Basic navigation result with comprehensive context for debugging
 */
export interface NavigationResult {
    success: boolean;
    reason: string;
    startUrl?: string;
    currentUrl: string;
    userInfo?: {
        displayName?: string;
        email?: string;
    };
    error?: string | boolean; // Can be error message or boolean flag
    [key: string]: any; // Allow additional context fields
}

/**
 * Result for page element interactions
 */
export interface ElementInteractionResult extends NavigationResult {
    elementVisible?: boolean;
    elementEnabled?: boolean;
    elementText?: string;
}

/**
 * Result for form navigation operations
 */
export interface FormNavigationResult extends NavigationResult {
    expectedUrlPattern?: string;
    formReady?: boolean;
    expectedMemberCount?: number;
}

/**
 * Result for button click operations
 */
export interface ButtonClickResult extends ElementInteractionResult {
    buttonName?: string;
    addButtonVisible?: boolean;
    addButtonEnabled?: boolean;
}

/**
 * Generic operation result for any E2E operation
 */
export interface OperationResult {
    success: boolean;
    reason: string;
    context?: Record<string, any>;
    error?: string;
    screenshot?: string;
}
