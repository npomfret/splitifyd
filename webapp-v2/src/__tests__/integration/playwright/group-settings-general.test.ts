import type { ClientUser, GroupId } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { DashboardPage, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface GroupUpdateContext {
    name: string;
    description: string;
    route: Route;
    respondSuccess: () => Promise<void>;
    respondError: (status: number, code: string, message: string) => Promise<void>;
}

type GroupUpdateHandler = (context: GroupUpdateContext) => Promise<boolean> | boolean;

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    groupDescription?: string;
    onGroupUpdate?: GroupUpdateHandler;
    onGroupDelete?: (route: Route) => Promise<boolean> | boolean;
}

async function setupGroupRoutes(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<{ groupId: GroupId; groupName: string; }> {
    const groupId = options.groupId ?? toGroupId('group-general-' + user.uid);
    let groupName = options.groupName ?? 'Test Group';
    let groupDescription = options.groupDescription ?? 'A test group description';

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withDescription(groupDescription)
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withMemberRole('admin')
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

    // Mock group update endpoint
    await page.route(`**/api/groups/${groupId}`, async (route) => {
        if (route.request().method() === 'PUT') {
            const requestBody = JSON.parse(route.request().postData() ?? '{}') as { name?: string; description?: string; };
            const requestedName = requestBody.name ?? groupName;
            const requestedDescription = requestBody.description ?? groupDescription;

            const respondSuccess = async () => {
                groupName = requestedName;
                groupDescription = requestedDescription;
                await route.fulfill({ status: 204 });
            };

            const respondError = async (status: number, code: string, message: string) => {
                await fulfillWithSerialization(route, {
                    status,
                    body: { error: { code, message } },
                });
            };

            if (options.onGroupUpdate) {
                const handled = await options.onGroupUpdate({
                    name: requestedName,
                    description: requestedDescription,
                    route,
                    respondSuccess,
                    respondError,
                });
                if (handled) return;
            }

            await respondSuccess();
        } else if (route.request().method() === 'DELETE') {
            if (options.onGroupDelete) {
                const handled = await options.onGroupDelete(route);
                if (handled) return;
            }
            await route.fulfill({ status: 204 });
        } else {
            await route.continue();
        }
    });

    return { groupId, groupName };
}

test.describe('Group Settings - General Tab - Editing', () => {
    test('allows owner to update group name successfully', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { groupName: 'Original Name' });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Original Name');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify current values
        await modal.verifyGroupNameValue('Original Name');

        // Edit and save
        await modal.editGroupName('Updated Name');
        await modal.saveChanges();

        // Verify success
        await modal.verifyGeneralSuccessAlertVisible();
    });

    test('allows owner to update group description successfully', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Description Test Group',
            groupDescription: 'Original description',
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Description Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Edit description and save
        await modal.editDescription('Updated description with more details');
        await modal.saveChanges();

        // Verify success
        await modal.verifyGeneralSuccessAlertVisible();
    });

    test('validates group name cannot be empty', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        let updateAttempted = false;

        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Non-Empty Name',
            onGroupUpdate: async () => {
                updateAttempted = true;
                return false;
            },
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Non-Empty Name');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Clear name and verify validation
        await modal.clearGroupName();

        // Save button should be disabled or validation error shown
        await modal.verifySaveButtonDisabled();

        // No API call should have been made
        expect(updateAttempted).toBe(false);
    });

    test('validates group name must be at least 2 characters', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        let updateAttempted = false;

        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Valid Name',
            onGroupUpdate: async () => {
                updateAttempted = true;
                return false;
            },
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Valid Name');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Enter single character
        await modal.fillGroupName('A');

        // Try to submit - should be disabled or show error
        await modal.verifySaveButtonDisabled();

        // No API call should have been made
        expect(updateAttempted).toBe(false);
    });
});

test.describe('Group Settings - General Tab - Delete Flow', () => {
    test('opens confirmation dialog when clicking delete', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { groupName: 'Delete Test Group' });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Delete Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Click delete button
        await modal.clickDelete();

        // Verify delete dialog appears
        await modal.verifyDeleteDialogVisible();

        // Verify confirm button is disabled initially
        await modal.verifyConfirmDeleteButtonDisabled();
    });

    test('enables confirm button when group name is typed correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupName = 'Confirm Delete Group';
        const { groupId } = await setupGroupRoutes(page, user, { groupName });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle(groupName);

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await modal.clickDelete();
        await modal.verifyDeleteDialogVisible();

        // Button should be disabled before typing
        await modal.verifyConfirmDeleteButtonDisabled();

        // Type the group name
        await modal.fillDeleteConfirmation(groupName as any);

        // Button should now be enabled
        await modal.verifyConfirmDeleteButtonEnabled();
    });

    test('redirects to dashboard after successful deletion', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupName = 'Group To Delete';
        const { groupId } = await setupGroupRoutes(page, user, { groupName });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle(groupName);

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Open delete dialog first
        await modal.clickDelete();
        await modal.verifyDeleteDialogVisible();

        // Complete deletion flow
        const dashboardPage = await modal.handleDeleteConfirmDialog(groupName, (p) => new DashboardPage(p));

        // Verify we're on dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('cancel button returns to settings modal', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupName = 'Cancel Delete Group';
        const { groupId } = await setupGroupRoutes(page, user, { groupName });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle(groupName);

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await modal.clickDelete();
        await modal.verifyDeleteDialogVisible();

        // Click cancel
        await modal.cancelDelete();

        // Delete dialog should be closed
        await modal.verifyDeleteDialogNotVisible();

        // Settings modal should still be open
        await modal.verifyModalContainerVisible();
    });
});
