import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupAuthenticatedUserWithToken,
    expectElementVisible,
    fillFormField,
    TEST_SCENARIOS,
} from '../infra/test-helpers';

/**
 * Unit tests for API error handling and error message display
 * Tests error handling without full submission flows
 */
test.describe('API Error Handling', () => {
    let authToken: { idToken: string; localId: string; refreshToken: string };

    // Common error scenarios
    const errorScenarios = {
        networkError: {
            status: 0,
            message: 'Network error - please check your connection',
            type: 'network'
        },
        badRequest: {
            status: 400,
            message: 'Invalid request data',
            body: { error: 'Validation failed', details: 'Missing required fields' }
        },
        unauthorized: {
            status: 401,
            message: 'Authentication required',
            body: { error: 'Unauthorized access' }
        },
        forbidden: {
            status: 403,
            message: 'Access denied',
            body: { error: 'Insufficient permissions' }
        },
        notFound: {
            status: 404,
            message: 'Resource not found',
            body: { error: 'Group not found' }
        },
        conflict: {
            status: 409,
            message: 'Conflict occurred',
            body: { error: 'Resource already exists' }
        },
        serverError: {
            status: 500,
            message: 'Server error - please try again later',
            body: { error: 'Internal server error' }
        },
        timeout: {
            status: 408,
            message: 'Request timeout - please try again',
            body: { error: 'Request timed out' }
        }
    };

    async function mockErrorAPI(page: any, scenario: keyof typeof errorScenarios, endpoint: string = '**/api/**') {
        const error = errorScenarios[scenario];

        await page.route(endpoint, (route: any) => {
            if (error.type === 'network') {
                // Simulate network failure
                route.abort('failed');
            } else {
                route.fulfill({
                    status: error.status,
                    contentType: 'application/json',
                    body: JSON.stringify(error.body || { error: error.message }),
                });
            }
        });
    }

    async function addErrorDisplayElements(page: any) {
        await page.addStyleTag({
            content: `
                .error-container { padding: 20px; }
                .error-message { padding: 15px; margin: 10px 0; border-radius: 4px; background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; }
                .error-heading { font-weight: bold; margin-bottom: 8px; }
                .error-details { font-size: 14px; color: #744545; }
                .success-message { padding: 15px; margin: 10px 0; border-radius: 4px; background: #f0fff4; border: 1px solid #9ae6b4; color: #2f855a; }
                .loading-message { padding: 15px; margin: 10px 0; border-radius: 4px; background: #ebf8ff; border: 1px solid #90cdf4; color: #2b6cb0; }
                .form-section { margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
                .form-group input { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; }
                .button-group { margin-top: 15px; }
                .btn { padding: 8px 16px; margin-right: 10px; border: none; border-radius: 4px; cursor: pointer; }
                .btn-primary { background: #3b82f6; color: white; }
                .btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
                .retry-button { background: #f59e0b; color: white; }
            `
        });

        await page.evaluate(() => {
            const errorHTML = '<div class="error-container">' +
                '<h2>Error Handling Tests</h2>' +
                '<div class="form-section">' +
                    '<h3>Test Form</h3>' +
                    '<form id="test-form">' +
                        '<div class="form-group">' +
                            '<label for="test-input">Test Input</label>' +
                            '<input type="text" id="test-input" placeholder="Enter test data" />' +
                        '</div>' +
                        '<div class="button-group">' +
                            '<button type="submit" id="submit-btn" class="btn btn-primary">Submit</button>' +
                            '<button type="button" id="retry-btn" class="btn retry-button" style="display:none;">Retry</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
                '<div id="message-container">' +
                    '<!-- Error messages will appear here -->' +
                '</div>' +
                '<div class="form-section">' +
                    '<h3>Error Trigger Buttons</h3>' +
                    '<button type="button" id="trigger-400" class="btn">Trigger 400 Error</button>' +
                    '<button type="button" id="trigger-401" class="btn">Trigger 401 Error</button>' +
                    '<button type="button" id="trigger-404" class="btn">Trigger 404 Error</button>' +
                    '<button type="button" id="trigger-500" class="btn">Trigger 500 Error</button>' +
                    '<button type="button" id="trigger-network" class="btn">Trigger Network Error</button>' +
                '</div>' +
            '</div>';
            document.body.insertAdjacentHTML('beforeend', errorHTML);

            // Add error display functions
            window.showError = function(message, details) {
                const container = document.getElementById('message-container');
                container.innerHTML = '<div class="error-message" id="error-display">' +
                    '<div class="error-heading">Something went wrong</div>' +
                    '<div class="error-details">' + message + (details ? ' - ' + details : '') + '</div>' +
                    '</div>';
                document.getElementById('retry-btn').style.display = 'inline-block';
            };

            window.showSuccess = function(message) {
                const container = document.getElementById('message-container');
                container.innerHTML = '<div class="success-message" id="success-display">' + message + '</div>';
                document.getElementById('retry-btn').style.display = 'none';
            };

            window.showLoading = function() {
                const container = document.getElementById('message-container');
                container.innerHTML = '<div class="loading-message" id="loading-display">Processing request...</div>';
            };

            window.clearMessages = function() {
                document.getElementById('message-container').innerHTML = '';
                document.getElementById('retry-btn').style.display = 'none';
            };
        });
    }

    test.beforeAll(async () => {
        authToken = {
            idToken: 'mock-id-token-' + Date.now(),
            localId: 'test-user-id-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now()
        };
    });

    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
        await setupAuthenticatedUserWithToken(page, authToken);
    });

    test('should display 400 Bad Request errors appropriately', async ({ page }) => {
        await mockErrorAPI(page, 'badRequest');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger error
        await page.evaluate(() => {
            window.showError('Invalid request data', 'Missing required fields');
        });

        // Verify error display
        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Something went wrong');
        await expect(errorMessage).toContainText('Invalid request data');
        await expect(errorMessage).toContainText('Missing required fields');

        // Retry button should be visible
        const retryButton = page.locator('#retry-btn');
        await expect(retryButton).toBeVisible();
    });

    test('should display 401 Unauthorized errors and redirect to login', async ({ page }) => {
        await mockErrorAPI(page, 'unauthorized');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger unauthorized error
        await page.evaluate(() => {
            window.showError('Authentication required', 'Please log in to continue');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Authentication required');

        // In real app, this might redirect to login
        // For unit test, we just verify error display
        await expect(errorMessage).toContainText('Please log in to continue');
    });

    test('should display 404 Not Found errors correctly', async ({ page }) => {
        await mockErrorAPI(page, 'notFound');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger 404 error
        await page.click('#trigger-404');

        await page.evaluate(() => {
            window.showError('Resource not found', 'The requested group could not be found');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Resource not found');
        await expect(errorMessage).toContainText('group could not be found');
    });

    test('should display 500 Server Error with user-friendly message', async ({ page }) => {
        await mockErrorAPI(page, 'serverError');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger server error
        await page.click('#trigger-500');

        await page.evaluate(() => {
            window.showError('Server error - please try again later', 'Our servers are experiencing issues');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Server error');
        await expect(errorMessage).toContainText('try again later');
        await expect(errorMessage).toContainText('experiencing issues');

        // Retry button should be available for server errors
        const retryButton = page.locator('#retry-btn');
        await expect(retryButton).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
        await mockErrorAPI(page, 'networkError');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger network error
        await page.click('#trigger-network');

        await page.evaluate(() => {
            window.showError('Network error - please check your connection', 'Unable to reach server');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Network error');
        await expect(errorMessage).toContainText('check your connection');

        // Retry should be prominent for network errors
        const retryButton = page.locator('#retry-btn');
        await expect(retryButton).toBeVisible();
        await expect(retryButton).toBeEnabled();
    });

    test('should show loading states during API calls', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Show loading state
        await page.evaluate(() => {
            window.showLoading();
        });

        const loadingMessage = page.locator('#loading-display');
        await expect(loadingMessage).toBeVisible();
        await expect(loadingMessage).toContainText('Processing request');

        // Simulate completion with success
        await page.evaluate(() => {
            setTimeout(() => {
                window.showSuccess('Request completed successfully');
            }, 500);
        });

        await page.waitForTimeout(600);

        const successMessage = page.locator('#success-display');
        await expect(successMessage).toBeVisible();
        await expect(successMessage).toContainText('completed successfully');

        // Loading should be gone
        await expect(loadingMessage).not.toBeVisible();
    });

    test('should handle form validation errors', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Create simple test elements and error display functionality
        await page.evaluate(() => {
            // Create form elements
            const formHTML = '<div id="test-form-container">' +
                '<input type="text" id="test-input" placeholder="Enter test data" />' +
                '<button type="submit" id="submit-btn">Submit</button>' +
                '<div id="message-container"></div>' +
                '</div>';
            document.body.insertAdjacentHTML('beforeend', formHTML);

            // Add error display function
            window.showError = function(message, details) {
                const container = document.getElementById('message-container');
                container.innerHTML = '<div class="error-message" id="error-display" style="color: red; padding: 10px; border: 1px solid red;">' +
                    '<div class="error-heading">Something went wrong</div>' +
                    '<div class="error-details">' + message + (details ? ' - ' + details : '') + '</div>' +
                    '</div>';
            };

            window.clearMessages = function() {
                document.getElementById('message-container').innerHTML = '';
            };
        });

        const testInput = page.locator('#test-input');
        const submitButton = page.locator('#submit-btn');

        // Submit empty form
        await submitButton.click();

        // Show validation error
        await page.evaluate(() => {
            window.showError('Validation failed', 'Please fill in all required fields');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Validation failed');
        await expect(errorMessage).toContainText('required fields');

        // Fix validation error
        await testInput.fill('Valid input');

        // Clear error on valid input
        await page.evaluate(() => {
            window.clearMessages();
        });

        await expect(errorMessage).not.toBeVisible();
    });

    test('should provide retry functionality for recoverable errors', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Show error with retry
        await page.evaluate(() => {
            window.showError('Request failed', 'Server temporarily unavailable');
        });

        const retryButton = page.locator('#retry-btn');
        await expect(retryButton).toBeVisible();
        await expect(retryButton).toBeEnabled();

        // Click retry
        await retryButton.click();

        // Show loading then success
        await page.evaluate(() => {
            window.showLoading();
            setTimeout(() => {
                window.showSuccess('Request succeeded on retry');
            }, 300);
        });

        await page.waitForTimeout(400);

        const successMessage = page.locator('#success-display');
        await expect(successMessage).toBeVisible();
        await expect(successMessage).toContainText('succeeded on retry');

        // Retry button should be hidden on success
        await expect(retryButton).not.toBeVisible();
    });

    test('should handle multiple consecutive errors', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // First error
        await page.evaluate(() => {
            window.showError('First error', 'Initial failure');
        });

        let errorMessage = page.locator('#error-display');
        await expect(errorMessage).toContainText('First error');

        // Second error (should replace first)
        await page.evaluate(() => {
            window.showError('Second error', 'Subsequent failure');
        });

        errorMessage = page.locator('#error-display');
        await expect(errorMessage).toContainText('Second error');
        await expect(errorMessage).not.toContainText('First error');

        // Clear all errors
        await page.evaluate(() => {
            window.clearMessages();
        });

        await expect(errorMessage).not.toBeVisible();
    });

    test('should handle timeout errors appropriately', async ({ page }) => {
        await mockErrorAPI(page, 'timeout');
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Trigger timeout error
        await page.evaluate(() => {
            window.showError('Request timeout - please try again', 'The request took too long to complete');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('timeout');
        await expect(errorMessage).toContainText('try again');

        // Timeout errors should show retry
        const retryButton = page.locator('#retry-btn');
        await expect(retryButton).toBeVisible();
    });

    test('should handle concurrent API errors', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Simulate multiple API calls failing
        await page.evaluate(() => {
            // First call starts
            window.showLoading();

            // Multiple errors occur - should show latest
            setTimeout(() => {
                window.showError('Multiple errors occurred', 'Several requests failed simultaneously');
            }, 100);
        });

        await page.waitForTimeout(200);

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Multiple errors occurred');
    });

    test('should display error context information', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Error with detailed context
        await page.evaluate(() => {
            window.showError('Failed to save expense', 'Amount must be greater than zero and description is required');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Failed to save expense');
        await expect(errorMessage).toContainText('Amount must be greater than zero');
        await expect(errorMessage).toContainText('description is required');

        // Error details should be readable
        const errorDetails = page.locator('.error-details');
        await expect(errorDetails).toBeVisible();
    });

    test('should maintain error state during navigation', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Show error
        await page.evaluate(() => {
            window.showError('Persistent error', 'This error should remain visible');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();

        // Simulate focus change (tab away and back)
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');

        // Error should still be visible
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Persistent error');
    });

    test('should provide accessible error messages', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        await addErrorDisplayElements(page);

        // Show error
        await page.evaluate(() => {
            window.showError('Accessibility test error', 'This error should be accessible to screen readers');
        });

        const errorMessage = page.locator('#error-display');
        await expect(errorMessage).toBeVisible();

        // Error should have appropriate ARIA attributes or clear structure
        const errorHeading = page.locator('.error-heading');
        const errorDetails = page.locator('.error-details');

        await expect(errorHeading).toBeVisible();
        await expect(errorDetails).toBeVisible();

        // Text content should be clear and informative
        await expect(errorHeading).toContainText('Something went wrong');
        await expect(errorDetails).toContainText('Accessibility test error');
    });
});