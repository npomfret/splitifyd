import { CreateGroupModalPage, DashboardPage, FORM_VALIDATION, GroupDTOBuilder, ListGroupsResponseBuilder, randomString } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockApiFailure, mockGenerateShareLinkApi, mockGroupsApi } from '../../utils/mock-firebase-service';

// ============================================================================
// Dashboard Create Group Functionality
// ============================================================================
test.describe('Dashboard Create Group Functionality', () => {
    test('should open create group modal using fluent interface', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Start with some groups to see the create button
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Click create group button - fluent interface returns modal
        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Verify modal is open with correct initial state
        await createGroupModal.verifyModalOpen();
        await createGroupModal.verifyFormEmpty();
        await createGroupModal.verifyHelpTextDisplayed();

        const displayNameInput = createGroupModal.getGroupDisplayNameInput();
        await expect(displayNameInput).toHaveValue(user.displayName ?? '');
    });

    const formValidationCases = [
        { name: 'empty name', input: '', expectedEnabled: false },
        { name: 'single character name', input: randomString(1), expectedEnabled: false },
        {
            name: 'valid name (minimum length)',
            input: randomString(FORM_VALIDATION.MIN_GROUP_NAME_LENGTH),
            expectedEnabled: true,
        },
        { name: 'valid name (longer)', input: randomString(5), expectedEnabled: true },
    ];

    for (const testCase of formValidationCases) {
        test(`form validation: ${testCase.name} should ${testCase.expectedEnabled ? 'enable' : 'disable'} submit`, async ({ authenticatedPage }) => {
            const { page, user } = authenticatedPage;
            const dashboardPage = new DashboardPage(page);
            const group = GroupDTOBuilder
                .groupForUser(user.uid)
                .withName('Existing Group')
                .build();
            await mockGroupsApi(
                page,
                ListGroupsResponseBuilder
                    .responseWithMetadata([group], 1)
                    .build(),
            );
            await mockActivityFeedApi(page, []);

            await page.goto('/dashboard');
            await dashboardPage.waitForGroupsToLoad();

            const createGroupModal = await dashboardPage.clickCreateGroup();
            await createGroupModal.fillGroupName(testCase.input);
            await createGroupModal.verifySubmitButtonState(testCase.expectedEnabled);
        });
    }

    test('should fill both group name and description', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Fill both fields
        await createGroupModal.fillGroupForm('Weekend Trip', 'Our annual hiking trip expenses');

        // Verify values
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Weekend Trip');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('Our annual hiking trip expenses');

        // Submit should be enabled
        await createGroupModal.verifySubmitButtonState(true);
    });

    const closeModalMethods = [
        { name: 'cancel button', action: (modal: CreateGroupModalPage) => modal.clickCancel() },
        { name: 'X button', action: (modal: CreateGroupModalPage) => modal.clickClose() },
        { name: 'Escape key', action: (modal: CreateGroupModalPage) => modal.pressEscapeToClose() },
        { name: 'backdrop click', action: (modal: CreateGroupModalPage) => modal.clickOutsideToClose() },
    ];

    for (const closeMethod of closeModalMethods) {
        test(`should close modal using ${closeMethod.name}`, async ({ authenticatedPage }) => {
            const { page, user } = authenticatedPage;
            const dashboardPage = new DashboardPage(page);
            const group = GroupDTOBuilder
                .groupForUser(user.uid)
                .withName('Existing Group')
                .build();
            await mockGroupsApi(
                page,
                ListGroupsResponseBuilder
                    .responseWithMetadata([group], 1)
                    .build(),
            );
            await mockActivityFeedApi(page, []);

            await page.goto('/dashboard');
            await dashboardPage.waitForGroupsToLoad();

            const createGroupModal = await dashboardPage.clickCreateGroup();
            await createGroupModal.verifyModalOpen();

            if (closeMethod.name === 'cancel button') {
                await createGroupModal.fillGroupName('Test Group');
            }

            // Wait for backdrop debounce guard to expire (200ms) before clicking backdrop
            if (closeMethod.name === 'backdrop click') {
                await page.waitForTimeout(250);
            }

            await closeMethod.action(createGroupModal);
            await createGroupModal.verifyModalClosed();
        });
    }

    test('should reopen modal with clean state after closing', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // First opening
        const createGroupModal1 = await dashboardPage.clickCreateGroup();
        await createGroupModal1.fillGroupName('Previous Group Name');
        await createGroupModal1.clickCancel();
        await createGroupModal1.waitForModalToClose();
        await createGroupModal1.verifyModalClosed();

        // Second opening - should be clean
        const createGroupModal2 = await dashboardPage.clickCreateGroup();
        await createGroupModal2.verifyModalOpen();
        await createGroupModal2.verifyFormEmpty();
        await expect(createGroupModal2.getGroupDisplayNameInput()).toHaveValue(user.displayName ?? '');
        await createGroupModal2.verifyNoValidationError();
    });

    test('should open create group modal from empty state', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Start with empty groups
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyEmptyGroupsState();

        // The empty state should have a create group button
        const emptyStateCreateButton = dashboardPage.getEmptyGroupsState().getByRole('button', { name: /create.*group/i });
        await expect(emptyStateCreateButton).toBeVisible();
        await emptyStateCreateButton.click();

        // Verify modal opens using CreateGroupModalPage
        const createGroupModal = new CreateGroupModalPage(page);
        await createGroupModal.verifyModalOpen();
    });

    test('should allow filling only group name without description', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Fill only name (description is optional)
        await createGroupModal.fillGroupName('Quick Group');

        // Verify name is filled and description is empty
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Quick Group');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('');

        // Submit should be enabled (description is optional)
        await createGroupModal.verifySubmitButtonState(true);
    });

    test('should maintain form state while modal is open', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Fill both fields
        await createGroupModal.fillGroupName('Summer Trip');
        await createGroupModal.fillGroupDescription('Beach vacation expenses');

        // Verify state persists
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Summer Trip');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('Beach vacation expenses');
        await createGroupModal.verifySubmitButtonState(true);

        // State should persist
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Summer Trip');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('Beach vacation expenses');
    });

    test('should handle multiple field updates correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Existing Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Update name multiple times
        await createGroupModal.fillGroupName('First');
        await createGroupModal.verifySubmitButtonState(true);

        await createGroupModal.fillGroupName('Second Name');
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Second Name');
        await createGroupModal.verifySubmitButtonState(true);

        // Update description multiple times
        await createGroupModal.fillGroupDescription('First desc');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('First desc');

        await createGroupModal.fillGroupDescription('Updated description');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('Updated description');

        // Final values should be latest
        await expect(createGroupModal.getGroupNameInput()).toHaveValue('Second Name');
        await expect(createGroupModal.getGroupDescriptionInput()).toHaveValue('Updated description');
    });
});

