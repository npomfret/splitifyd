import { SystemUserRoles } from '@billsplit-wl/shared';
import { ClientUserBuilder, SettingsPage, UserProfileResponseBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockUserProfileApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

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
        await mockUserProfileApi(page, UserProfileResponseBuilder.fromClientUser(user).build());
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

        // 5. Mock the API response for profile update (204 No Content) and re-fetch (GET with updated data)
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({ status: 204 });
            } else if (route.request().method() === 'GET') {
                const updatedProfile = UserProfileResponseBuilder
                    .fromClientUser(user)
                    .withDisplayName(newDisplayName)
                    .build();
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(updatedProfile),
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
        await mockUserProfileApi(page, UserProfileResponseBuilder.fromClientUser(user).build());
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
        await mockUserProfileApi(page, UserProfileResponseBuilder.fromClientUser(user).build());
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

        // 4. Verify profile summary card is visible
        await settingsPage.verifyProfileOverviewCardVisible();
    });

    test('should display avatar or initials in profile summary', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify avatar component or initials fallback is present
        await settingsPage.verifyAvatarOrInitialsVisible();
    });

    test('should hide account role from regular users', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify account role label is NOT visible for regular users (only shown to system admins)
        await settingsPage.verifyAccountRoleLabelNotVisible();
    });

    test('should display account role for system admins', async ({ authenticatedMockFirebase, pageWithLogging }) => {
        // 1. Create a system admin user
        const adminUser = ClientUserBuilder
            .validUser()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        // 2. Set up authenticated mock Firebase with admin user
        await authenticatedMockFirebase(adminUser);
        await setupSuccessfulApiMocks(pageWithLogging);

        // 3. Mock user profile GET endpoint with admin role
        await mockUserProfileApi(pageWithLogging, UserProfileResponseBuilder.fromClientUser(adminUser).build());

        const settingsPage = new SettingsPage(pageWithLogging);

        // 4. Navigate to settings page
        await settingsPage.navigate();

        // 5. Verify account role label IS visible for system admins
        await settingsPage.verifyAccountRoleLabelVisible();

        // 6. Verify role value shows "Administrator"
        await settingsPage.verifyAccountRoleValueVisible('Administrator');
    });

    test('should display password requirements checklist', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify password requirements heading is visible
        await settingsPage.verifyPasswordChecklistHeadingVisible();

        // 3. Verify individual requirements are displayed
        await settingsPage.verifyPasswordRequirementVisible(/Use at least 12 characters/i);
        await settingsPage.verifyPasswordRequirementVisible(/Blend upper- and lowercase letters/i);
        await settingsPage.verifyPasswordRequirementVisible(/Avoid passwords you've used elsewhere/i);
    });

    test('should display section headers and info icons', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify profile information section header
        await settingsPage.verifyProfileInformationHeaderVisible();

        // 3. Verify profile information info icon (description in tooltip)
        await settingsPage.verifyProfileInformationInfoIconVisible();

        // 4. Verify password section header
        await settingsPage.verifyPasswordSectionHeaderVisible();

        // 5. Verify password info icon (description in tooltip)
        await settingsPage.verifyPasswordInfoIconVisible();
    });

    test('should display page hero label', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // 1. Navigate to settings page
        await settingsPage.navigate();

        // 2. Verify hero label is visible
        await settingsPage.verifyHeroLabelVisible();
    });
});

test.describe('Settings Page - Navigation', () => {
    // Set up API mocks before each test
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);
        await mockUserProfileApi(page, UserProfileResponseBuilder.fromClientUser(user).build());
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

test.describe('Settings Page - Email Preferences', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        await setupSuccessfulApiMocks(page);
        // Set up user with email consent timestamps
        const profileWithEmailPrefs = UserProfileResponseBuilder
            .fromClientUser(user)
            .withAdminEmailsAcceptedAt(new Date('2024-01-15T10:30:00Z').toISOString())
            .withMarketingEmailsAcceptedAt(null)
            .build();
        await mockUserProfileApi(page, profileWithEmailPrefs);
    });

    test('should display email preferences section', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify email preferences section is visible
        await settingsPage.verifyEmailPreferencesSectionVisible();
    });

    test('should display admin emails info as read-only', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify admin emails info is visible
        await settingsPage.verifyAdminEmailsInfoVisible();
    });

    test('should display marketing emails checkbox', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify marketing emails checkbox is visible
        await settingsPage.verifyMarketingEmailsCheckboxVisible();

        // Verify marketing emails description is visible
        await settingsPage.verifyMarketingEmailsDescriptionVisible();
    });

    test('should show marketing emails unchecked when not opted in', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings page (user has marketingEmailsAcceptedAt: null)
        await settingsPage.navigate();

        // Verify marketing emails checkbox is unchecked
        await settingsPage.verifyMarketingEmailsUnchecked();
    });

    test('should show marketing emails checked when opted in', async ({ authenticatedMockFirebase, pageWithLogging }) => {
        // Create a user with marketing emails opted in
        const user = ClientUserBuilder.validUser().build();
        await authenticatedMockFirebase(user);
        await setupSuccessfulApiMocks(pageWithLogging);

        // Mock profile with marketing emails opted in
        const profileWithMarketingOptIn = UserProfileResponseBuilder
            .fromClientUser(user)
            .withAdminEmailsAcceptedAt(new Date('2024-01-15T10:30:00Z').toISOString())
            .withMarketingEmailsAcceptedAt(new Date('2024-02-01T14:00:00Z').toISOString())
            .build();
        await mockUserProfileApi(pageWithLogging, profileWithMarketingOptIn);

        const settingsPage = new SettingsPage(pageWithLogging);

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify marketing emails checkbox is checked
        await settingsPage.verifyMarketingEmailsChecked();
    });

    test('should toggle marketing emails preference', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Track whether the toggle has been clicked
        let hasToggledMarketing = false;

        // Remove existing route handler and add our own with state tracking
        await page.unroute('**/api/user/profile');
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'PUT') {
                hasToggledMarketing = true;
                await route.fulfill({ status: 204 });
            } else if (route.request().method() === 'GET') {
                // Return profile based on current state
                const profile = UserProfileResponseBuilder
                    .fromClientUser(user)
                    .withAdminEmailsAcceptedAt(new Date('2024-01-15T10:30:00Z').toISOString())
                    .withMarketingEmailsAcceptedAt(hasToggledMarketing ? new Date().toISOString() : null)
                    .build();
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(profile),
                });
            } else {
                await route.continue();
            }
        });

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify initially unchecked
        await settingsPage.verifyMarketingEmailsUnchecked();

        // Toggle marketing emails
        await settingsPage.toggleMarketingEmailsCheckbox();

        // Verify success message appears
        await settingsPage.verifySuccessMessage('Email preferences updated successfully');

        // Verify checkbox is now checked
        await settingsPage.verifyMarketingEmailsChecked();
    });

    test('should show error when marketing emails update fails', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Mock the profile update endpoint to fail
        await page.route('**/api/user/profile', async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Navigate to settings page
        await settingsPage.navigate();

        // Toggle marketing emails
        await settingsPage.toggleMarketingEmailsCheckbox();

        // Verify error message appears
        await settingsPage.verifyErrorMessage('Failed to update email preferences. Please try again.');
    });
});
