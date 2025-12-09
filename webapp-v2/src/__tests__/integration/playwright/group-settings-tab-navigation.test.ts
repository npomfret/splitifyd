import type { ClientUser, GroupId, GroupPermissions, MemberRole } from '@billsplit-wl/shared';
import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, mockUpdateGroupPermissionsApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    currentUserRole: MemberRole;
    permissions: GroupPermissions;
    additionalMembers?: Array<{ uid: string; displayName: string; role: MemberRole; }>;
}

async function setupGroupWithRole(page: Page, user: ClientUser, options: GroupTestSetupOptions): Promise<{ groupId: GroupId; }> {
    const groupId = options.groupId ?? toGroupId('group-tabs-' + user.uid);
    const groupName = options.groupName ?? 'Tab Navigation Test Group';

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withPermissions(options.permissions)
            .build();

        const members: ReturnType<GroupMemberBuilder['build']>[] = [];

        // Add current user with specified role
        members.push(
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName ?? 'Test User')
                .withGroupDisplayName(user.displayName ?? 'Test User')
                .withMemberRole(options.currentUserRole)
                .withMemberStatus('active')
                .withTheme(ThemeBuilder.red().build())
                .build(),
        );

        // Add any additional members
        for (const additionalMember of options.additionalMembers ?? []) {
            members.push(
                new GroupMemberBuilder()
                    .withUid(additionalMember.uid)
                    .withDisplayName(additionalMember.displayName)
                    .withGroupDisplayName(additionalMember.displayName)
                    .withMemberRole(additionalMember.role)
                    .withMemberStatus('active')
                    .withTheme(ThemeBuilder.blue().build())
                    .build(),
            );
        }

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
    };

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        await fulfillWithSerialization(route, { body: buildFullDetails() });
    });

    await mockGroupCommentsApi(page, groupId);
    await mockPendingMembersApi(page, groupId, []);
    await mockUpdateGroupPermissionsApi(page, groupId);

    return { groupId };
}

const ADMIN_ONLY_PERMISSIONS: GroupPermissions = {
    expenseEditing: 'creator-and-admin',
    expenseDeletion: 'admin-only',
    memberInvitation: 'admin-only',
    memberApproval: 'admin-required',
    settingsManagement: 'admin-only',
};

const OPEN_PERMISSIONS: GroupPermissions = {
    expenseEditing: 'anyone',
    expenseDeletion: 'anyone',
    memberInvitation: 'anyone',
    memberApproval: 'automatic',
    settingsManagement: 'anyone',
};

test.describe('Group Settings - Tab Navigation', () => {
    test('allows switching from identity to general tab', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithRole(page, user, {
            currentUserRole: 'admin',
            permissions: OPEN_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal on identity tab
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');

        // Verify identity tab content is visible
        await modal.verifyDisplayNameInputVisible();

        // Switch to general tab
        await modal.clickTab('general');
        await modal.ensureGeneralTab();

        // Verify general tab content is now visible
        await modal.verifyGroupNameInputVisible();
    });

    test('allows switching from general to security tab', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithRole(page, user, {
            currentUserRole: 'admin',
            permissions: OPEN_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal on general tab
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify general tab content is visible
        await modal.verifyGroupNameInputVisible();

        // Switch to security tab
        await modal.clickTab('security');
        await modal.ensureSecurityTab();

        // Verify security tab content is now visible (preset buttons should be visible)
        await modal.verifyPresetSelected('open');
    });

    test('non-admin sees identity tab only when permissions are restricted', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        // User is a regular member (not admin), with admin-only permissions
        const { groupId } = await setupGroupWithRole(page, user, {
            currentUserRole: 'member', // Regular member, not admin
            permissions: ADMIN_ONLY_PERMISSIONS,
            additionalMembers: [
                { uid: toUserId('another-admin'), displayName: 'Another Admin', role: 'admin' },
            ],
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal - should only have identity tab
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        await modal.waitForModalToOpen({ tab: 'identity' });

        // When there's only 1 tab, tabs are hidden - verify by checking tab buttons
        const visibleTabs = await modal.getVisibleTabs();

        // Since there's only identity tab, no tabs should be shown (tabs hidden when length == 1)
        expect(visibleTabs).toHaveLength(0);

        // But identity content should be visible (display name input)
        await modal.verifyDisplayNameInputVisible();
    });

    test('admin sees all three tabs', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        // User is an admin - should see all tabs
        const { groupId } = await setupGroupWithRole(page, user, {
            currentUserRole: 'admin',
            permissions: ADMIN_ONLY_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        await modal.waitForModalToOpen({ tab: 'identity' });

        // Verify all tabs are visible - admins see all tabs (no owner-only restrictions)
        const visibleTabs = await modal.getVisibleTabs();

        expect(visibleTabs).toContain('identity');
        expect(visibleTabs).toContain('general');
        expect(visibleTabs).toContain('security');
    });
});
