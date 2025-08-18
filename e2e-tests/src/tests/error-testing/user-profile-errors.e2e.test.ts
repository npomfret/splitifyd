import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('User Profile Error Handling', () => {
    authenticatedPageTest(
        'should validate display name requirements',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to settings page
            await page.goto('/settings');
            await expect(page).toHaveURL('/settings');

            const displayNameInput = page.getByLabel('Display Name');
            const saveButton = page.getByRole('button', { name: 'Save Changes' });

            // Test empty display name
            await displayNameInput.fill('');
            await saveButton.click();
            await expect(page.getByText('Display name cannot be empty')).toBeVisible();

            // Test display name too long (over 100 characters)
            const longName = 'A'.repeat(101);
            await displayNameInput.fill(longName);
            await saveButton.click();
            await expect(page.getByText('Display name must be 100 characters or less')).toBeVisible();

            // Test whitespace-only display name
            await displayNameInput.fill('   ');
            await saveButton.click();
            await expect(page.getByText('Display name cannot be empty')).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should validate password change requirements',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to settings page  
            await page.goto('/settings');
            await expect(page).toHaveURL('/settings');

            // Open password change section
            await page.getByRole('button', { name: 'Change Password' }).click();

            const currentPasswordInput = page.getByLabel('Current Password');
            const newPasswordInput = page.getByLabel('New Password');
            const confirmPasswordInput = page.getByLabel('Confirm New Password');
            const updateButton = page.getByRole('button', { name: 'Update Password' });

            // Test password too short
            await currentPasswordInput.fill('currentPass');
            await newPasswordInput.fill('123');
            await confirmPasswordInput.fill('123');
            await updateButton.click();
            await expect(page.getByText('New password must be at least 6 characters long')).toBeVisible();

            // Test passwords don't match
            await newPasswordInput.fill('newPassword123');
            await confirmPasswordInput.fill('differentPassword');
            await updateButton.click();
            await expect(page.getByText('Passwords do not match')).toBeVisible();

            // Test same as current password
            await currentPasswordInput.fill('samePassword123');
            await newPasswordInput.fill('samePassword123');
            await confirmPasswordInput.fill('samePassword123');
            await updateButton.click();
            await expect(page.getByText('New password must be different from current password')).toBeVisible();

            // Test empty fields
            await currentPasswordInput.fill('');
            await newPasswordInput.fill('');
            await confirmPasswordInput.fill('');
            await updateButton.click();
            await expect(page.getByText('Current password and new password are required')).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should handle server errors gracefully',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to settings page
            await page.goto('/settings');

            // Mock a server error by intercepting the API request
            await page.route('/api/user/profile', (route: any) => {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Internal server error' })
                });
            });

            // Attempt to update profile
            await page.getByLabel('Display Name').fill('Test Error Handling');
            await page.getByRole('button', { name: 'Save Changes' }).click();

            // Verify error message is shown
            await expect(page.getByText('Failed to update profile. Please try again.')).toBeVisible();

            // Verify form remains accessible for retry
            await expect(page.getByLabel('Display Name')).toBeEnabled();
            await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
        }
    );

    authenticatedPageTest(
        'should handle password change server errors',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to settings page
            await page.goto('/settings');

            // Mock a server error for password change
            await page.route('/api/user/change-password', (route: any) => {
                route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Current password is incorrect' })
                });
            });

            // Open password change section
            await page.getByRole('button', { name: 'Change Password' }).click();

            // Fill out password change form
            await page.getByLabel('Current Password').fill('wrongPassword');
            await page.getByLabel('New Password').fill('newPassword123');
            await page.getByLabel('Confirm New Password').fill('newPassword123');

            // Submit password change
            await page.getByRole('button', { name: 'Update Password' }).click();

            // Verify specific error message is shown
            await expect(page.getByText('Current password is incorrect')).toBeVisible();

            // Verify form remains accessible for retry
            await expect(page.getByLabel('Current Password')).toBeEnabled();
            await expect(page.getByLabel('New Password')).toBeEnabled();
            await expect(page.getByLabel('Confirm New Password')).toBeEnabled();
        }
    );

    authenticatedPageTest(
        'should handle network connectivity issues',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to settings page
            await page.goto('/settings');

            // Mock a network error by intercepting and aborting the request
            await page.route('/api/user/profile', (route: any) => {
                route.abort('failed');
            });

            // Attempt to update profile
            await page.getByLabel('Display Name').fill('Test Network Error');
            await page.getByRole('button', { name: 'Save Changes' }).click();

            // Verify network error message is shown
            await expect(page.getByText('Network error. Please check your connection and try again.')).toBeVisible();

            // Verify form remains accessible for retry
            await expect(page.getByLabel('Display Name')).toBeEnabled();
            await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
        }
    );
});