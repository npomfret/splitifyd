/**
 * Admin User Profile Editor Tests
 *
 * Tests the user profile editing functionality in the admin panel:
 * - Profile tab with displayName field (email excluded for privacy)
 * - Save button enabled/disabled states
 * - Successful profile updates
 */

import { SystemUserRoles, toDisplayName, toUserId } from '@billsplit-wl/shared';
import { AdminUserProfileBuilder, AdminUsersPage } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';

test.describe('Admin User Profile Editor', () => {
    test('should display user editor modal with Profile tab active by default', async ({ systemAdminPage, msw }) => {
        const { page } = systemAdminPage;

        const targetUser = new AdminUserProfileBuilder()
            .withUid(toUserId('test-user-123'))
            .withDisplayName(toDisplayName('Test User'))
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await msw.use({
            method: 'GET',
            url: '/api/admin/browser/users/auth',
            urlKind: 'prefix',
            response: {
                body: {
                    users: [targetUser],
                    hasMore: false,
                },
            },
        });

        const adminUsersPage = new AdminUsersPage(page);
        await adminUsersPage.navigate();

        const userEditorModal = await adminUsersPage.clickEditUserAndOpenModal(targetUser.displayName);

        await userEditorModal.verifyProfileTabIsActive();
        await userEditorModal.verifyDisplayNameInputVisible();
        await userEditorModal.verifyDisplayNameValue('Test User');
    });

    test('should enable save button when profile data changes', async ({ systemAdminPage, msw }) => {
        const { page } = systemAdminPage;

        const targetUser = new AdminUserProfileBuilder()
            .withUid(toUserId('test-user-456'))
            .withDisplayName(toDisplayName('Original Name'))
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await msw.use({
            method: 'GET',
            url: '/api/admin/browser/users/auth',
            urlKind: 'prefix',
            response: {
                body: {
                    users: [targetUser],
                    hasMore: false,
                },
            },
        });

        const adminUsersPage = new AdminUsersPage(page);
        await adminUsersPage.navigate();

        const userEditorModal = await adminUsersPage.clickEditUserAndOpenModal(targetUser.displayName);

        // Save button should be disabled initially (no changes)
        await userEditorModal.verifySaveProfileButtonDisabled();

        // Change the display name
        await userEditorModal.fillDisplayName('Updated Name');

        // Save button should now be enabled
        await userEditorModal.verifySaveProfileButtonEnabled();
    });

    test('should save profile changes successfully', async ({ systemAdminPage, msw }) => {
        const { page } = systemAdminPage;

        const targetUser = new AdminUserProfileBuilder()
            .withUid(toUserId('test-user-789'))
            .withDisplayName(toDisplayName('Old Display Name'))
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await msw.use({
            method: 'GET',
            url: '/api/admin/browser/users/auth',
            urlKind: 'prefix',
            response: {
                body: {
                    users: [targetUser],
                    hasMore: false,
                },
            },
        });

        // Mock the updateUserProfileAdmin API
        await msw.use({
            method: 'PUT',
            url: `/api/admin/users/${targetUser.uid}/profile`,
            response: {
                status: 204,
                body: null,
            },
        });

        const adminUsersPage = new AdminUsersPage(page);
        await adminUsersPage.navigate();

        const userEditorModal = await adminUsersPage.clickEditUserAndOpenModal(targetUser.displayName);

        // Update display name
        await userEditorModal.fillDisplayName('New Display Name');

        // Click save
        await userEditorModal.clickSaveProfile();

        // Verify success message appears
        await userEditorModal.verifySuccessMessage();
    });

    test('should switch between Profile and Role tabs', async ({ systemAdminPage, msw }) => {
        const { page } = systemAdminPage;

        const targetUser = new AdminUserProfileBuilder()
            .withUid(toUserId('test-user-tabs'))
            .withDisplayName(toDisplayName('Tab Test User'))
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await msw.use({
            method: 'GET',
            url: '/api/admin/browser/users/auth',
            urlKind: 'prefix',
            response: {
                body: {
                    users: [targetUser],
                    hasMore: false,
                },
            },
        });

        const adminUsersPage = new AdminUsersPage(page);
        await adminUsersPage.navigate();

        const userEditorModal = await adminUsersPage.clickEditUserAndOpenModal(targetUser.displayName);

        // Profile tab should be active initially
        await userEditorModal.verifyDisplayNameInputVisible();

        // Click on Role tab
        await userEditorModal.clickRoleTab();

        // Profile inputs should be hidden, role options visible
        await userEditorModal.verifyDisplayNameInputNotVisible();
        await userEditorModal.verifyRoleOptionVisible('Regular User');
        await userEditorModal.verifyRoleOptionVisible('Tenant Admin');
        await userEditorModal.verifyRoleOptionVisible('System Admin');

        // Switch back to Profile tab
        await userEditorModal.clickProfileTab();

        // Profile inputs should be visible again
        await userEditorModal.verifyDisplayNameInputVisible();
    });

    test('should close modal when clicking cancel', async ({ systemAdminPage, msw }) => {
        const { page } = systemAdminPage;

        const targetUser = new AdminUserProfileBuilder()
            .withUid(toUserId('test-user-cancel'))
            .withDisplayName(toDisplayName('Cancel Test User'))
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await msw.use({
            method: 'GET',
            url: '/api/admin/browser/users/auth',
            urlKind: 'prefix',
            response: {
                body: {
                    users: [targetUser],
                    hasMore: false,
                },
            },
        });

        const adminUsersPage = new AdminUsersPage(page);
        await adminUsersPage.navigate();

        const userEditorModal = await adminUsersPage.clickEditUserAndOpenModal(targetUser.displayName);
        await userEditorModal.verifyModalIsOpen();

        // Click cancel button
        await userEditorModal.clickCancel();

        // Modal should be closed
        await userEditorModal.verifyModalIsClosed();
    });
});
