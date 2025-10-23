import type { Page } from '@playwright/test';
import type { ClientUser, GroupId } from '@splitifyd/shared';
import { MemberRoles } from '@splitifyd/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

interface GroupTestSetupOptions {
    groupId?: GroupId;
    ownerId?: string;
    initialDisplayName?: string;
}

interface GroupTestSetupResult {
    groupId: GroupId;
    setMemberDisplayName: (next: string) => void;
}

async function setupGroupRoutes(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<GroupTestSetupResult> {
    const groupId = options.groupId ?? ('group-display-name-' as GroupId) + user.uid;
    const ownerId = options.ownerId ?? 'owner-123';
    let memberDisplayName = options.initialDisplayName ?? 'Current Alias';

    const group = new GroupDTOBuilder()
        .withId(groupId)
        .withName('Display Name Test Group')
        .withCreatedBy(ownerId)
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
        await fulfillWithSerialization(route, { body: { members: [] } });
    });

    return {
        groupId,
        setMemberDisplayName: (next: string) => {
            memberDisplayName = next;
        },
    };
}

test.describe('Group display name settings', () => {
    test('allows group members to update their display name from the settings modal', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId, setMemberDisplayName } = await setupGroupRoutes(page, user, { initialDisplayName: 'Current Alias' });

        await page.route(`**/api/groups/${groupId}/members/display-name`, async (route) => {
            const requestBody = JSON.parse(route.request().postData() ?? '{}') as { displayName?: string; };
            const nextDisplayName = requestBody.displayName ?? '';
            setMemberDisplayName(nextDisplayName);

            await fulfillWithSerialization(route, {
                body: { message: 'Group display name updated.' },
            });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        await expect(groupDetailPage.getEditGroupButton()).toBeVisible();

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        const displayNameInput = modal.getDisplayNameInput();
        const saveButton = modal.getDisplayNameSaveButton();

        await expect(displayNameInput).toHaveValue('Current Alias');
        await expect(saveButton).toBeDisabled();

        await modal.fillDisplayName('Updated Alias');
        await expect(saveButton).toBeEnabled();

        await modal.saveDisplayName();

        await expect(modal.getDisplayNameSuccess()).toBeVisible();
        await expect(displayNameInput).toHaveValue('Updated Alias');
        await expect(saveButton).toBeDisabled();
    });

    test('validates the display name input before submitting', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { initialDisplayName: 'Alias For Validation' });
        let updateCalled = false;

        await page.route(`**/api/groups/${groupId}/members/display-name`, async (route) => {
            updateCalled = true;
            await fulfillWithSerialization(route, {
                body: { message: 'This request should not be sent during validation.' },
            });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        const displayNameSection = modal.getDisplayNameSection();
        const input = modal.getDisplayNameInput();
        const saveButton = modal.getDisplayNameSaveButton();

        await expect(saveButton).toBeDisabled();

        await modal.fillDisplayName('   ');
        await expect(saveButton).toBeEnabled();

        await modal.saveDisplayName();

        const validationMessage = displayNameSection.getByTestId('input-error-message');
        await expect(validationMessage).toBeVisible();
        await expect(validationMessage).toContainText('Enter a display name.');

        await modal.fillDisplayName('A'.repeat(51));
        await modal.saveDisplayName();
        await expect(validationMessage).toContainText('50 characters or fewer.');

        await modal.fillDisplayName('Fresh Alias');
        await expect(validationMessage).not.toBeVisible();
        await expect(saveButton).toBeEnabled();

        expect(updateCalled).toBe(false);
    });

    test('shows a server error when the display name is already taken', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { initialDisplayName: 'Existing Alias' });

        await page.route(`**/api/groups/${groupId}/members/display-name`, async (route) => {
            await fulfillWithSerialization(route, {
                status: 409,
                body: {
                    error: {
                        message: 'That name is already in use in this group.',
                        code: 'DISPLAY_NAME_TAKEN',
                    },
                },
            });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Display Name Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');
        const input = modal.getDisplayNameInput();
        await modal.fillDisplayName('Conflicting Alias');
        await modal.saveDisplayName();

        const serverError = modal.getDisplayNameError();
        await expect(serverError).toBeVisible();
        await expect(serverError).toContainText('already in use');

        await expect(modal.getDisplayNameSuccess()).toHaveCount(0);
    });
});
