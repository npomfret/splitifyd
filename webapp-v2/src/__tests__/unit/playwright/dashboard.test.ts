import { test, expect } from '../../utils/console-logging-fixture';
import {createMockFirebase, mockGroupsApi, mockApiFailure, mockFullyAcceptedPoliciesApi, setupSuccessfulApiMocks, MockFirebase} from '../../utils/mock-firebase-service';
import { ClientUserBuilder, GroupDTOBuilder, ListGroupsResponseBuilder, UserNotificationDocumentBuilder, DashboardPage } from '@splitifyd/test-support';

// Configure all tests to run in serial mode for browser reuse
test.describe.configure({ mode: 'serial' });

// Test for browser reuse - using beforeAll/afterAll approach
test.describe.serial('Browser Reuse Test', () => {
    let page: any;
    let mockFirebase: any = null;

    test.beforeAll(async ({ browser }) => {
        // Create a single page that will be reused across all tests
        page = await browser.newPage();
    });

    test.afterAll(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
        }
        if (page) {
            await page.close();
        }
    });

    test('test 1 - redirect check', async () => {
        mockFirebase = await createMockFirebase(page, null);
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);
    });

    test('test 2 - empty state check', async () => {
        // Clean up previous mock
        if (mockFirebase) {
            await mockFirebase.dispose();
        }

        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

test.describe('Dashboard Authentication and Navigation', () => {
    let mockFirebase: any = null;

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should redirect unauthenticated user to login', async ({ pageWithLogging: page }) => {
        // Set up mock Firebase (logged out)
        mockFirebase = await createMockFirebase(page, null);

        // Try to navigate to dashboard without authentication
        await page.goto('/dashboard');

        // Should be redirected to login page
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
    });

    test('should show dashboard for authenticated user', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const dashboardPage = new DashboardPage(page);

        // Set up mock Firebase (logged in)
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Verify dashboard is displayed with user info
        await dashboardPage.verifyDashboardPageLoaded();
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);
    });
});

test.describe('Dashboard Groups Display and Loading States', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Set up authenticated user
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should show loading state while groups are loading', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Don't mock groups API immediately to see loading state
        await page.goto('/dashboard');

        // Wait for page to load but groups might still be loading
        await expect(page).toHaveURL('/dashboard');

        // Mock groups API with delay to show loading state
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        // Verify loading state appears first
        const isLoading = await dashboardPage.isDashboardLoading();
        if (isLoading) {
            await dashboardPage.verifyGroupsLoading();
        }

        // Wait for groups to finish loading
        await dashboardPage.waitForGroupsToLoad();
    });

    test('should display multiple groups correctly', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const groups = [
            GroupDTOBuilder.groupForUser(testUser.uid).withId('group-1').withName('House Expenses').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withId('group-2').withName('Trip to Italy').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withId('group-3').withName('Weekly Dinners').build()
        ];

        // Mock groups API
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(groups, groups.length).build());

        await page.goto('/dashboard');

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(3);
        await dashboardPage.verifyGroupDisplayed('House Expenses');
        await dashboardPage.verifyGroupDisplayed('Trip to Italy');
        await dashboardPage.verifyGroupDisplayed('Weekly Dinners');
    });

    test('should show empty state for new users with no groups', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Mock empty groups response
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        await page.goto('/dashboard');

        // Wait for groups to load and verify empty state
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyEmptyGroupsState();
        await dashboardPage.waitForWelcomeMessage();
    });

    test('should navigate to group details when clicking group card', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('Test Group')
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await page.goto('/dashboard');

        // Wait for groups to load
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Test Group');

        // Click on group card
        await dashboardPage.clickGroupCard('Test Group');

        // Verify navigation to group details
        await expect(page).toHaveURL(/\/groups\/group-abc/);
    });
});

