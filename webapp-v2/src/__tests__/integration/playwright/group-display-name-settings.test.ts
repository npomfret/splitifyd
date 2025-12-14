import type { ClientUser, GroupId } from '@billsplit-wl/shared';
import { MemberRoles } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

interface DisplayNameUpdateContext {
    displayName: string;
    route: Route;
    respondSuccess: (nextDisplayName: string) => Promise<void>;
    respondConflict: (message: string) => Promise<void>;
}

type DisplayNameUpdateHandler = (context: DisplayNameUpdateContext) => Promise<boolean> | boolean;

interface GroupTestSetupOptions {
    groupId?: GroupId;
    ownerId?: string;
    initialDisplayName?: string;
    onDisplayNameUpdate?: DisplayNameUpdateHandler;
}

async function setupGroupRoutes(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<{ groupId: GroupId; }> {
    const groupId = options.groupId ?? toGroupId('group-display-name-' + user.uid);
    const ownerId = options.ownerId ?? 'owner-123';
    let memberDisplayName = options.initialDisplayName ?? 'Current Alias';

    const group = new GroupDTOBuilder()
        .withId(groupId)
        .withName('Display Name Test Group')
        .build();

    const ownerMember = new GroupMemberBuilder()
        .withUid(ownerId)
        .withDisplayName('Group Owner')
        .withGroupDisplayName('Group Owner')
        .withRole(MemberRoles.ADMIN)
        .build();

    const buildFullDetails = () => {
        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(memberDisplayName)
            .build();

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([ownerMember, selfMember])
            .build();
    };

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        await fulfillWithSerialization(route, { body: buildFullDetails() });
    });

    await mockGroupCommentsApi(page, groupId);

    await page.route(`**/api/groups/${groupId}/members/pending`, async (route) => {
        await fulfillWithSerialization(route, { body: [] });
    });

    await page.route(`**/api/groups/${groupId}/members/display-name`, async (route) => {
        const requestBody = JSON.parse(route.request().postData() ?? '{}') as { displayName?: string; };
        const requestedDisplayName = requestBody.displayName ?? '';

        const respondSuccess = async (nextDisplayName: string) => {
            memberDisplayName = nextDisplayName;
            await route.fulfill({ status: 204 });
        };

        const respondConflict = async (message: string) => {
            await fulfillWithSerialization(route, {
                status: 409,
                body: {
                    error: {
                        message,
                        code: 'DISPLAY_NAME_TAKEN',
                    },
                },
            });
        };

        if (options.onDisplayNameUpdate) {
            const handled = await options.onDisplayNameUpdate({
                displayName: requestedDisplayName,
                route,
                respondSuccess,
                respondConflict,
            });

            if (handled) {
                return;
            }
        }

        await respondSuccess(requestedDisplayName);
    });

    return { groupId };
}

test.describe('Group display name settings', () => {
    test('allows group members to update their display name from the settings modal', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { initialDisplayName: 'Current Alias' });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        await groupDetailPage.verifyEditGroupButtonVisible();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');

        await modal.verifyDisplayNameInputValue('Current Alias');
        await modal.verifyDisplayNameSaveButtonDisabled();

        await modal.fillDisplayName('Updated Alias');
        await modal.verifyDisplayNameSaveButtonEnabled();

        await modal.saveDisplayName();

        await modal.verifyDisplayNameSuccessVisible();
        await modal.verifyDisplayNameInputValue('Updated Alias');
        await modal.verifyDisplayNameSaveButtonDisabled();
    });

    test('validates the display name input before submitting', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        let updateCalled = false;
        const { groupId } = await setupGroupRoutes(page, user, {
            initialDisplayName: 'Alias For Validation',
            onDisplayNameUpdate: async ({ displayName, respondSuccess }) => {
                updateCalled = true;
                await respondSuccess(displayName);
                return true;
            },
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');

        await modal.verifyDisplayNameSaveButtonDisabled();

        await modal.fillDisplayName('   ');
        await modal.verifyDisplayNameSaveButtonEnabled();

        await modal.saveDisplayName();

        await modal.verifyDisplayNameInputErrorContainsText('Enter a display name.');

        await modal.fillDisplayName('A'.repeat(51));
        await modal.saveDisplayName();
        await modal.verifyDisplayNameInputErrorContainsText('50 characters or fewer.');

        await modal.fillDisplayName('Fresh Alias');
        await modal.verifyDisplayNameInputErrorNotVisible();
        await modal.verifyDisplayNameSaveButtonEnabled();

        expect(updateCalled).toBe(false);
    });

    test('surfaces a conflict error when the server rejects a duplicate display name', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            initialDisplayName: 'Alice',
            onDisplayNameUpdate: async ({ displayName, respondConflict, respondSuccess }) => {
                if (displayName.trim().toLowerCase() === 'alice') {
                    await respondConflict('That name is already in use in this group.');
                    return true;
                }

                await respondSuccess(displayName);
                return true;
            },
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        await modal.fillDisplayName('ALICE');
        await modal.saveDisplayName();

        await modal.verifyDisplayNameErrorContainsText('already in use');

        // User retries with a unique name; request now succeeds and the success toast is shown
        await modal.fillDisplayName('Alicia Cooper');
        await modal.saveDisplayName();

        await modal.verifyDisplayNameErrorNotVisible();
        await modal.verifyDisplayNameSuccessVisible();
        await modal.verifyDisplayNameInputValue('Alicia Cooper');
    });
});
