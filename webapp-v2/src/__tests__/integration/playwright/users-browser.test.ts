import { ClientUserBuilder, UsersBrowserPage } from '@splitifyd/test-support';
import { SystemUserRoles } from '@splitifyd/shared';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

/**
 * Users Browser E2E Tests
 *
 * Tests the Users Browser page functionality including:
 * - Viewing user accounts
 * - Disabling/enabling user accounts (system admin only)
 * - Status badges and indicators
 *
 * Note: All tests require system admin role
 */

// Mock user data for testing
const mockAuthUsersResponse = {
    users: [
        {
            uid: 'test-user-1',
            email: 'user1@test.com',
            displayName: 'Test User 1',
            disabled: false,
            emailVerified: true,
            metadata: {
                creationTime: '2024-01-01T00:00:00.000Z',
                lastSignInTime: '2024-01-15T12:00:00.000Z',
            },
        },
        {
            uid: 'test-user-2',
            email: 'user2@test.com',
            displayName: 'Test User 2',
            disabled: true,
            emailVerified: true,
            metadata: {
                creationTime: '2024-01-02T00:00:00.000Z',
                lastSignInTime: '2024-01-14T12:00:00.000Z',
            },
        },
        {
            uid: 'test-user-3',
            email: 'sysadmin@test.com',
            displayName: 'System Admin',
            disabled: false,
            emailVerified: true,
            metadata: {
                creationTime: '2024-01-01T00:00:00.000Z',
                lastSignInTime: '2024-01-16T12:00:00.000Z',
            },
        },
    ],
    hasMore: false,
};

// Helper to setup mock user data for all tests
async function setupMockUsersApi(page: any) {
    await page.route('**/api/admin/browser/users/auth*', async (route: any) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockAuthUsersResponse),
        });
    });
}

test.describe('Users Browser Page - Basic Functionality', () => {
    test('should display page title', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withDisplayName('System Admin')
            .withEmail('sysadmin@test.com')
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);

        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.verifyPageLoaded();

        await expect(usersBrowserPage.getPageTitleLocator()).toHaveText('Users Browser');
    });

    test('should display Firebase Auth Users tab', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);

        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        await usersBrowserPage.verifyAuthTabVisible();
    });

    test('should display auth users table', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        await usersBrowserPage.verifyAuthTableVisible();
    });

    test('should hide loading spinner after data loads', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        await usersBrowserPage.verifyLoadingSpinnerHidden();
    });

    test('should display at least one user', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        const userCount = await usersBrowserPage.countUsers();
        expect(userCount).toBeGreaterThan(0);
    });
});

test.describe('Users Browser Page - User Status Display', () => {
    test('should display status badge for each user', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        const firstRow = usersBrowserPage.getAuthTableRowsLocator().first();
        const statusBadge = usersBrowserPage.getStatusBadgeLocator(firstRow);

        await expect(statusBadge).toBeVisible();
    });

    test('should display either Active or Disabled status', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        const firstRow = usersBrowserPage.getAuthTableRowsLocator().first();
        const status = await usersBrowserPage.getUserStatus(firstRow);

        expect(['Active', 'Disabled']).toContain(status);
    });
});

test.describe('Users Browser Page - Disable/Enable Buttons', () => {
    test('should display disable or enable button for each user', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        const firstRow = usersBrowserPage.getAuthTableRowsLocator().first();

        // Should have either a Disable or Enable button visible
        const disableBtn = usersBrowserPage.getDisableButtonLocator(firstRow);
        const enableBtn = usersBrowserPage.getEnableButtonLocator(firstRow);

        const disableVisible = await disableBtn.isVisible().catch(() => false);
        const enableVisible = await enableBtn.isVisible().catch(() => false);

        expect(disableVisible || enableVisible).toBe(true);
    });

    test('should display View JSON button for each user', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);
        await setupMockUsersApi(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();
        await usersBrowserPage.waitForAuthTableLoaded();

        const firstRow = usersBrowserPage.getAuthTableRowsLocator().first();
        const viewJsonBtn = usersBrowserPage.getViewJsonButtonLocator(firstRow);

        await expect(viewJsonBtn).toBeVisible();
    });
});

test.describe('Users Browser Page - Access Control', () => {
    test('should deny access to regular users', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const regularUser = new ClientUserBuilder()
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await authenticatedMockFirebase(regularUser);
        await setupSuccessfulApiMocks(page);

        const usersBrowserPage = new UsersBrowserPage(page);

        await usersBrowserPage.navigate();

        // Should show access denied message
        await usersBrowserPage.verifyAccessDenied();
    });
});
