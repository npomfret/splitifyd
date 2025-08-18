/**
 * Central export for all E2E test types
 */

export * from './navigation-result';

// Re-export commonly used types for convenience
export type {
    NavigationResult,
    ElementInteractionResult,
    FormNavigationResult,
    ButtonClickResult,
    OperationResult
} from './navigation-result';