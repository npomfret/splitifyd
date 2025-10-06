import { expect, test } from '../../utils/console-logging-fixture';
import {createMockFirebase, mockApiFailure, MockFirebase, mockFullyAcceptedPoliciesApi, mockGenerateShareLinkApi, mockGroupsApi, setupSuccessfulApiMocks} from '../../utils/mock-firebase-service';
import {ClientUserBuilder, CreateGroupModalPage, DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder, randomString} from '@splitifyd/test-support';

// ============================================================================
// Dashboard Create Group Functionality
// ============================================================================
test.describe('Dashboard Create Group Functionality', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should open create group modal using fluent interface', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with some groups to see the create button
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Click create group button - fluent interface returns modal
        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Verify modal is open with correct initial state
        await createGroupModal.verifyModalOpen();
        await createGroupModal.verifyFormEmpty();
        await createGroupModal.verifyHelpTextDisplayed();
    });

    test('should validate group name is required', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Initially submit button should be disabled
        await createGroupModal.verifySubmitButtonState(false);

        // Fill with just one character - still disabled - using random string to debug auto-fill
        await createGroupModal.fillGroupName(randomString(1));
        await createGroupModal.verifySubmitButtonState(false);

        // Fill with valid name (2+ characters) - should enable
        await createGroupModal.fillGroupName(randomString(5));
        await createGroupModal.verifySubmitButtonState(true);

        // Clear name - should disable again
        await createGroupModal.fillGroupName('');
        await createGroupModal.verifySubmitButtonState(false);
    });

    test('should fill both group name and description', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

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

    test('should close modal using cancel button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Fill some data
        await createGroupModal.fillGroupName('Test Group');

        // Close via cancel
        await createGroupModal.clickCancel();
        await createGroupModal.verifyModalClosed();
    });

    test('should close modal using X button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close via X button
        await createGroupModal.clickClose();
        await createGroupModal.verifyModalClosed();
    });

    test('should close modal using Escape key', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close via Escape key
        await createGroupModal.pressEscapeToClose();
        await createGroupModal.verifyModalClosed();
    });

    test('should close modal by clicking backdrop', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close by clicking outside
        await createGroupModal.clickOutsideToClose();
        await createGroupModal.verifyModalClosed();
    });

    test('should reopen modal with clean state after closing', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

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
        await createGroupModal2.verifyNoValidationError();
    });

    test('should open create group modal from empty state', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with empty groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

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

    test('should clear validation error when user starts typing', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Fill with single character (too short) - using random string to debug auto-fill issues
        const singleChar = randomString(1);
        await createGroupModal.fillGroupName(singleChar);

        // Try to submit - will trigger validation
        const submitButton = createGroupModal.getSubmitButton();
        await expect(submitButton).toBeDisabled();

        // When user types more, error should clear and submit should enable
        const validName = randomString(5);
        await createGroupModal.fillGroupName(validName);
        await createGroupModal.verifyNoValidationError();
        await createGroupModal.verifySubmitButtonState(true);
    });

    test('should handle form submission reactively', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const createGroupModal = await dashboardPage.clickCreateGroup();

        // Form starts with submit disabled
        await createGroupModal.verifySubmitButtonState(false);

        // Fill name field reactively
        await createGroupModal.fillGroupName('T');
        await createGroupModal.verifySubmitButtonState(false);

        await createGroupModal.fillGroupName('Te');
        await createGroupModal.verifySubmitButtonState(true);

        // Add description (optional, doesn't affect submit state)
        await createGroupModal.fillGroupDescription('Test description');
        await createGroupModal.verifySubmitButtonState(true);
    });

    test('should open create group modal from mobile button using fluent interface', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Click mobile create group button - fluent interface returns modal
        const createGroupModal = await dashboardPage.clickMobileCreateGroup();

        // Verify modal is open with correct initial state
        await createGroupModal.verifyModalOpen();
        await createGroupModal.verifyFormEmpty();
        await createGroupModal.verifyHelpTextDisplayed();
    });

    test('should allow filling only group name without description', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

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

    test('should maintain form state while modal is open', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

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

    test('should handle multiple field updates correctly', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should open share modal when clicking group card invite button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click invite button on group card
        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify share modal opened
        await dashboardPage.verifyShareModalOpen();
    });

    test('should display share link and QR code after generation', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123', 'test-token-abc');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Wait for share link to be generated
        await dashboardPage.verifyShareLinkDisplayed();

        // Verify QR code is displayed
        await dashboardPage.verifyQRCodeDisplayed();

        // Verify link contains expected token
        const shareLink = await dashboardPage.getShareLinkValue();
        expect(shareLink).toContain('/join/test-token-abc');
    });

    test('should close share modal via close button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');
        await dashboardPage.verifyShareModalOpen();

        // Close modal
        await dashboardPage.closeShareModal();

        // Verify modal closed
        await dashboardPage.verifyShareModalClosed();
    });

    test('should close share modal via Escape key', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Close via Escape
        await shareModal.pressEscapeToClose();

        // Verify modal closed
        await shareModal.verifyModalClosed();
    });

    test('should close share modal via backdrop click', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');
        await dashboardPage.verifyShareModalOpen();

        // Close via backdrop
        await dashboardPage.closeShareModalViaBackdrop();

        // Verify modal closed
        await dashboardPage.verifyShareModalClosed();
    });

    test('should copy share link to clipboard and show toast', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        // Grant clipboard permissions
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');
        await dashboardPage.verifyShareLinkDisplayed();

        // Copy link
        await dashboardPage.copyShareLink();

        // Verify toast appears
        await dashboardPage.verifyLinkCopiedToast();

        // Verify clipboard contains link
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('/join/');
    });

    test('should generate new share link when requested', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123', 'first-token');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');
        await dashboardPage.verifyShareLinkDisplayed();

        const firstLink = await dashboardPage.getShareLinkValue();
        expect(firstLink).toContain('first-token');

        // Mock new link generation
        await mockGenerateShareLinkApi(page, 'group-123', 'second-token');

        // Generate new link
        await dashboardPage.generateNewShareLink();

        // Wait for new link to appear with auto-retry
        await expect(async () => {
            const secondLink = await dashboardPage.getShareLinkValue();
            expect(secondLink).toContain('second-token');
        }).toPass();

        const secondLink = await dashboardPage.getShareLinkValue();
        expect(secondLink).toContain('second-token');
        expect(secondLink).not.toEqual(firstLink);
    });

    test('should handle share link generation error', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        // Mock API failure for share link generation
        await mockApiFailure(page, `/api/groups/group-123/share-link`, 500, { error: 'Failed to generate share link' });

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify error message displayed
        await dashboardPage.verifyShareModalError();
    });

    test('should show loading state while generating share link', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        // Mock delayed response for share link (longer delay to ensure we catch loading state)
        await page.route('/api/groups/share', async (route) => {
            const request = route.request();
            const postData = request.postDataJSON();

            // Only respond if the groupId matches
            if (postData?.groupId === 'group-123') {
                await page.waitForTimeout(2000);
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        linkId: 'delayed-token',
                        shareablePath: '/join/delayed-token',
                    }),
                });
            } else {
                await route.continue();
            }
        });

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click invite button - this triggers the share link API call
        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify loading state appears immediately after modal opens
        await dashboardPage.verifyShareModalLoading();

        // Wait for link to load
        await dashboardPage.verifyShareLinkDisplayed();
    });
});