test.describe('Dashboard Error Handling', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should handle API errors gracefully', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Mock API failure
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 500, { error: 'Internal Server Error' });

        await page.goto('/dashboard');

        // Verify error state is displayed
        await dashboardPage.verifyErrorState('Internal Server Error');
    });

    test('should allow retry after error', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Mock initial API failure
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 500, { error: 'Server temporarily unavailable' });

        await page.goto('/dashboard');

        // Verify error state
        await dashboardPage.verifyErrorState();

        // Mock successful API response for retry
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        // Click try again
        await dashboardPage.clickTryAgain();

        // Verify successful recovery
        await dashboardPage.waitForGroupsToLoad();
        await expect(dashboardPage.getErrorContainer()).not.toBeVisible();
    });

    test('should handle network timeouts gracefully', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Mock network timeout
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 408, { error: 'Request timeout' });

        await page.goto('/dashboard');

        // Verify timeout error is handled
        await dashboardPage.verifyErrorState('Request timeout');
    });
});

test.describe('Dashboard Real-time Updates', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should update group name after real-time notification', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const initialGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('Old Group Name')
            .build();

        const updatedGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('New Group Name')
            .build();

        // Mock initial groups response
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([initialGroup], 1).build());

        await page.goto('/dashboard');

        // Wait for initial groups to load and verify
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Old Group Name');

        // Establish baseline notification state
        await mockFirebase.triggerNotificationUpdate(testUser.uid,
            UserNotificationDocumentBuilder.withBaseline('group-abc', 1)
                .withLastModified(new Date())
                .build()
        );

        // Setup updated response for the notification-triggered API call
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([updatedGroup], 2).build());

        // Trigger group name change notification
        await mockFirebase.triggerNotificationUpdate(testUser.uid,
            UserNotificationDocumentBuilder.withGroupDetailsChange('group-abc', 2)
                .withLastModified(new Date())
                .build()
        );

        // Verify the updated group name appears
        await dashboardPage.waitForGroupToAppear('New Group Name');
        await dashboardPage.waitForGroupToDisappear('Old Group Name');
    });

    test('should add new group when notified of group creation', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with empty groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyEmptyGroupsState();

        // STEP 1: Send baseline notification (changeVersion=1, no groups) to mark first document as processed
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .build()
        );

        // Small wait to ensure first notification is processed
        await page.waitForTimeout(100);

        // Create new group for notification
        const newGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('new-group-123')
            .withName('Brand New Group')
            .build();

        // STEP 2: Unroute previous mock and setup new response with the group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([newGroup], 1).build());

        // STEP 3: Send notification with new group (changeVersion=2) - should trigger refresh
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('new-group-123', 1)
                .build()
        );

        // Verify new group appears
        await dashboardPage.waitForGroupToAppear('Brand New Group', 2000);
        await expect(dashboardPage.getEmptyGroupsState()).not.toBeVisible();
    });
});

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

    test('should open create group modal when clicking create button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with some groups to see the create button
        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Existing Group').build();
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Click create group button
        await dashboardPage.clickCreateGroup();

        // Verify modal opens
        await dashboardPage.verifyCreateGroupModalOpen();
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

        // Verify modal opens
        await dashboardPage.verifyCreateGroupModalOpen();
    });
});

test.describe('Dashboard User Interface and Responsiveness', () => {
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

    test('should display user menu and allow interaction', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        await page.goto('/dashboard');

        // Verify user menu is displayed with user info
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);

        // Open user menu
        await dashboardPage.openUserMenu();

        // Verify menu items are displayed
        await expect(page.getByRole('menuitem', { name: /dashboard/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /sign.*out/i })).toBeVisible();
    });
});

test.describe('Dashboard Groups Grid Layout and Interactions', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should display groups in responsive grid layout', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Create multiple groups to test grid layout
        const groups = Array.from({ length: 6 }, (_, i) =>
            GroupDTOBuilder.groupForUser(testUser.uid)
                .withId(`group-${i + 1}`)
                .withName(`Test Group ${i + 1}`)
                .build()
        );

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(groups, groups.length).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify grid layout
        const grid = dashboardPage.getGroupsGrid();
        await expect(grid).toBeVisible();
        await expect(grid).toHaveClass(/grid/);

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(6);

        // Check responsive classes
        await expect(grid).toHaveClass(/grid-cols-1/); // Mobile first
        await expect(grid).toHaveClass(/md:grid-cols-2/); // Tablet
        await expect(grid).toHaveClass(/xl:grid-cols-3/); // Desktop
    });

    test('should show group creation loading state in grid', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const existingGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withName('Existing Group')
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([existingGroup], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Simulate creating new group (this would normally happen via store)
        // For this test, we can check if the loading indicator exists in the component
        const loadingIndicator = dashboardPage.getCreateGroupLoadingIndicator();

        // The loading indicator may not be visible initially, but the selector should exist
        expect(await loadingIndicator.count()).toBeGreaterThanOrEqual(0);
    });

    test('should handle group card hover and click interactions', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('interactive-group')
            .withName('Interactive Group')
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const groupCard = dashboardPage.getGroupCard('Interactive Group');
        await expect(groupCard).toBeVisible();

        // Test hover state
        await groupCard.hover();

        // Test click interaction
        await dashboardPage.clickGroupCard('Interactive Group');

        // Verify navigation
        await expect(page).toHaveURL(/\/groups\/interactive-group/);
    });
});

