# Webapp Issue: Implement Error Boundaries

## Issue Description

A single JavaScript error can take down the whole UI.

## Recommendation

Wrap key execution points in `try...catch` blocks. In the `catch` block, log the error and use a unified UI utility to display a friendly message to the user, allowing the rest of the application to continue functioning.

## Implementation Suggestions

1.  **Identify Key Execution Points:** Focus on asynchronous operations (API calls, Firebase interactions), event handlers, and component rendering logic where errors are most likely to occur and could disrupt the user experience.

2.  **Utilize Centralized UI Message Utility:** Leverage the `showMessage` and `showError` functions from `webapp/src/js/utils/ui-messages.ts` (as recommended in `webapp-redundant-ui-messages.md`) to display user-friendly error messages.

3.  **Example Implementation:**

    ```typescript
    // Example in a component's event handler or an async function
    import { showError } from './utils/ui-messages.ts'; // Assuming this utility is created
    import { logger } from './utils/logger.ts';

    async function handleFormSubmission(event: Event): Promise<void> {
        event.preventDefault();
        try {
            // ... form validation and data collection

            // Example API call
            await apiService.createExpense(expenseData);

            // ... success message

        } catch (error: any) {
            logger.error('Error during form submission:', error);
            showError('An unexpected error occurred. Please try again.');
            // Optionally, show more specific error messages based on error.code or error.message
        }
    }

    // Example in a page initialization function
    async function initializePage(): Promise<void> {
        try {
            await loadInitialData();
            renderPage();
        } catch (error: any) {
            logger.error('Failed to initialize page:', error);
            showError('Failed to load page content. Please refresh.');
        }
    }
    ```

4.  **Global Error Handling (for unhandled errors):**
    While specific `try...catch` blocks are important, also consider a global error handler for unhandled exceptions to prevent the entire application from crashing silently.

    ```typescript
    // webapp/src/js/app-init.ts (or a dedicated error handling module)
    import { showError } from './utils/ui-messages.ts';
    import { logger } from './utils/logger.ts';

    window.addEventListener('error', (event: ErrorEvent) => {
        logger.error('Unhandled JavaScript Error:', event.error);
        showError('An unexpected error occurred. Please refresh the page.');
        // Prevent default browser error handling if you want to fully control the display
        event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        logger.error('Unhandled Promise Rejection:', event.reason);
        showError('An operation failed unexpectedly. Please try again.');
        event.preventDefault();
    });
    ```

**Next Steps:**
1.  Implement the global error handlers.
2.  Review existing `try...catch` blocks and ensure they are consistent with the new centralized UI message utility.
3.  Identify critical user flows and wrap their main execution logic in `try...catch` blocks.
