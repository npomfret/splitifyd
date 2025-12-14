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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // First focusable element should have focus initially
        await dashboardPage.verifyDialogFirstElementFocused();

        // Tab to next element
        await dashboardPage.pressTab();

        // Tab until we reach the last element, then Tab should wrap to first
        const count = await dashboardPage.getDialogFocusableElementCount();
        for (let i = 1; i < count - 1; i++) {
            await dashboardPage.pressTab();
        }
        await dashboardPage.verifyDialogLastElementFocused();

        // Tab from last should wrap to first
        await dashboardPage.pressTab();
        await dashboardPage.verifyDialogFirstElementFocused();
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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // First focusable element should have focus
        await dashboardPage.verifyDialogFirstElementFocused();

        // Shift+Tab from first should wrap to last enabled element
        await dashboardPage.pressShiftTab();

        await dashboardPage.verifyDialogLastElementFocused();
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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        // Verify create group button before clicking
        await dashboardPage.verifyCreateGroupButtonVisible();

        // Click to open modal
        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close modal via Escape
        await createGroupModal.pressEscapeToClose();
        await createGroupModal.verifyModalClosed();

        // Focus should return to the create group button
        await dashboardPage.verifyCreateGroupButtonFocused();
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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Close via X button
        await createGroupModal.clickClose();
        await createGroupModal.verifyModalClosed();

        // Focus should return to trigger
        await dashboardPage.verifyCreateGroupButtonFocused();
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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();
        await createGroupModal.fillGroupName('Test');

        // Close via cancel button
        await createGroupModal.clickCancel();
        await createGroupModal.verifyModalClosed();

        // Focus should return to trigger
        await dashboardPage.verifyCreateGroupButtonFocused();
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
        await dashboardPage.waitForGroupToAppear('Existing Group');

        await dashboardPage.clickCreateGroup();

        // First focusable element in modal should be focused
        await dashboardPage.verifyDialogFirstElementFocused();
    });
});

test.describe('Skip Link', () => {
    test('should show skip link on focus and navigate to main content', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

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
        await dashboardPage.verifySkipLinkAttached();

        // Tab to focus skip link (it's the first focusable element)
        await dashboardPage.pressTab();
        await dashboardPage.verifySkipLinkFocused();

        // Skip link should now be visible (not sr-only when focused)
        await dashboardPage.verifySkipLinkVisible();

        // Click/activate skip link
        await dashboardPage.clickSkipLink();

        // Main content should receive focus
        await dashboardPage.verifyMainContentFocused();
    });

    test('should hide skip link when not focused', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

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

        // Skip link should be in DOM but visually hidden (sr-only)
        await dashboardPage.verifySkipLinkAttached();

        // Check that it's not taking up visual space when not focused
        // sr-only elements have specific CSS that makes them 1x1 pixel
        const boundingBox = await dashboardPage.getSkipLinkBoundingBox();
        expect(boundingBox?.width).toBeLessThanOrEqual(1);
        expect(boundingBox?.height).toBeLessThanOrEqual(1);
    });
});
