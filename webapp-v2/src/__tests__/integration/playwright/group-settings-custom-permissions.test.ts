import type { ClientUser, GroupId, GroupPermissions } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface PermissionUpdateContext {
    permissions: GroupPermissions;
    route: Route;
    respondSuccess: () => Promise<void>;
    respondError: (status: number, code: string, message: string) => Promise<void>;
}

type PermissionUpdateHandler = (context: PermissionUpdateContext) => Promise<boolean> | boolean;

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    initialPermissions?: GroupPermissions;
    onPermissionUpdate?: PermissionUpdateHandler;
}

const OPEN_PERMISSIONS: GroupPermissions = {
    expenseEditing: 'anyone',
    expenseDeletion: 'anyone',
    memberInvitation: 'anyone',
    memberApproval: 'automatic',
    settingsManagement: 'anyone',
};

async function setupGroupWithPermissions(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<{ groupId: GroupId; }> {
    const groupId = options.groupId ?? toGroupId('group-perms-' + user.uid);
    const groupName = options.groupName ?? 'Permissions Test Group';

    let currentPermissions = options.initialPermissions ?? OPEN_PERMISSIONS;

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withCreatedBy(user.uid)
            .withPermissions(currentPermissions)
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Owner')
            .withGroupDisplayName(user.displayName ?? 'Owner')
            .withMemberRole('admin')
            .withMemberStatus('active')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([selfMember])
            .build();
    };

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        await fulfillWithSerialization(route, { body: buildFullDetails() });
    });

    await mockGroupCommentsApi(page, groupId);
    await mockPendingMembersApi(page, groupId, []);

    // Mock permission update endpoint
    await page.route(`**/api/groups/${groupId}/security/permissions`, async (route) => {
        if (route.request().method() === 'PATCH') {
            // Permissions are sent directly in the body, not nested under 'permissions' key
            const newPermissions = JSON.parse(route.request().postData() ?? '{}') as GroupPermissions;

            const respondSuccess = async () => {
                currentPermissions = newPermissions;
                await fulfillWithSerialization(route, {
                    status: 200,
                    body: { message: 'Permissions updated.' },
                });
            };

            const respondError = async (status: number, code: string, message: string) => {
                await fulfillWithSerialization(route, {
                    status,
                    body: { error: { code, message } },
                });
            };

            if (options.onPermissionUpdate) {
                const handled = await options.onPermissionUpdate({
                    permissions: newPermissions,
                    route,
                    respondSuccess,
                    respondError,
                });
                if (handled) return;
            }

            await respondSuccess();
        } else {
            await route.continue();
        }
    });

    return { groupId };
}

test.describe('Group Settings - Security Tab - Custom Permissions', () => {
    test('allows changing individual permission dropdown', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithPermissions(page, user, {
            initialPermissions: OPEN_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Verify initial permission value
        await modal.verifyPermissionValue('expenseEditing', 'anyone');

        // Change the permission
        await modal.changePermission('expenseEditing', 'owner-and-admin');

        // Verify the change was applied
        await modal.verifyPermissionValue('expenseEditing', 'owner-and-admin');

        // Verify unsaved changes banner appears
        await modal.verifySecurityUnsavedBannerVisible();
    });

    test('auto-selects custom preset when manually changing permission', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithPermissions(page, user, {
            initialPermissions: OPEN_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Verify initial preset is 'open' (all permissions match open preset)
        await modal.verifyPresetSelected('open');

        // Change one permission to break the preset match
        await modal.changePermission('expenseDeletion', 'admin-only');

        // Verify custom mode is active (no preset selected)
        await modal.verifyCustomPresetActive();
    });

    test('includes permission changes in save payload', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        // Track what permissions were sent to the server
        let savedPermissions: GroupPermissions | null = null;

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithPermissions(page, user, {
            initialPermissions: OPEN_PERMISSIONS,
            onPermissionUpdate: async ({ permissions, respondSuccess }) => {
                savedPermissions = permissions;
                await respondSuccess();
                return true;
            },
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Change multiple permissions
        await modal.changePermission('expenseEditing', 'owner-and-admin');
        await modal.changePermission('memberInvitation', 'admin-only');

        // Save the changes
        await modal.saveSecuritySettings();

        // Verify success alert
        await modal.verifySecuritySuccessAlertVisible();

        // Verify the saved permissions include our changes
        expect(savedPermissions).not.toBeNull();
        expect(savedPermissions!.expenseEditing).toBe('owner-and-admin');
        expect(savedPermissions!.memberInvitation).toBe('admin-only');
        // Other permissions should remain unchanged
        expect(savedPermissions!.expenseDeletion).toBe('anyone');
        expect(savedPermissions!.memberApproval).toBe('automatic');
        expect(savedPermissions!.settingsManagement).toBe('anyone');
    });
});
