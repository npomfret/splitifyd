import type { ClientUser, GroupId, MemberRole } from '@billsplit-wl/shared';
import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, mockUpdateGroupPermissionsApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface RoleUpdateContext {
    memberId: string;
    newRole: MemberRole;
    route: Route;
    respondSuccess: () => Promise<void>;
    respondError: (status: number, code: string, message: string) => Promise<void>;
}

type RoleUpdateHandler = (context: RoleUpdateContext) => Promise<boolean> | boolean;

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    additionalMembers?: Array<{ uid: string; displayName: string; role: MemberRole; }>;
    onRoleUpdate?: RoleUpdateHandler;
}

async function setupGroupWithMembers(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<{ groupId: GroupId; memberIds: string[]; }> {
    const groupId = options.groupId ?? toGroupId('group-roles-' + user.uid);
    const groupName = options.groupName ?? 'Member Roles Test Group';

    const memberRoles: Record<string, MemberRole> = {};

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            
            .withPermissions({
                expenseEditing: 'anyone',
                expenseDeletion: 'creator-and-admin',
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'admin-only',
            })
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Owner')
            .withGroupDisplayName(user.displayName ?? 'Owner')
            .withMemberRole('admin')
            .withMemberStatus('active')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const additionalMemberObjects = (options.additionalMembers ?? []).map((m) => {
            const currentRole = memberRoles[m.uid] ?? m.role;
            return new GroupMemberBuilder()
                .withUid(m.uid)
                .withDisplayName(m.displayName)
                .withGroupDisplayName(m.displayName)
                .withMemberRole(currentRole)
                .withMemberStatus('active')
                .withTheme(ThemeBuilder.red().build())
                .build();
        });

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([selfMember, ...additionalMemberObjects])
            .build();
    };

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        await fulfillWithSerialization(route, { body: buildFullDetails() });
    });

    await mockGroupCommentsApi(page, groupId);
    await mockPendingMembersApi(page, groupId, []);
    await mockUpdateGroupPermissionsApi(page, groupId);

    // Mock member role update endpoint
    await page.route(`**/api/groups/${groupId}/members/*/role`, async (route) => {
        if (route.request().method() === 'PATCH') {
            const url = route.request().url();
            const memberIdMatch = url.match(/\/members\/([^/]+)\/role/);
            const memberId = memberIdMatch?.[1] ?? '';
            const requestBody = JSON.parse(route.request().postData() ?? '{}') as { role?: MemberRole; };
            const newRole = requestBody.role ?? 'member';

            const respondSuccess = async () => {
                memberRoles[memberId] = newRole;
                await route.fulfill({ status: 204 });
            };

            const respondError = async (status: number, code: string, message: string) => {
                await fulfillWithSerialization(route, {
                    status,
                    body: { error: { code, message } },
                });
            };

            if (options.onRoleUpdate) {
                const handled = await options.onRoleUpdate({
                    memberId,
                    newRole,
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

    const memberIds = (options.additionalMembers ?? []).map((m) => m.uid);
    return { groupId, memberIds };
}

test.describe('Group Settings - Security Tab - Member Roles', () => {
    test('allows changing member role from admin to member', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const memberId = toUserId('member-alice');

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithMembers(page, user, {
            additionalMembers: [
                { uid: memberId, displayName: 'Alice', role: 'admin' },
            ],
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Verify initial role
        await modal.verifyMemberRoleValue(memberId, 'admin');

        // Change role
        await modal.changeMemberRole(memberId, 'member');

        // Verify unsaved changes banner appears
        await modal.verifySecurityUnsavedBannerVisible();
    });

    test('allows changing member role from member to viewer', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const memberId = toUserId('member-bob');

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithMembers(page, user, {
            additionalMembers: [
                { uid: memberId, displayName: 'Bob', role: 'member' },
            ],
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Verify initial role
        await modal.verifyMemberRoleValue(memberId, 'member');

        // Change role
        await modal.changeMemberRole(memberId, 'viewer');

        // Verify unsaved changes banner appears
        await modal.verifySecurityUnsavedBannerVisible();
    });

    test('shows unsaved changes banner when role is changed', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const memberId = toUserId('member-charlie');

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithMembers(page, user, {
            additionalMembers: [
                { uid: memberId, displayName: 'Charlie', role: 'member' },
            ],
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Initially no unsaved banner
        await modal.verifySecurityUnsavedBannerNotVisible();

        // Change role
        await modal.changeMemberRole(memberId, 'viewer');

        // Unsaved banner should appear
        await modal.verifySecurityUnsavedBannerVisible();
    });

    test('saves role changes and shows success alert', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const memberId = toUserId('member-diana');

        // Setup API mocks first
        await setupSuccessfulApiMocks(page);

        const { groupId } = await setupGroupWithMembers(page, user, {
            additionalMembers: [
                { uid: memberId, displayName: 'Diana', role: 'admin' },
            ],
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        await modal.waitForSecurityTab();

        // Change role and save
        await modal.changeMemberRole(memberId, 'member');
        await modal.verifySecurityUnsavedBannerVisible();

        // Save security settings
        await modal.saveSecuritySettings();

        // Success alert should appear
        await modal.verifySecuritySuccessAlertVisible();

        // Unsaved banner should disappear
        await modal.verifySecurityUnsavedBannerNotVisible();
    });
});
