import { test, expect } from './console-logging-fixture';
import { createMockFirebase, mockGroupsApi, mockApiFailure, mockFullyAcceptedPoliciesApi } from './mock-firebase-service';
import { ClientUserBuilder, GroupBuilder, ListGroupsResponseBuilder, UserNotificationDocumentBuilder } from '@splitifyd/test-support';

test.describe('Dashboard Real-time Updates', () => {
    const testUser = ClientUserBuilder.validUser().build();

    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Set up mock Firebase with authenticated user
        mockFirebase = await createMockFirebase(page, testUser);

        // Mock policies API: /api/user/policies/status -> all policies accepted
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should update group name on dashboard after notification', async ({ pageWithLogging: page }) => {
        const initialGroup = GroupBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('Old Group Name')
            .build();

        const updatedGroup = GroupBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('New Group Name')
            .build();

        // Mock groups API: /api/groups?includeMetadata=true -> initial group
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder.responseWithMetadata([initialGroup], 1).build()
        );

        // 3. Navigate to dashboard and verify initial state
        await page.goto('/dashboard');

        // Wait for authentication to complete and redirect away from login
        await expect(page).not.toHaveURL('/login');
        await expect(page).toHaveURL('/dashboard');

        // Wait for groups to load
        await expect(page.getByText('Old Group Name')).toBeVisible();
        await expect(page.getByText('New Group Name')).not.toBeVisible();

        // 4. Establish baseline notification state
        await mockFirebase.triggerNotificationUpdate(testUser.uid,
            UserNotificationDocumentBuilder.withBaseline('group-abc', 1)
                .withLastModified(new Date())
                .build()
        );

        // Wait for baseline processing
        await expect(page.getByText('Old Group Name')).toBeVisible();

        // 5. Setup updated response for groups API call that will be triggered by notification
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder.responseWithMetadata([updatedGroup], 2)
                .build()
        );

        // 6. Trigger group name change notification
        await mockFirebase.triggerNotificationUpdate(testUser.uid,
            UserNotificationDocumentBuilder.withGroupDetailsChange('group-abc', 2)
                .withLastModified(new Date())
                .build()
        );

        // 7. Verify the updated group name is displayed
        await expect(page.getByText('New Group Name')).toBeVisible();
        await expect(page.getByText('Old Group Name')).not.toBeVisible();
    });
});

test.describe('Dashboard Error Handling', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase = await createMockFirebase(page, testUser);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should handle API errors gracefully', async ({ pageWithLogging: page }) => {

        // Mock API failure: /api/groups?includeMetadata=true -> 500 Internal Server Error
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 500, { error: 'Internal Server Error' });

        await page.goto('/dashboard');

        // Should show error state gracefully
        await expect(page.getByText('Internal Server Error').or(page.getByText('Error loading groups'))).toBeVisible();
    });
});