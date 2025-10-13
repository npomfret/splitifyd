import { JoinGroupPage, JoinGroupResponseBuilder, PreviewGroupResponseBuilder, TEST_TIMEOUTS } from '@splitifyd/test-support';
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

        await page.goto('/join?linkId=test-link-123');

        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible({ timeout: TEST_TIMEOUTS.LOADING_COMPLETE });
        await expect(joinGroupPage.getGroupNameHeading()).toContainText('Weekend Trip Fund');

        const joinButton = joinGroupPage.getJoinGroupButton();
        await expect(joinButton).toBeVisible();
        await expect(joinButton).toBeEnabled();
    });
});

test.describe('Join Group Page - Error States', () => {
    test('should show error when no linkId parameter is provided', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        await setupSuccessfulApiMocks(page);

        await page.goto('/join');

        const errorWarning = page.locator('[data-testid="invalid-link-warning"]');
        await expect(errorWarning).toBeVisible();
        await expect(page.getByText('Invalid Link')).toBeVisible();
    });

    test('should show error when preview API fails', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        await setupSuccessfulApiMocks(page);

        await mockGroupPreviewFailure(page, 404, {
            error: 'Share link not found or has expired',
        });

        await page.goto('/join?linkId=invalid-link');

        const errorWarning = page.locator('[data-testid="unable-join-warning"]');
        await expect(errorWarning).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
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

        await expect(joinGroupPage.getGroupNameHeading()).toContainText('Existing Group', { timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(page.getByText(/already a member/i)).toBeVisible();
        await joinGroupPage.verifyJoinGroupButtonNotVisible();
        await expect(page.getByRole('button', { name: 'Go to Group' })).toBeVisible();
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

        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();

        const joinButton = joinGroupPage.getJoinGroupButton();
        await expect(joinButton).toBeEnabled();
        await joinButton.click();

        await expect(page.locator('[data-join-success="true"]')).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
        await expect(page.getByText('✅')).toBeVisible();
        await expect(page.getByRole('heading', { name: /Welcome to New Group/i })).toBeVisible();
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

        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
        await joinGroupPage.getJoinGroupButton().click();

        const errorMessage = page.locator('[data-testid="join-group-error-message"]');
        await expect(errorMessage).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(errorMessage).toContainText('You do not have permission to join this group');
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

        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();

        const cancelButton = page.getByRole('button', { name: 'Cancel' });
        await cancelButton.click();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should navigate to dashboard from error page', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        await setupSuccessfulApiMocks(page);

        await page.goto('/join');

        await expect(page.locator('[data-testid="invalid-link-warning"]')).toBeVisible();

        const goToDashboardButton = joinGroupPage.getBackToDashboardButton();
        await goToDashboardButton.click();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});
