import { JoinGroupPage, JoinGroupResponseBuilder, PreviewGroupResponseBuilder, TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupPreviewApi, mockGroupPreviewFailure, mockJoinGroupApi, mockJoinGroupFailure, mockUpdateGroupDisplayNameApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Join Group Page - Preview Loading', () => {
    test('should display group preview after loading', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = new PreviewGroupResponseBuilder()
            .withGroupName('Weekend Trip Fund')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible(TEST_TIMEOUTS.LOADING_COMPLETE);
        await joinGroupPage.verifyGroupNameHeadingContains('Weekend Trip Fund');
        await joinGroupPage.verifyJoinButtonVisible();
        await joinGroupPage.verifyJoinButtonEnabled();
    });
});

test.describe('Join Group Page - Error States', () => {
    test('should show error when no linkId parameter is provided', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        await setupSuccessfulApiMocks(page);

        const joinGroupPage = new JoinGroupPage(page);

        await page.goto('/join');

        await joinGroupPage.verifyInvalidLinkWarningVisible();
        await joinGroupPage.verifyErrorMessageContains('Invalid Link');
    });

    test('should show error when preview API fails', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        await setupSuccessfulApiMocks(page);

        await mockGroupPreviewFailure(page, 404, {
            error: 'Share link not found or has expired',
        });

        await page.goto('/join?linkId=invalid-link');

        const joinGroupPage = new JoinGroupPage(page);
        await joinGroupPage.verifyUnableToJoinWarningVisible();
    });
});

test.describe('Join Group Page - Already a Member', () => {
    test('should show "already a member" message when user is in the group', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder
            .alreadyMember()
            .withGroupName('Existing Group')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyGroupNameHeadingContains('Existing Group', TEST_TIMEOUTS.ELEMENT_VISIBLE);
        await joinGroupPage.verifyAlreadyMemberMessageVisible();
        await joinGroupPage.verifyJoinGroupButtonNotVisible();
        await joinGroupPage.verifyGoToGroupButtonVisible();
    });
});

test.describe('Join Group Page - Successful Join', () => {
    test('should successfully join a group', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder
            .newMember()
            .withGroupName('New Group')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        const joinResponse = JoinGroupResponseBuilder.success('New Group').build();
        await mockJoinGroupApi(page, joinResponse);

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.verifyJoinButtonEnabled();
        await joinGroupPage.clickJoinGroupButton();

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
        await joinGroupPage.verifySuccessIconVisible();
        await joinGroupPage.verifySuccessHeadingContains('Welcome to New Group');
    });

    test('should show error when join fails', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember().build();
        await mockGroupPreviewApi(page, previewResponse);

        await mockJoinGroupFailure(page, 403, {
            error: 'You do not have permission to join this group',
        });

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.clickJoinGroupButton();
        await joinGroupPage.verifyErrorMessageContains('You do not have permission to join this group');
    });
});

test.describe('Join Group Page - Navigation', () => {
    test('should navigate back to dashboard when clicking cancel', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember().build();
        await mockGroupPreviewApi(page, previewResponse);

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.clickCancelButton();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should navigate to dashboard from error page', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        await page.goto('/join');

        await joinGroupPage.verifyInvalidLinkWarningVisible();
        await joinGroupPage.clickBackToDashboard();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

test.describe('Join Group Page - Display Name Conflict', () => {
    test('should show conflict modal when display name is already taken', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember()
            .withGroupName('Design Team')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        const joinResponse = new JoinGroupResponseBuilder()
            .withGroupId('group-123')
            .withGroupName('Design Team')
            .withDisplayNameConflict(true)
            .build();
        await mockJoinGroupApi(page, joinResponse);

        await page.goto('/join?linkId=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.verifyJoinButtonEnabled();
        await joinGroupPage.clickJoinGroupButton();

        const conflictModal = await joinGroupPage.openDisplayNameConflictModal();
        await conflictModal.verifyTitleContains('Choose a display name');
        await conflictModal.verifyDescriptionContains('already in use');
    });

    test('should successfully resolve conflict and join group', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember()
            .withGroupName('Engineering Squad')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        const conflictResponse = new JoinGroupResponseBuilder()
            .withGroupId('group-456')
            .withGroupName('Engineering Squad')
            .withDisplayNameConflict(true)
            .build();
        await mockJoinGroupApi(page, conflictResponse);

        // Mock the update display name API to succeed
        await mockUpdateGroupDisplayNameApi(page, 'group-456', {
            message: 'Display name updated successfully',
        });

        await page.goto('/join?linkId=test-link-123');
        await joinGroupPage.verifyJoinGroupHeadingVisible();

        await joinGroupPage.clickJoinGroupButton();

        const conflictModal = await joinGroupPage.openDisplayNameConflictModal();
        await conflictModal.fillDisplayName('Senior Engineer');
        await conflictModal.submit();
        await conflictModal.waitForClose(TEST_TIMEOUTS.API_RESPONSE);

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
    });

    test('should show validation error in modal for empty name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember().build();
        await mockGroupPreviewApi(page, previewResponse);

        const conflictResponse = new JoinGroupResponseBuilder()
            .withGroupId('group-789')
            .withGroupName('Project Alpha')
            .withDisplayNameConflict(true)
            .build();
        await mockJoinGroupApi(page, conflictResponse);

        await page.goto('/join?linkId=test-link-123');
        await joinGroupPage.clickJoinGroupButton();

        const conflictModal = await joinGroupPage.openDisplayNameConflictModal();

        // Try to submit with empty name
        await conflictModal.fillDisplayName('');
        await conflictModal.submit();

        // Validation error should appear and modal remains open
        await conflictModal.verifyValidationErrorContains('Enter a display name');
        await conflictModal.verifyTitleContains('Choose');
    });

    test('should allow canceling from conflict modal and show success', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder.newMember()
            .withGroupName('Art Collective')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        const conflictResponse = new JoinGroupResponseBuilder()
            .withGroupId('group-999')
            .withGroupName('Art Collective')
            .withDisplayNameConflict(true)
            .build();
        await mockJoinGroupApi(page, conflictResponse);

        await page.goto('/join?linkId=test-link-123');
        await joinGroupPage.clickJoinGroupButton();

        const conflictModal = await joinGroupPage.openDisplayNameConflictModal();

        // Click cancel
        await conflictModal.clickCancel();
        await conflictModal.waitForClose();

        // Should show success message (user has joined despite not resolving conflict)
        await expect(page).toHaveURL(/\/join/);
        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
        await joinGroupPage.verifySuccessHeadingContains('Welcome to Art Collective');
    });
});
