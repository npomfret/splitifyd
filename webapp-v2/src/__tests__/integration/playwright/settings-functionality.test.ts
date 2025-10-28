import { SettingsPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

// TODO: Add tests for password change functionality that require complex route mocking:
// - should successfully change password
// - should show error when new password is too weak
// - should show error when passwords do not match
// - should show loading state during profile update
// - should show loading state during password change
// These tests require careful route handler orchestration to avoid conflicts with beforeEach handlers

test.describe('Settings Page - Profile Update Functionality', () => {
    // Set up API mocks before each test
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        // Mock user profile GET endpoint
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        displayName: user.displayName,
                        email: user.email,
                        emailVerified: user.emailVerified ?? true,
                        photoURL: user.photoURL,
                        role: user.role,
                    }),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should successfully update display name', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify current display name is shown
        await settingsPage.verifyProfileDisplayNameText(user.displayName);

        // 3. Update display name
        const newDisplayName = 'Updated Test User';
        await settingsPage.fillDisplayName(newDisplayName);

        // 4. Verify save button is enabled when changes are made
        await settingsPage.verifySaveButtonEnabled();

        // 5. Mock the API response for profile update
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        displayName: newDisplayName,
                        email: user.email,
                        emailVerified: user.emailVerified ?? true,
                        role: user.role || 'system_user',
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // 6. Submit the form
        await settingsPage.clickSaveChangesButton();

        // 7. Verify success message appears
        await settingsPage.verifySuccessMessage('Profile updated successfully');

        // 8. Verify the profile display name is updated
        await settingsPage.verifyProfileDisplayNameText(newDisplayName);
    });

    test('should disable save button when display name is unchanged', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify save button is disabled initially (no changes)
        await settingsPage.verifySaveButtonDisabled();

        // 3. Fill with the same display name
        await settingsPage.fillDisplayName(user.displayName);

        // 4. Verify save button remains disabled
        await settingsPage.verifySaveButtonDisabled();
    });

    test('should enable save button when display name is modified', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify save button is disabled initially
        await settingsPage.verifySaveButtonDisabled();

        // 3. Modify display name
        await settingsPage.fillDisplayName(user.displayName + ' Modified');

        // 4. Verify save button becomes enabled
        await settingsPage.verifySaveButtonEnabled();
    });

    test('should show error message when display name update fails', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Update display name
        const newDisplayName = 'Updated Test User';
        await settingsPage.fillDisplayName(newDisplayName);

        // 3. Mock the API response for profile update failure
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 'INVALID_DISPLAY_NAME',
                            message: 'Display name is invalid',
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // 4. Submit the form
        await settingsPage.clickSaveChangesButton();

        // 5. Verify generic error message appears (app shows generic message for security/UX)
        await settingsPage.verifyErrorMessage('Failed to update profile. Please try again.');
    });

    test('should show validation error for empty display name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Clear display name input
        await settingsPage.fillDisplayName('');

        // 3. Verify error message appears
        await settingsPage.verifyErrorMessage('Display name cannot be empty');

        // 4. Verify save button is disabled
        await settingsPage.verifySaveButtonDisabled();
    });

    test('should show validation error for display name that is too long', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Fill display name with too many characters (>100)
        const longName = 'a'.repeat(101);
        await settingsPage.fillDisplayName(longName);

        // 3. Verify error message appears (client-side validation)
        await settingsPage.verifyErrorMessage('Display name must be 100 characters or less');

        // 4. Verify save button is disabled
        await settingsPage.verifySaveButtonDisabled();
    });
});

