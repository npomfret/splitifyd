import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Modal Focus Management', () => {
    test('should trap focus within modal when tabbing', async ({ authenticatedPage }) => {
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

        // Get focusable elements (excluding disabled buttons which can't receive focus)
        const modal = page.locator('[role="dialog"]');
        const focusableSelector = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modal.locator(focusableSelector);

        // First focusable element should have focus initially
        const firstElement = focusableElements.first();
        await expect(firstElement).toBeFocused();

        // Tab to next element
        await page.keyboard.press('Tab');

        // Find the last enabled focusable element
        const lastElement = focusableElements.last();

        // Tab until we reach the last element, then Tab should wrap to first
        const count = await focusableElements.count();
        for (let i = 1; i < count - 1; i++) {
            await page.keyboard.press('Tab');
        }
        await expect(lastElement).toBeFocused();

        // Tab from last should wrap to first
        await page.keyboard.press('Tab');
        await expect(firstElement).toBeFocused();
    });

    test('should trap focus with Shift+Tab (reverse direction)', async ({ authenticatedPage }) => {
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

        // Get focusable elements (excluding disabled buttons which can't receive focus)
        const modal = page.locator('[role="dialog"]');
        const focusableSelector = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modal.locator(focusableSelector);

        // First focusable element should have focus
        const firstElement = focusableElements.first();
        await expect(firstElement).toBeFocused();

        // Shift+Tab from first should wrap to last enabled element
        await page.keyboard.press('Shift+Tab');

        const lastElement = focusableElements.last();
        await expect(lastElement).toBeFocused();
    });

    test('should restore focus to trigger element after modal closes', async ({ authenticatedPage }) => {
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

        // Get the create group button before clicking
        const createButton = page.getByRole('button', { name: /create.*group/i });
        await expect(createButton).toBeVisible();

        // Click to open modal
        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close modal via Escape
        await createGroupModal.pressEscapeToClose();
        await createGroupModal.verifyModalClosed();

        // Focus should return to the create group button
        await expect(createButton).toBeFocused();
    });

    test('should restore focus after closing modal via close button', async ({ authenticatedPage }) => {
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

        const createButton = page.getByRole('button', { name: /create.*group/i });

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close via X button
        await createGroupModal.clickClose();
        await createGroupModal.verifyModalClosed();

        // Focus should return to trigger
        await expect(createButton).toBeFocused();
    });

    test('should restore focus after closing modal via cancel button', async ({ authenticatedPage }) => {
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

        const createButton = page.getByRole('button', { name: /create.*group/i });

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();
        await createGroupModal.fillGroupName('Test');

        // Close via cancel button
        await createGroupModal.clickCancel();
        await createGroupModal.verifyModalClosed();

        // Focus should return to trigger
        await expect(createButton).toBeFocused();
    });

    test('should set initial focus to first focusable element when modal opens', async ({ authenticatedPage }) => {
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

        await dashboardPage.clickCreateGroup();

        // First focusable element in modal should be focused
        // The close button (X) is typically the first focusable element in the modal header
        const modal = page.locator('[role="dialog"]');
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const firstFocusable = modal.locator(focusableSelector).first();

        await expect(firstFocusable).toBeFocused();
    });
});

test.describe('Skip Link', () => {
    test('should show skip link on focus and navigate to main content', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');

        // Skip link should be visually hidden initially
        const skipLink = page.getByRole('link', { name: /skip to main content/i });
        await expect(skipLink).toBeAttached();

        // Tab to focus skip link (it's the first focusable element)
        await page.keyboard.press('Tab');
        await expect(skipLink).toBeFocused();

        // Skip link should now be visible (not sr-only when focused)
        await expect(skipLink).toBeVisible();

        // Click/activate skip link
        await skipLink.click();

        // Main content should receive focus
        const mainContent = page.locator('#main-content');
        await expect(mainContent).toBeFocused();
    });

    test('should hide skip link when not focused', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .build();
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');

        const skipLink = page.getByRole('link', { name: /skip to main content/i });

        // Skip link should be in DOM but visually hidden (sr-only)
        await expect(skipLink).toBeAttached();

        // Check that it's not taking up visual space when not focused
        // sr-only elements have specific CSS that makes them 1x1 pixel
        const boundingBox = await skipLink.boundingBox();
        expect(boundingBox?.width).toBeLessThanOrEqual(1);
        expect(boundingBox?.height).toBeLessThanOrEqual(1);
    });
});