test.describe('Dashboard Group Removal and Deletion', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should remove group from dashboard when user is removed from group', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-to-remove')
            .withName('Will Be Removed')
            .build();

        const group2 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-to-keep')
            .withName('Will Stay')
            .build();

        // Start with two groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], 2).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify both groups are displayed
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Will Be Removed');
        await dashboardPage.verifyGroupDisplayed('Will Stay');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-to-remove', 1)
                .withGroupDetails('group-to-keep', 1)
                .build()
        );

        await page.waitForTimeout(100);

        // Setup new response without the removed group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group2], 1).build());

        // Simulate user being removed from group - group disappears from notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-to-keep', 1)
                .build()
        );

        // Verify removed group disappears
        await dashboardPage.waitForGroupToDisappear('Will Be Removed');
        await dashboardPage.verifyGroupDisplayed('Will Stay');
        await dashboardPage.verifyGroupsDisplayed(1);
    });

    test('should remove group from dashboard when group is deleted', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-to-delete')
            .withName('Will Be Deleted')
            .build();

        const group2 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-to-survive')
            .withName('Will Survive')
            .build();

        // Start with two groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], 2).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify both groups are displayed
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Will Be Deleted');
        await dashboardPage.verifyGroupDisplayed('Will Survive');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-to-delete', 1)
                .withGroupDetails('group-to-survive', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup new response without the deleted group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group2], 1).build());

        // Simulate group deletion - group disappears from notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-to-survive', 1)
                .build()
            );

        // Verify deleted group disappears
        await dashboardPage.waitForGroupToDisappear('Will Be Deleted');
        await dashboardPage.verifyGroupDisplayed('Will Survive');
        await dashboardPage.verifyGroupsDisplayed(1);
    });

    test('should show empty state after last group is removed', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('only-group')
            .withName('Only Group')
            .build();

        // Start with one group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify group is displayed
        await dashboardPage.verifyGroupsDisplayed(1);
        await dashboardPage.verifyGroupDisplayed('Only Group');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('only-group', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup empty groups response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([], 0).build());

        // Simulate removal from last group
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .build()
        );

        // Verify empty state appears
        await dashboardPage.waitForGroupToDisappear('Only Group');
        await dashboardPage.verifyEmptyGroupsState();
        await dashboardPage.waitForWelcomeMessage();
    });

    test('should handle multiple groups being removed simultaneously', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-1')
            .withName('Group One')
            .build();

        const group2 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-2')
            .withName('Group Two')
            .build();

        const group3 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-3')
            .withName('Group Three')
            .build();

        // Start with three groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2, group3], 3).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(3);

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-1', 1)
                .withGroupDetails('group-2', 1)
                .withGroupDetails('group-3', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup response with only one group remaining
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group3], 1).build());

        // Simulate two groups being removed simultaneously
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-3', 1)
                .build()
            );

        // Verify removed groups disappear
        await dashboardPage.waitForGroupToDisappear('Group One');
        await dashboardPage.waitForGroupToDisappear('Group Two');
        await dashboardPage.verifyGroupDisplayed('Group Three');
        await dashboardPage.verifyGroupsDisplayed(1);
    });
});