test.describe('Dashboard Share Group Modal', () => {
    test('should open share modal when clicking group card invite button', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click invite button on group card - fluent method returns modal page
        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify share modal opened
        await shareModal.verifyModalOpen();
    });

    test('should display share link and QR code after generation', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123', 'test-token-abc');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Wait for share link to be generated
        await shareModal.verifyShareLinkDisplayed();

        // Verify link contains expected token
        const shareLink = await shareModal.getShareLink();
        expect(shareLink).toContain('/join?shareToken=test-token-abc');
    });

    test('should close share modal via close button', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyModalOpen();

        // Close modal
        await shareModal.clickClose();

        // Verify modal closed
        await shareModal.verifyModalClosed();
    });

    test('should close share modal via Escape key', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Close via Escape
        await shareModal.pressEscapeToClose();

        // Verify modal closed
        await shareModal.verifyModalClosed();
    });

    test('should close share modal via backdrop click', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyModalOpen();

        // Close via backdrop
        await shareModal.clickOutsideToClose();

        // Verify modal closed
        await shareModal.verifyModalClosed();
    });

    test('should copy share link to clipboard and show toast', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123');

        // Grant clipboard permissions
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyShareLinkDisplayed();

        // Copy link - returns the copied link
        const copiedLink = await shareModal.copyShareLinkToClipboard();
        expect(copiedLink).toContain('/join?shareToken=');

        // Verify toast appears
        await shareModal.verifyCopySuccess();

        // Verify clipboard contains link
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('/join?shareToken=');
    });

    test('should generate new share link when requested', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-123', 'first-token');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyShareLinkDisplayed();

        const firstLink = await shareModal.getShareLink();
        expect(firstLink).toContain('first-token');

        // Mock new link generation
        await mockGenerateShareLinkApi(page, 'group-123', 'second-token');

        // Generate new link - returns the new link
        const secondLink = await shareModal.generateNewShareLink();
        expect(secondLink).toContain('second-token');
        expect(secondLink).not.toEqual(firstLink);
    });

    test('should handle share link generation error', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Mock API failure for share link generation
        await mockApiFailure(page, `/api/groups/group-123/share-link`, 500, { error: 'Failed to generate share link' });

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Use NoWait version since we expect API failure, not successful share link generation
        const shareModal = await dashboardPage.clickGroupCardInviteButtonNoWait('Test Group');

        // Verify error message displayed
        await shareModal.verifyErrorMessage('Failed to generate share link');
    });

    test('should show loading state while generating share link', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Mock delayed response for share link to test loading state
        await mockGenerateShareLinkApi(page, 'group-123', 'delayed-token', { delayMs: 100 });

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Use NoWait version to catch the loading state before it completes
        const shareModal = await dashboardPage.clickGroupCardInviteButtonNoWait('Test Group');

        // Verify loading state appears immediately after modal opens
        await shareModal.verifyLoading();

        // Wait for link to load
        await shareModal.verifyShareLinkDisplayed();
    });
});
