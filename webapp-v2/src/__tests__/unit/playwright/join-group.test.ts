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

        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();

        const joinButton = joinGroupPage.getJoinGroupButton();
        await expect(joinButton).toBeEnabled();
        await joinButton.click();

        // Modal should appear
        const modal = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        // Verify modal content
        await expect(page.getByText(/Choose a display name/i)).toBeVisible();
        await expect(page.getByText(/already in use/i)).toBeVisible();
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
        await page.route('**/api/groups/*/members/display-name', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Display name updated successfully' }),
            });
        });

        await page.goto('/join?linkId=test-link-123');
        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();

        const joinButton = joinGroupPage.getJoinGroupButton();
        await joinButton.click();

        // Modal should appear
        const modal = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        // Enter new display name
        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('Senior Engineer');

        // Submit the form
        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        // Modal should close and success message should appear
        await expect(modal).not.toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
        await expect(page.locator('[data-join-success="true"]')).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
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
        await joinGroupPage.getJoinGroupButton().click();

        const modal = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        // Try to submit with empty name
        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('');

        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        // Validation error should appear
        await expect(page.getByText(/enter a display name/i)).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });

        // Modal should still be visible
        await expect(modal).toBeVisible();
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
        await joinGroupPage.getJoinGroupButton().click();

        const modal = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        // Click cancel
        const cancelButton = page.getByRole('button', { name: /cancel/i }).last();
        await cancelButton.click();

        // Modal should close
        await expect(modal).not.toBeVisible();

        // Should show success message (user has joined despite not resolving conflict)
        await expect(page).toHaveURL(/\/join/);
        await expect(page.locator('[data-join-success="true"]')).toBeVisible();
        await expect(page.getByRole('heading', { name: /Welcome to Art Collective/i })).toBeVisible();
    });
});
