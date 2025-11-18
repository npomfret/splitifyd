import { JoinGroupPage, JoinGroupResponseBuilder, PreviewGroupResponseBuilder, TEST_TIMEOUTS } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupPreviewApi, mockGroupPreviewFailure, mockJoinGroupApi, mockJoinGroupFailure, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Join Group Page - Preview Loading', () => {
    test('should display group preview after loading', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = new PreviewGroupResponseBuilder()
            .withGroupName('Weekend Trip Fund')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        await page.goto('/join?shareToken=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible(TEST_TIMEOUTS.LOADING_COMPLETE);
        await joinGroupPage.verifyGroupNameHeadingContains('Weekend Trip Fund');
        await joinGroupPage.verifyJoinButtonVisible();
        await joinGroupPage.verifyJoinButtonEnabled();
    });
});

test.describe('Join Group Page - Error States', () => {
    test('should show error when no shareToken parameter is provided', async ({ authenticatedPage }) => {
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

        await page.goto('/join?shareToken=invalid-link');

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

        await page.goto('/join?shareToken=test-link-123');

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

        await page.goto('/join?shareToken=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.verifyJoinButtonEnabled();

        // Click join button - this opens the display name modal
        await joinGroupPage.clickJoinGroupButton();

        // The modal should appear with default display name pre-filled
        await joinGroupPage.waitForDisplayNameModal(1000);

        // Submit the modal to actually join
        await joinGroupPage.submitDisplayNameModal();

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
        await joinGroupPage.verifySuccessIconVisible();
        await joinGroupPage.verifySuccessHeadingContains('Welcome to New Group');
    });

    test('should show pending approval message when admin approval is required', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        const previewResponse = PreviewGroupResponseBuilder
            .newMember()
            .withGroupName('Managed Group')
            .build();
        await mockGroupPreviewApi(page, previewResponse);

        const pendingJoinResponse = new JoinGroupResponseBuilder()
            .withGroupId('group-managed')
            .withGroupName('Managed Group')
            .withSuccess(false)
            .withMemberStatus('pending')
            .build();
        await mockJoinGroupApi(page, pendingJoinResponse);

        await page.goto('/join?shareToken=managed-link');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.clickJoinGroupButton();

        // Wait for modal and submit
        await joinGroupPage.waitForDisplayNameModal(1000);
        await joinGroupPage.submitDisplayNameModal();

        await joinGroupPage.verifyPendingApprovalAlertVisible('Managed Group');
        await joinGroupPage.verifyJoinButtonDisabled();
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

        await page.goto('/join?shareToken=test-link-123');

        await joinGroupPage.verifyJoinGroupHeadingVisible();
        await joinGroupPage.clickJoinGroupButton();

        // Wait for modal and submit
        await joinGroupPage.waitForDisplayNameModal(1000);
        await joinGroupPage.submitDisplayNameModal();

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

        await page.goto('/join?shareToken=test-link-123');

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