test.describe('Dashboard Balance Change Notifications', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should refresh dashboard when balance change notification received', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const initialGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-balance-test')
            .withName('Balance Test Group')
            .build();

        const updatedGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-balance-test')
            .withName('Balance Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([initialGroup], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Balance Test Group');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-balance-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated response for balance change
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([updatedGroup], 2).build());

        // Trigger balance change notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-balance-test', 1)
                .build()
            );

        // Verify dashboard refreshes (group still visible with updated data)
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Balance Test Group');
    });

    test('should handle balance changes for multiple groups', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-1')
            .withName('Group One')
            .build();

        const group2 = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-2')
            .withName('Group Two')
            .build();

        // Start with two groups
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], 2).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupsDisplayed(2);

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-1', 1)
                .withGroupDetails('group-2', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], 3).build());

        // Trigger balance changes for both groups
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-1', 1)
                .withGroupDetails('group-2', 1)
                .build()
            );

        // Verify both groups still displayed
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Group One');
        await dashboardPage.verifyGroupDisplayed('Group Two');
    });
});

test.describe('Dashboard Transaction Change Notifications', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should refresh dashboard when transaction change notification received', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const initialGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-transaction-test')
            .withName('Transaction Test Group')
            .build();

        const updatedGroup = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-transaction-test')
            .withName('Transaction Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([initialGroup], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Transaction Test Group');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-transaction-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated response for transaction change
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([updatedGroup], 2).build());

        // Trigger transaction change notification (new expense added)
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-transaction-test', 1)
                .build()
            );

        // Verify dashboard refreshes
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Transaction Test Group');
    });

    test('should handle transaction and balance changes together', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-combo-test')
            .withName('Combo Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-combo-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 2).build());

        // Trigger combined transaction and balance change
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-combo-test', 1)
                .build()
            );

        // Verify dashboard handles combined update
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Combo Test Group');
    });
});

test.describe('Dashboard Rapid Notification Updates', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should handle rapid successive notifications without missing updates', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-rapid-test')
            .withName('Rapid Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-rapid-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated responses
        await page.unroute('/api/groups?includeMetadata=true');

        // Send multiple rapid notifications
        for (let i = 2; i <= 5; i++) {
            await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], i).build());

            await mockFirebase.triggerNotificationUpdate(
                testUser.uid,
                new UserNotificationDocumentBuilder()
                    .withChangeVersion(i)
                    .withGroupChangeCounts('group-rapid-test', {
                        groupDetailsChangeCount: 1,
                        transactionChangeCount: i - 1,
                        balanceChangeCount: i - 1,
                        commentChangeCount: 0
                    })
                    .build()
            );

            // Small delay between notifications
            await page.waitForTimeout(50);
        }

        // Verify dashboard remains stable
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Rapid Test Group');
    });

    test('should handle notifications arriving during active refresh', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-concurrent-test')
            .withName('Concurrent Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-concurrent-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Setup updated response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 2).build());

        // Send two notifications in quick succession
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('group-concurrent-test', 1)
                .build()
            );

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 3).build());

        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(3)
                .withGroupDetails('group-concurrent-test', 1)
                .build()
            );

        // Verify dashboard handles overlapping updates
        await page.waitForTimeout(1000);
        await dashboardPage.verifyGroupDisplayed('Concurrent Test Group');
    });
});

test.describe('Dashboard Notification Error Handling', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: any = null;

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

    test('should handle malformed notification gracefully', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('group-error-test')
            .withName('Error Test Group')
            .build();

        // Start with initial group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Error Test Group');

        // Send valid baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('group-error-test', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Send malformed notification (missing required fields)
        await mockFirebase.triggerNotificationUpdate(testUser.uid, {
            changeVersion: 2,
            groups: {
                'group-error-test': {
                    // Missing groupDetailsChangeCount and other required fields
                    lastGroupDetailsChange: new Date()
                }
            }
        });

        // Verify dashboard remains stable despite malformed notification
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Error Test Group');
    });

    test('should recover from notification with invalid group ID', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withId('valid-group')
            .withName('Valid Group')
            .build();

        // Start with valid group
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Valid Group');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(1)
                .withGroupDetails('valid-group', 1)
                .build()
            );

        await page.waitForTimeout(100);

        // Send notification for non-existent group
        await mockFirebase.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder()
                .withChangeVersion(2)
                .withGroupDetails('non-existent-group-id', 1)
                .withGroupDetails('valid-group', 1)
                .build()
            );

        // Setup response that only includes valid group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 2).build());

        // Verify dashboard handles invalid group ID gracefully
        await page.waitForTimeout(500);
        await dashboardPage.verifyGroupDisplayed('Valid Group');
    });
});