test.describe('Settings Page - Password Change Functionality', () => {
    // Set up API mocks before each test
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        // Mock user profile GET endpoint
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        displayName: user.displayName,
                        email: user.email,
                        emailVerified: user.emailVerified ?? true,
                        photoURL: user.photoURL,
                        role: user.role,
                    }),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should show error for incorrect current password', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Open password change form
        await settingsPage.openPasswordChangeForm();

        // 3. Fill password change form with incorrect current password
        await settingsPage.fillPasswordChangeForm('wrongPassword', 'newSecurePassword456');

        // 4. Mock the API response for password change failure
        await page.route('**/api/user/change-password', async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 'INVALID_CREDENTIALS',
                            message: 'Current password is incorrect',
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // 5. Submit password change
        await settingsPage.submitPasswordChange();

        // 6. Verify generic error message appears (app shows generic message for security/UX)
        await settingsPage.verifyErrorMessage('Failed to change password. Please try again.');
    });

    test('should cancel password change and hide form', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Open password change form
        await settingsPage.openPasswordChangeForm();

        // 3. Verify password form is visible
        await settingsPage.verifyPasswordFormVisible(true);

        // 4. Fill password change form
        await settingsPage.fillPasswordChangeForm('currentPassword123', 'newSecurePassword456');

        // 5. Cancel password change
        await settingsPage.cancelPasswordChange();

        // 6. Verify password form is hidden
        await settingsPage.verifyPasswordFormVisible(false);

        // 7. Verify change password button is visible again
        await settingsPage.verifyChangePasswordButtonVisible();
    });
});

test.describe('Settings Page - UI Elements and Layout', () => {
    // Set up API mocks before each test
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        // Mock user profile GET endpoint
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        displayName: user.displayName,
                        email: user.email,
                        emailVerified: user.emailVerified ?? true,
                        photoURL: user.photoURL,
                        role: user.role,
                    }),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should display profile summary card with user information', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify profile display name is shown in summary
        await settingsPage.verifyProfileDisplayNameText(user.displayName);

        // 3. Verify email is shown in summary
        await settingsPage.verifyProfileEmailText(user.email);

        // 4. Verify profile summary card is visible (check for key text)
        await expect(page.getByText('Profile overview')).toBeVisible();
    });

    test('should display avatar or initials in profile summary', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify avatar component or initials fallback is present
        // The avatar should either use the Avatar component or show initials in a styled div
        const avatarOrInitials = page.locator('[class*="rounded-full"]').first();
        await expect(avatarOrInitials).toBeVisible();
    });

    test('should display account role in profile summary', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify account role label is visible
        await expect(page.getByText('Account role')).toBeVisible();

        // 3. Verify role value is displayed (either "Administrator" or "Member")
        const roleText = page.locator('text=/Administrator|Member/').first();
        await expect(roleText).toBeVisible();
    });

    test('should display password requirements checklist', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify password requirements heading is visible
        await expect(page.getByText('Strong password checklist')).toBeVisible();

        // 3. Verify individual requirements are displayed
        await expect(page.getByText(/Use at least 12 characters/i)).toBeVisible();
        await expect(page.getByText(/Blend upper- and lowercase letters/i)).toBeVisible();
        await expect(page.getByText(/Avoid passwords you've used elsewhere/i)).toBeVisible();
    });

    test('should display helper text for display name input', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify helper text is visible
        await expect(page.getByText(/Use your full name or a nickname/i)).toBeVisible();
    });

    test('should display section headers and descriptions', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify profile information section header (use role for specificity)
        await expect(page.getByRole('heading', { name: 'Profile Information' })).toBeVisible();

        // 3. Verify profile information subheader
        await expect(page.getByText('Update the details other members see across Splitifyd.')).toBeVisible();

        // 4. Verify password section header
        await expect(page.getByRole('heading', { name: 'Password' })).toBeVisible();

        // 5. Verify password intro text
        await expect(page.getByText('Set a strong password to keep your Splitifyd account secure.')).toBeVisible();
    });

    test('should display page hero label', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify hero label is visible
        await expect(page.getByText('Account').first()).toBeVisible();
    });
});

test.describe('Settings Page - Navigation', () => {
    // Set up API mocks before each test
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        // Mock user profile GET endpoint
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        displayName: user.displayName,
                        email: user.email,
                        emailVerified: user.emailVerified ?? true,
                        photoURL: user.photoURL,
                        role: user.role,
                    }),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should preserve authentication when navigating to settings', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify user is authenticated (display name is shown)
        await settingsPage.verifyProfileDisplayNameText(user.displayName);

        // 3. Verify email is shown
        await settingsPage.verifyProfileEmailText(user.email);
    });
});
