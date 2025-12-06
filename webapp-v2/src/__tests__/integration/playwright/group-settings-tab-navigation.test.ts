import type { ClientUser, GroupId, GroupPermissions, MemberRole } from '@billsplit-wl/shared';
import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, mockUpdateGroupPermissionsApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    groupOwnerId?: string;
    currentUserRole: MemberRole;
    permissions: GroupPermissions;
}

async function setupGroupWithRole(page: Page, user: ClientUser, options: GroupTestSetupOptions): Promise<{ groupId: GroupId; }> {
    const groupId = options.groupId ?? toGroupId('group-tabs-' + user.uid);
    const groupName = options.groupName ?? 'Tab Navigation Test Group';
    const ownerId = options.groupOwnerId ?? toUserId('owner-' + user.uid);

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withCreatedBy(ownerId)
            .withPermissions(options.permissions)
            .build();

        const members: ReturnType<GroupMemberBuilder['build']>[] = [];

        // Add owner if different from current user
        if (ownerId !== user.uid) {
            members.push(
                new GroupMemberBuilder()
                    .withUid(ownerId)
                    .withDisplayName('Group Owner')
                    .withGroupDisplayName('Group Owner')
                    .withMemberRole('admin')
                    .withMemberStatus('active')
                    .withTheme(ThemeBuilder.blue().build())
                    .build(),
            );
        }

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
    expenseEditing: 'owner-and-admin',
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
    test('allows switching from identity to general tab (owner)', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        // User is the owner (groupOwnerId not specified, defaults to not-owner, so set explicitly)
        const { groupId } = await setupGroupWithRole(page, user, {
            groupOwnerId: user.uid, // Make user the owner
            currentUserRole: 'admin',
            permissions: OPEN_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal - owner defaults to general tab
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');

        // Verify identity tab content is visible
        await modal.verifyDisplayNameInputVisible();

        // Switch to general tab
        await modal.clickTab('general');
        await modal.ensureGeneralTab();

        // Verify general tab content is now visible
        await modal.verifyGroupNameInputVisible();
    });

    test('allows switching from general to security tab (owner)', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithRole(page, user, {
            groupOwnerId: user.uid,
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

    test('non-owner sees identity tab only when permissions are restricted', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        // User is a regular member (not owner), with admin-only permissions
        const { groupId } = await setupGroupWithRole(page, user, {
            groupOwnerId: toUserId('different-owner'),
            currentUserRole: 'member', // Regular member, not admin
            permissions: ADMIN_ONLY_PERMISSIONS,
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

    test('admin sees identity and security tabs but not general', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        // User is an admin (not owner), with admin-only permissions
        const { groupId } = await setupGroupWithRole(page, user, {
            groupOwnerId: toUserId('different-owner'),
            currentUserRole: 'admin', // Admin role
            permissions: ADMIN_ONLY_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        await modal.waitForModalToOpen({ tab: 'identity' });

        // Verify visible tabs
        const visibleTabs = await modal.getVisibleTabs();

        // Admin should see identity and security tabs, but not general (only owner sees general)
        expect(visibleTabs).toContain('identity');
        expect(visibleTabs).not.toContain('general');
        expect(visibleTabs).toContain('security');
    });

    test('owner sees all three tabs', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithRole(page, user, {
            groupOwnerId: user.uid, // User is the owner
            currentUserRole: 'admin',
            permissions: ADMIN_ONLY_PERMISSIONS,
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Open modal
        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await modal.waitForModalToOpen({ tab: 'general' });

        // Verify all tabs are visible
        const visibleTabs = await modal.getVisibleTabs();

        expect(visibleTabs).toContain('identity');
        expect(visibleTabs).toContain('general');
        expect(visibleTabs).toContain('security');
    });
});
